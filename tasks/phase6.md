# Phase 6: Tags, Notes & OCR Presets (MVP2 start)

## Goal
Add tagging, notes, and OCR preset management to captures.

## Tasks

### 6.1 Tagging system
- [ ] Create `tags` table (id, name unique)
- [ ] Seed default tags: profile, battle, skill, item, shop, quest, dialogue, menu, map, tutorial, other
- [ ] Add tag assignment UI on result panel ("Save as card" becomes tag + save)
- [ ] Multi-tag support per capture (tags_json or join table)

### 6.2 Tag management
- [ ] Filter captures by tag in history view
- [ ] Edit tags on existing captures
- [ ] Create custom tags
- [ ] Tag counts / summary in sidebar

### 6.3 Notes on captures
- [ ] Add editable note field to capture detail view
- [ ] Save/update note in DB
- [ ] Show note preview in history list

### 6.4 OCR preset management
- [ ] Preset selector dropdown in result panel
- [ ] Show which preset was used
- [ ] Compare results between presets (side by side optional)
- [ ] Preset editor in settings (future)

### 6.5 Screenshot thumbnails
- [ ] Generate thumbnails for captures
- [ ] Show thumbnails in history list
- [ ] Click thumbnail to view full screenshot

## Exit criteria
- Captures can be tagged, annotated, and filtered. OCR can be retried with named presets.
