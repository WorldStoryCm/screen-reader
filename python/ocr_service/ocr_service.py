#!/usr/bin/env python3
"""Cross-platform OCR service using RapidOCR (PaddleOCR-based).

Falls back to Windows.Media.Ocr via PowerShell or Tesseract if RapidOCR not available.

Protocol:
  Input:  {"image_path": "...", "preset": "default_ui"}
  Output: {"raw_text": "...", "normalized_text": "...", "confidence": 0.0, "error": null}
"""

import json
import sys
import unicodedata
from pathlib import Path

# Try to import RapidOCR (preferred engine)
RAPID_OCR = None
try:
    from rapidocr_onnxruntime import RapidOCR as _RapidOCR
    RAPID_OCR = _RapidOCR()
except ImportError:
    pass

# Fallback: Tesseract
TESSERACT = False
if RAPID_OCR is None:
    try:
        import pytesseract
        TESSERACT = True
    except ImportError:
        pass


def normalize_text(text: str) -> str:
    """Normalize OCR output: trim, normalize unicode, clean whitespace."""
    text = unicodedata.normalize("NFKC", text)
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            lines.append(stripped)
    return "\n".join(lines)


def run_ocr_rapid(image_path: str) -> dict:
    """Run OCR using RapidOCR (PaddleOCR ONNX models)."""
    result, elapse = RAPID_OCR(image_path)

    if result is None or len(result) == 0:
        return {
            "raw_text": "",
            "normalized_text": "",
            "confidence": 0.0,
            "error": None,
        }

    lines = []
    total_conf = 0.0
    count = 0
    for item in result:
        # item: [box_coords, text, confidence]
        text = item[1]
        conf = item[2]
        lines.append(text)
        total_conf += conf
        count += 1

    raw_text = "\n".join(lines)
    avg_conf = (total_conf / count * 100) if count > 0 else 0.0

    return {
        "raw_text": raw_text,
        "normalized_text": normalize_text(raw_text),
        "confidence": round(avg_conf, 2),
        "error": None,
    }


def run_ocr_tesseract(image_path: str, preset: str) -> dict:
    """Fallback: Run OCR using Tesseract."""
    from PIL import Image, ImageEnhance

    try:
        img = Image.open(image_path)
    except Exception as e:
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": str(e)}

    # Basic preprocessing: grayscale + upscale
    img = img.convert("L")
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)

    try:
        import pytesseract
        data = pytesseract.image_to_data(img, lang="jpn+eng", output_type=pytesseract.Output.DICT)
        raw_text = pytesseract.image_to_string(img, lang="jpn+eng")
        confidences = [c for c in data["conf"] if c != -1]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        normalized = normalize_text(raw_text)
        return {
            "raw_text": raw_text,
            "normalized_text": normalized,
            "confidence": round(avg_confidence, 2),
            "error": None,
        }
    except Exception as e:
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": str(e)}


def run_ocr(image_path: str, preset: str = "default_ui") -> dict:
    """Run OCR on an image."""
    path = Path(image_path)
    if not path.exists():
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0,
                "error": f"File not found: {image_path}"}

    if RAPID_OCR is not None:
        try:
            return run_ocr_rapid(image_path)
        except Exception as e:
            sys.stderr.write(f"[ocr] RapidOCR failed: {e}\n")
            sys.stderr.flush()

    if TESSERACT:
        try:
            return run_ocr_tesseract(image_path, preset)
        except Exception as e:
            sys.stderr.write(f"[ocr] Tesseract failed: {e}\n")
            sys.stderr.flush()

    return {"raw_text": "", "normalized_text": "", "confidence": 0.0,
            "error": "No OCR engine available. Install: pip install rapidocr-onnxruntime"}


def main():
    sys.stderr.write(f"[ocr] engine: {'RapidOCR' if RAPID_OCR else 'Tesseract' if TESSERACT else 'NONE'}\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            result = {"raw_text": "", "normalized_text": "", "confidence": 0.0,
                      "error": f"Invalid JSON: {e}"}
            print(json.dumps(result), flush=True)
            continue

        image_path = request.get("image_path", "")
        preset = request.get("preset", "default_ui")

        result = run_ocr(image_path, preset)
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
