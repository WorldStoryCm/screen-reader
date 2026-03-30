# Phase 7: Tokenization & Word Cards (MVP2 core)

## Goal
Extract words from OCR text and build an internal study card system.

## Tasks

### 7.1 Tokenizer integration
- [ ] Integrate TinySegmenter (JS, no deps) for MVP
- [ ] Split OCR text into tokens: `{ surface, start_idx, end_idx }`
- [ ] Create `tokens` table (id, capture_id, surface, start_idx, end_idx)
- [ ] Store tokens per capture

### 7.2 Tokenized text view
- [ ] In capture detail, show text with clickable token boundaries
- [ ] Highlight individual tokens on hover
- [ ] Click token to select it for card creation
- [ ] Manual text selection also supported (highlight substring)

### 7.3 Card creation
- [ ] Create `cards` table (id, token_id nullable, jp_text, reading, meaning, notes, status, created_at, updated_at)
- [ ] Create `card_tags` join table
- [ ] Card editor: jp_text (prefilled), reading (manual), meaning (manual), tags, note
- [ ] Save card to DB
- [ ] Link card to source capture via `WordCardCaptureLink` / direct FK

### 7.4 Card list UI
- [ ] Card library page listing all cards
- [ ] Show: jp_text, reading, meaning, tags, created date
- [ ] Filter by tag
- [ ] Filter by status (new / learning / known)
- [ ] Search by jp_text or meaning

### 7.5 Card editing
- [ ] Edit existing cards
- [ ] Change status (new → learning → known)
- [ ] View linked capture(s) from card detail

## Exit criteria
- User can click tokens or select text to create cards. Cards are stored, searchable, and linked to captures.
