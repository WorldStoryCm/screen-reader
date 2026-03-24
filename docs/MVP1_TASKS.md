# MVP1_TASKS.md

## Goal
Hotkey → select region → OCR → show text → copy to clipboard

## Tasks

### App shell (Tauri)
- [ ] create Tauri app
- [ ] always-on-top window
- [ ] transparent overlay

### Input
- [ ] global hotkey (Ctrl+Shift+X)
- [ ] region selection UI (drag rectangle)
- [ ] screenshot selected region

### OCR
- [ ] integrate Tesseract (jpn)
- [ ] basic preprocessing (grayscale + upscale)
- [ ] return raw text

### Output
- [ ] floating result panel
- [ ] show OCR text
- [ ] "Copy" button
- [ ] auto-copy toggle

### Storage (minimal)
- [ ] store last N captures (optional)

### UX polish
- [ ] loading indicator
- [ ] retry OCR