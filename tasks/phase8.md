# Phase 8: Search, Export & Polish (MVP2 complete)

## Goal
Complete MVP2 with search, export, and UX polish.

## Tasks

### 8.1 Search & filter
- [ ] Global search across captures and cards
- [ ] Search by Japanese text, reading, meaning, notes
- [ ] Filter captures by date range
- [ ] Filter by tag combination
- [ ] Duplicate detection (same jp_text or similar OCR text via hash)

### 8.2 CSV / Anki export
- [ ] Export cards as CSV (columns: jp_text, reading, meaning, tags, notes)
- [ ] CSV format compatible with Anki import
- [ ] Export selected cards or all cards
- [ ] Export captures list as CSV (optional)

### 8.3 Settings UI
- [ ] Full settings page:
  - Global hotkey configuration
  - Default OCR engine / preset
  - Auto-save captures on/off
  - Auto-copy on/off
  - Store screenshots on disk on/off
  - Result panel position memory on/off
- [ ] Persist all settings in DB

### 8.4 UX polish
- [ ] Keyboard-only flow improvements
- [ ] Smooth transitions between capture → result → history
- [ ] Consistent styling across all views
- [ ] Error messages for all failure states
- [ ] Cleanup controls for old captures / screenshots

### 8.5 Optional enhancements
- [ ] Kuromoji.js as alternative tokenizer (better accuracy)
- [ ] Basic review mode (flip card, mark known/learning)
- [ ] Pinned region capture (reuse exact region without redrawing)

## Exit criteria
- MVP2 complete: user can capture → OCR → tag → create cards → search → export. Full study workflow from game text.
