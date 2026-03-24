# Japanese Game OCR Overlay — Architecture Notes

## 1. Recommended stack
- Tauri
- React + TypeScript
- SQLite
- Python OCR sidecar

## 2. Why this stack
- Tauri keeps desktop footprint smaller than Electron
- React is fine for overlay windows, history, settings, and card management
- SQLite is enough for local-first persistence
- Python sidecar gives better OCR ecosystem without forcing the whole app into Python

## 3. Main modules

### Desktop shell
Responsibilities:
- app startup
- tray/menu bar integration
- global hotkey registration
- spawn OCR sidecar
- manage file paths
- clipboard access
- screenshot capture bridge

### Capture module
Responsibilities:
- full-screen dim overlay
- drag-to-select rectangle
- capture selected region
- save image file
- send to OCR pipeline

### OCR module
Responsibilities:
- receive image path
- preprocess image with selected preset
- run OCR engine
- return raw text and optional line boxes/confidence

### Result panel
Responsibilities:
- display OCR result
- copy all text
- copy selected block
- rerun OCR
- save tags / note
- create card from selection later

### History module
Responsibilities:
- list previous captures
- open details
- edit tags
- re-run OCR from stored screenshot

### Card module
Responsibilities:
- create/edit internal study cards
- link cards to one or more captures
- search/filter cards

## 4. Suggested folders

```text
src/
  app/
  components/
  features/
    capture/
    ocr/
    history/
    cards/
    settings/
  db/
  lib/
  types/
src-tauri/
python/
  ocr_service/
```

## 5. IPC boundaries

### Tauri commands
- register_hotkey
- unregister_hotkey
- capture_region
- copy_to_clipboard
- save_capture
- list_captures
- create_card
- update_card

### OCR sidecar API
- process_image(image_path, preset)
- list_engines()
- list_presets()

## 6. Persistence strategy

### Files on disk
Store screenshots on disk in app data folder.
Suggested structure:

```text
app-data/
  captures/
    2026/
    2027/
  logs/
  db.sqlite
```

### DB only stores metadata
Do not store full image blobs in SQLite for MVP.
Store file paths only.

## 7. OCR preset strategy
Start with named presets instead of many knobs.

Suggested presets:
- default_ui
- small_text_high_contrast
- blurry_ui
- white_text_dark_bg
- dark_text_light_bg

This is easier for users than exposing raw preprocessing values first.

## 8. Performance strategy
- do not run live OCR continuously
- OCR only on explicit capture
- process in background thread/process
- cache OCR result per image hash + preset when possible

## 9. Risks
- OCR quality on stylized fonts
- screen capture permission issues per OS
- overlay conflicts with some fullscreen games
- packaging Python sidecar cleanly

## 10. Mitigations
- prefer borderless windowed game mode where needed
- allow retry with multiple presets
- keep OCR engine replaceable
- keep logs for bad captures and OCR errors
