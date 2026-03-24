# Japanese Game OCR Overlay — SPEC

## 1. Goal
Build a lightweight desktop overlay for Japanese-only games.

Primary use case:
- user presses a hotkey while a game is open
- app captures a selected screen region
- OCR extracts Japanese text
- extracted text is shown in a small overlay panel
- user can copy text to clipboard

The product is **not** a machine translator.
The core purpose is:
- get Japanese text out of the game quickly
- make lookup and manual learning easier
- avoid taking phone photos of the screen

---

## 2. Product principles

### Must be
- local-first
- fast to trigger
- simple enough to use while gaming
- useful without internet
- usable on modest hardware

### Must not be
- a heavy AI translation app
- a full-screen intrusive overlay
- dependent on cloud OCR or cloud translation
- overloaded with complex flashcard workflows in MVP1

---

## 3. Non-goals

Out of scope for MVP1:
- automatic translation
- AI-generated meanings
- sentence parsing by LLM
- live OCR on the whole screen continuously
- automatic furigana generation
- exporting directly to external Anki in first version
- OCR from game memory or engine internals

---

## 4. Target users
- one primary user
- Japanese learner playing Japanese PC games
- wants rapid text extraction from UI, dialogs, menus, item descriptions, battle screens
- prefers manual meaning entry over unreliable auto-translation

---

## 5. Core user stories

### MVP1
1. As a user, I want the app to run in background so I can trigger it without leaving the game.
2. As a user, I want to press a global hotkey and capture a screen region.
3. As a user, I want Japanese text extracted from that region.
4. As a user, I want to see the extracted text in a compact panel.
5. As a user, I want one-click copy to clipboard.
6. As a user, I want a capture history so I can retry if OCR was imperfect.

### MVP2
1. As a user, I want to tag captures by context, such as profile, battle, quest, item, dialogue.
2. As a user, I want to split text into word-like entries manually or semi-manually.
3. As a user, I want to store a Japanese word with my own reading and translation.
4. As a user, I want a minimal internal review/card database.
5. As a user, I want repeated captures and words to be searchable later.

---

## 6. High-level scope

## MVP1 scope
- background desktop app
- global hotkey
- rectangular screen-region capture
- local OCR for Japanese text
- results panel
- copy full text to clipboard
- copy selected line to clipboard
- local history of recent captures

## MVP2 scope
- tags on captures
- notes per capture
- manual word extraction workflow
- internal study cards
- word search / filter
- duplicate detection or linking between capture and saved card

---

## 7. Functional requirements

### 7.1 App lifecycle
- app starts manually or optionally on OS login
- app can minimize to tray/menu bar
- app keeps running in background
- app must expose a global hotkey even when game is focused

### 7.2 Capture flow
When hotkey is pressed:
1. app enters capture mode
2. user selects a region of the screen
3. selected region is saved as an image
4. preprocessing runs on the image
5. OCR runs on the processed image
6. result panel opens with extracted text and actions

### 7.3 OCR preprocessing
Preprocessing should be configurable because game UI text varies.
Initial supported operations:
- upscale x2 or x3
- grayscale
- contrast boost
- threshold / binarization
- sharpen

The user should be able to retry OCR with a different preset later.

### 7.4 OCR result panel
The result panel must support:
- show original extracted text
- preserve line breaks where possible
- copy all text
- copy a selected line or block
- recapture
- rerun OCR
- save to history

### 7.5 History
Each capture history record should include:
- capture id
- timestamp
- screenshot thumbnail or screenshot path
- OCR text
- preprocessing preset used
- optional tags
- optional notes

### 7.6 Tagging (MVP2)
Suggested tags:
- profile
- battle
- skill
- item
- shop
- ship
- quest
- faction
- map
- tutorial
- menu
- dialogue
- other

User must be able to:
- add one or more tags to a capture
- search captures by tag
- edit tags later

### 7.7 Word extraction (MVP2)
The system should support a manual-first workflow.

From a saved capture, user can:
- highlight a substring manually
- create a word entry from the selected text
- or create a word entry by pasting text manually

A word entry must have:
- japanese_text
- reading_manual
- translation_manual
- optional note
- source_capture_id
- created_at
- updated_at

### 7.8 Internal study cards (MVP2)
A card is a lightweight internal learning record.

Minimum fields:
- japanese_text
- reading_manual
- translation_manual
- note
- tags
- linked_capture_ids
- status: new | learning | known
- last_reviewed_at

Not required in MVP2:
- spaced repetition algorithm
- complex scheduling
- audio
- sentence generation

---

## 8. UX requirements

### 8.1 Capture mode UX
- trigger must feel instant
- screen should dim slightly during selection
- selection rectangle must be visible and easy to control
- escape should cancel capture mode

### 8.2 Result panel UX
- small and readable
- should not fully cover the game unnecessarily
- should be movable
- should support keyboard actions

Suggested actions:
- Enter: copy all
- Ctrl+C: copy selected
- R: rerun OCR
- Esc: close

### 8.3 Performance UX
- OCR should start within ~1 second after capture is taken
- if OCR takes longer, show a small processing state
- app should never freeze the whole UI during OCR

---

## 9. Technical constraints
- desktop app should use Tauri for low resource use and simple packaging
- OCR should run locally
- app should work without a powerful GPU
- avoid large local AI models
- should support Windows first; macOS later if needed

