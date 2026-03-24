#!/usr/bin/env python3
"""OCR sidecar service for Game OCR app.

Reads JSON requests from stdin, processes images, runs Tesseract OCR,
and writes JSON results to stdout.

Protocol:
  Input:  {"image_path": "...", "preset": "default_ui"}
  Output: {"raw_text": "...", "normalized_text": "...", "confidence": 0.0, "error": null}
"""

import json
import sys
import unicodedata
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    print(json.dumps({"error": "Pillow not installed. Run: pip install Pillow"}), flush=True)
    sys.exit(1)

try:
    import pytesseract
except ImportError:
    print(json.dumps({"error": "pytesseract not installed. Run: pip install pytesseract"}), flush=True)
    sys.exit(1)


# --- Preprocessing presets ---

def preset_default_ui(img: Image.Image) -> Image.Image:
    """Default for game UI text: grayscale + upscale x2."""
    img = img.convert("L")
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    return img


def preset_small_text(img: Image.Image) -> Image.Image:
    """For small text: upscale x3 + sharpen + high contrast."""
    img = img.convert("L")
    img = img.resize((img.width * 3, img.height * 3), Image.LANCZOS)
    img = img.filter(ImageFilter.SHARPEN)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)
    return img


def preset_dark_bg(img: Image.Image) -> Image.Image:
    """For light text on dark background: invert + grayscale + upscale x2."""
    img = img.convert("L")
    from PIL import ImageOps
    img = ImageOps.invert(img)
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    return img


def preset_light_bg(img: Image.Image) -> Image.Image:
    """For dark text on light background: grayscale + threshold + upscale x2."""
    img = img.convert("L")
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    img = img.point(lambda x: 0 if x < 128 else 255, "1")
    return img


PRESETS = {
    "default_ui": preset_default_ui,
    "small_text": preset_small_text,
    "dark_bg": preset_dark_bg,
    "light_bg": preset_light_bg,
}


def normalize_text(text: str) -> str:
    """Normalize OCR output: trim, normalize unicode, clean whitespace."""
    text = unicodedata.normalize("NFKC", text)
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            lines.append(stripped)
    return "\n".join(lines)


def run_ocr(image_path: str, preset: str = "default_ui") -> dict:
    """Run OCR on an image with the specified preprocessing preset."""
    path = Path(image_path)
    if not path.exists():
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": f"File not found: {image_path}"}

    try:
        img = Image.open(path)
    except Exception as e:
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": f"Failed to open image: {e}"}

    # Apply preprocessing
    preprocess_fn = PRESETS.get(preset, preset_default_ui)
    try:
        processed = preprocess_fn(img)
    except Exception as e:
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": f"Preprocessing failed: {e}"}

    # Run Tesseract
    try:
        # Get text with confidence data
        data = pytesseract.image_to_data(processed, lang="jpn", output_type=pytesseract.Output.DICT)
        raw_text = pytesseract.image_to_string(processed, lang="jpn")

        # Calculate average confidence (excluding -1 which means no text)
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
        return {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": f"OCR failed: {e}"}


def main():
    """Main loop: read JSON from stdin, run OCR, write JSON to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            result = {"raw_text": "", "normalized_text": "", "confidence": 0.0, "error": f"Invalid JSON: {e}"}
            print(json.dumps(result), flush=True)
            continue

        image_path = request.get("image_path", "")
        preset = request.get("preset", "default_ui")

        result = run_ocr(image_path, preset)
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
