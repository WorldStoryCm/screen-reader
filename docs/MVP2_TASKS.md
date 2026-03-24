# MVP2_TASKS.md

## Goal
Add learning + tagging + card system

## Tasks

### Tagging
- [ ] add screen tags (profile, battle, shop, etc.)
- [ ] assign tag to capture

### Tokenization
- [ ] integrate tokenizer (TinySegmenter or Kuromoji)
- [ ] split OCR text into tokens
- [ ] clickable tokens

### Cards
- [ ] create card from token or full text
- [ ] fields:
  - jp_text
  - reading (manual)
  - meaning (manual)
- [ ] save to DB

### Card UI
- [ ] card editor screen
- [ ] list cards
- [ ] search cards

### History
- [ ] list past captures
- [ ] open capture → tokens view

### Export
- [ ] export cards as CSV (Anki compatible)

### Settings
- [ ] OCR language config
- [ ] auto-copy toggle