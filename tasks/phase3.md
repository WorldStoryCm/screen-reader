# Phase 3: OCR Pipeline

## Goal
Run local Japanese OCR on captured images and return extracted text.

## Tasks

### 3.1 OCR engine setup
- [ ] Set up Python sidecar directory (`python/ocr_service/`)
- [ ] Install Tesseract with Japanese language data (`jpn`, `jpn_vert`)
- [ ] Create Python OCR script (`ocr_service.py`)
- [ ] OCR interface: `process_image(image_path, preset) → { raw_text, normalized_text, confidence }`

### 3.2 Image preprocessing
- [ ] Implement preprocessing pipeline in Python (Pillow/OpenCV):
  - Upscale x2 / x3
  - Grayscale conversion
  - Contrast boost
  - Threshold / binarization
  - Sharpen
- [ ] Define named presets:
  - `default_ui` — grayscale + upscale x2
  - `small_text` — upscale x3 + sharpen + contrast
  - `dark_bg` — invert + grayscale + upscale x2
  - `light_bg` — grayscale + threshold + upscale x2

### 3.3 Tauri ↔ Python sidecar communication
- [ ] Spawn Python process from Tauri (sidecar or command)
- [ ] Send image path + preset to Python via stdin/stdout JSON or CLI args
- [ ] Receive OCR result as JSON
- [ ] Handle sidecar startup errors and timeouts

### 3.4 Post-processing
- [ ] Trim whitespace
- [ ] Normalize full-width/half-width symbols
- [ ] Preserve line breaks from OCR output

### 3.5 OCR retry
- [ ] Allow rerunning OCR on same image with different preset
- [ ] Track which preset was used per capture

## Exit criteria
- Given a captured PNG, OCR returns readable Japanese text. Different presets produce different results.
