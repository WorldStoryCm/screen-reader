# Phase 2: Screen Capture

## Goal
Hotkey triggers a region-selection overlay; selected region is saved as PNG.

## Tasks

### 2.1 Capture overlay window
- [ ] Create a fullscreen transparent overlay window
- [ ] Dim the screen slightly when overlay is active
- [ ] Show crosshair cursor
- [ ] Escape cancels capture mode and closes overlay

### 2.2 Region selection
- [ ] Mouse drag to draw selection rectangle
- [ ] Visual rectangle with border during drag
- [ ] Show pixel dimensions of selection (optional)
- [ ] Release mouse to confirm selection

### 2.3 Screenshot capture (Rust side)
- [ ] Use `xcap` or `screenshots` crate for screen capture
- [ ] Capture the selected region coordinates
- [ ] Crop the full screenshot to selected region
- [ ] Save cropped image as PNG to app data folder (`captures/YYYY/`)

### 2.4 Capture flow wiring
- [ ] Hotkey → open capture overlay
- [ ] Selection complete → capture region → close overlay
- [ ] Pass captured image path to frontend for OCR step
- [ ] "Retry capture" — reuse last region coordinates

## Exit criteria
- Pressing hotkey opens overlay, selecting region saves a PNG, path is available to next step.
