# DB_SCHEMA.md

## Tables

### captures
- id (uuid, pk)
- created_at (timestamp)
- image_path (text)
- ocr_text (text)
- normalized_text (text)
- screen_tag (text) -- e.g. profile, battle, shop
- hash (text, unique) -- for dedup

### tokens
- id (uuid, pk)
- capture_id (fk -> captures.id)
- surface (text) -- JP token
- start_idx (int)
- end_idx (int)

### cards
- id (uuid, pk)
- token_id (fk -> tokens.id) nullable
- jp_text (text)
- reading (text) -- user entered
- meaning (text) -- user entered
- notes (text)
- created_at (timestamp)

### tags
- id (uuid, pk)
- name (text, unique)

### card_tags
- card_id (fk -> cards.id)
- tag_id (fk -> tags.id)

### settings
- key (text, pk)
- value (text)

## Indexes
- captures.hash (unique)
- tokens.capture_id
- cards.token_id