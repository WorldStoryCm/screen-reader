"""Build script: creates a standalone OCR executable using PyInstaller.
Run: python build_ocr.py
Output: dist/ocr_service/ocr_service.exe (Windows) or dist/ocr_service/ocr_service (macOS/Linux)
"""
import subprocess
import sys

subprocess.check_call([
    sys.executable, "-m", "PyInstaller",
    "--name", "ocr_service",
    "--onedir",
    "--console",
    "--noconfirm",
    "--clean",
    # Collect RapidOCR models and data
    "--collect-data", "rapidocr_onnxruntime",
    "--hidden-import", "rapidocr_onnxruntime",
    "ocr_service/ocr_service.py",
])
