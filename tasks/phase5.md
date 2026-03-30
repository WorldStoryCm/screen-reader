# Phase 5: Storage & History (MVP1 complete)

## Goal
Persist captures in SQLite and provide a history view.

## Tasks

### 5.1 SQLite setup
- [ ] Add SQLite dependency to Tauri (e.g. `rusqlite` or `tauri-plugin-sql`)
- [ ] Create DB file in app data directory
- [ ] Run migrations on app start
- [ ] Create `captures` table:
  - id (TEXT, uuid, PK)
  - created_at (TEXT, ISO timestamp)
  - image_path (TEXT)
  - ocr_text (TEXT)
  - normalized_text (TEXT)
  - ocr_engine (TEXT)
  - preprocess_preset (TEXT)
  - width (INTEGER)
  - height (INTEGER)
  - tags_json (TEXT, nullable)
  - note (TEXT, nullable)
  - status (TEXT, default 'active')
  - hash (TEXT, unique)
- [ ] Create `settings` table:
  - key (TEXT, PK)
  - value (TEXT)

### 5.2 Capture persistence
- [ ] Auto-save capture to DB after OCR completes
- [ ] Store image hash for dedup detection
- [ ] Tauri commands: `save_capture`, `get_capture`, `list_captures`, `delete_capture`

### 5.3 History UI
- [ ] History page/panel listing past captures
- [ ] Each entry shows: thumbnail, OCR text preview, timestamp
- [ ] Click entry to view full OCR text
- [ ] Re-run OCR from history entry
- [ ] Delete capture from history

### 5.4 Settings persistence
- [ ] Save/load hotkey preference
- [ ] Save/load default OCR preset
- [ ] Save/load auto-copy preference
- [ ] Basic settings UI page

### 5.5 Diagnostics
- [ ] Track last OCR duration
- [ ] Track last capture duration
- [ ] Log errors locally

## Exit criteria
- MVP1 complete: hotkey → capture → OCR → result panel → copy → saved to history. Usable during real gameplay.