---

## 10. Proposed architecture

### Frontend
- Tauri app
- React UI for overlay windows and history/cards views

### Backend shell
- Tauri Rust commands for:
  - global hotkeys
  - screenshot capture
  - tray integration
  - file storage access
  - clipboard integration

### OCR engine
Preferred path:
- Python sidecar process using PaddleOCR or Tesseract

Reason:
- OCR ecosystem is stronger in Python
- easier to swap engines later
- frontend remains simple

### Storage
- SQLite
- lightweight ORM or direct queries

---

## 11. OCR engine strategy

### Option A: Tesseract
Pros:
- easier setup
- fully local
- lightweight

Cons:
- often worse on small game UI Japanese text

### Option B: PaddleOCR
Pros:
- better OCR quality on UI text in many cases
- better future ceiling

Cons:
- heavier install
- more setup complexity

### Recommendation
- design OCR layer as interface
- start with one engine that is easiest to ship
- keep engine replaceable

OCR interface:
- input: image path + preprocess preset
- output: extracted text + confidence if available + line/box data if available

Pipeline:

1. Capture region (PNG)
2. Preprocess:
  - upscale x2
  - grayscale
  - contrast boost
3. OCR engine:
  - primary: Tesseract (jpn)
  - fallback (future): PaddleOCR
4. Post-process:
  - trim spaces
  - normalize symbols
5. Output:
  - raw_text
  - normalized_text
  - 
---

Сейчас “capture screen” — слишком размыто
Modes:

1. Region capture (primary)
  - user selects rectangle
  - freeze frame
  - capture only region

2. Retry capture
  - reuse last region

3. Future:
  - pinned region

Tokenizer
Tokenizer:

Option A (MVP):
- TinySegmenter (fast, no deps)

Option B:
- Kuromoji.js (better accuracy)
_
Output:
- tokens[]
  - surface
  - start_idx
  - end_idx

Card creation:

Entry points:
- from token
- from full capture

Fields:
- jp_text (required)
- reading (manual)
- meaning (manual)

Rules:
- no duplicates (hash jp_text)
- allow edit later

Export:
- CSV (Anki format)

## 12. Data model

### Capture
- id
- created_at
- image_path
- ocr_text
- ocr_engine
- preprocess_preset
- width
- height
- tags_json
- note
- status

### WordCard
- id
- japanese_text
- reading_manual
- translation_manual
- note
- status
- created_at
- updated_at

### WordCardCaptureLink
- id
- word_card_id
- capture_id
- source_text_fragment

### AppSetting
- key
- value_json

---

## 13. Settings
Minimum settings:
- global hotkey
- OCR engine
- preprocess preset default
- auto-save captures on/off
- start with OS on/off
- store screenshots on disk on/off
- result panel position memory on/off

---

## 14. Error handling
- if capture fails, show short error and allow retry
- if OCR fails, keep screenshot and allow rerun
- if clipboard copy fails, show explicit error
- app must never discard capture silently

---

## 15. Observability
Need lightweight diagnostics:
- last OCR duration
- last capture duration
- OCR engine used
- last error message
- logs stored locally

No heavy telemetry required.

---

## 16. Security and privacy
- all screenshots and OCR text stay local by default
- no cloud upload unless later explicitly added
- user should be able to delete history and screenshots

---

## 17. Open product questions

### Q1. Should Anki be inside the overlay?
Recommendation: **no for MVP1, limited yes for MVP2**.

Best approach:
- keep overlay focused on capture -> OCR -> copy
- open a separate small app panel or library view for cards/history

Why:
- overlay should stay fast and simple
- card management inside the overlay will bloat the core flow
- reviewing cards is a different mode from capturing game text

Recommended compromise:
- overlay contains a single action: `Save as card`
- actual editing and studying happens in a compact library/study screen

### Q2. Should words be auto-separated?
Recommendation:
- support manual selection first
- later optionally add tokenizer support

Why:
- Japanese auto-segmentation without strong dictionary support can be messy
- manual-first is slower but more accurate for your use case

### Q3. Should screenshots be stored always?
Recommendation:
- yes by default for MVP1
- add cleanup controls later

Reason:
- useful for OCR retry
- useful for linking study cards to source context

---

## 18. Success criteria

### MVP1 success
- app runs in background reliably
- hotkey capture works inside a game
- Japanese OCR returns usable text often enough to be worth using
- copy-to-clipboard is one click
- process is faster and less annoying than phone-photo workflow

### MVP2 success
- user can build a small manual word deck from captured text
- user can link saved words to source screenshots
- user can search by tags and revisit previous captures

---

## 19. Future ideas
- box/line OCR overlays on top of screenshot
- click a line to copy only that line
- built-in dictionary lookup via browser or external tools
- import/export cards as CSV
- optional Anki export package later
- duplicate card suggestions
- keyboard-only flow for faster gaming use
- image cleanup presets tuned per game

---

## 20. Recommended delivery plan

### Phase 1
- tray app
- hotkey
- region capture
- OCR
- result panel
- copy to clipboard
- save history

### Phase 2
- tags
- notes
- screenshot thumbnails
- OCR retry presets

### Phase 3
- manual card creation
- card library
- search/filter
- capture-to-card linking

### Phase 4
- optional CSV / Anki export
- optional tokenization assist
- optional review mode
