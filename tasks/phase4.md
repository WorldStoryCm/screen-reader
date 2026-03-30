# Phase 4: Result Panel & Clipboard

## Goal
Display OCR results in a compact overlay panel with copy-to-clipboard actions.

## Tasks

### 4.1 Result panel window
- [ ] Create floating result panel (small, always-on-top)
- [ ] Panel is movable (draggable title bar)
- [ ] Panel does not fully cover the game
- [ ] Panel remembers last position (optional)

### 4.2 OCR text display
- [ ] Show extracted text preserving line breaks
- [ ] Loading indicator while OCR is processing
- [ ] Error state if OCR fails

### 4.3 Clipboard actions
- [ ] "Copy All" button — copies full OCR text
- [ ] Click a line to select it, "Copy Selected" copies that line
- [ ] Auto-copy toggle (copy automatically after OCR completes)
- [ ] Tauri Rust command for clipboard write

### 4.4 Panel actions
- [ ] "Rerun OCR" button — reruns with different preset
- [ ] "Recapture" button — re-opens capture overlay
- [ ] "Save" button — saves to history
- [ ] "Close" button / Escape to dismiss

### 4.5 Keyboard shortcuts in panel
- [ ] Enter → copy all
- [ ] Ctrl+C / Cmd+C → copy selected
- [ ] R → rerun OCR
- [ ] Esc → close panel

## Exit criteria
- After OCR, panel shows text. User can copy to clipboard in one click. Panel is usable alongside a game.
