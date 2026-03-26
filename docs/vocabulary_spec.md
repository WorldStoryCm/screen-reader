# Vocabulary Import/Export Specification

## Goal
Global vocabulary system with import/export support.

---

## Core Model

### VocabEntry
- id
- language (ja)
- original
- normalizedOriginal
- reading
- translation
- meaning
- notes
- category (stat, combat, trade, ship, ui, etc.)
- stage (I–V)
- createdAt
- updatedAt

---

### Source
- id
- type (game, app, ocr, screenshot, manual, import)
- name

---

### EntrySource (many-to-many)
- entryId
- sourceId
- contextText
- screenName

---

### Encounter
- entryId
- sourceId
- contextText
- encounteredAt

---

### Tags
- id
- name

---

## Rules

- One global dictionary
- No duplicates (by normalizedOriginal)
- Same word can link to many sources
- Encounters tracked separately
- Manual stage control (I–V)

---

## Import / Export

### Format: JSON

### Export structure:
{
  "version": 1,
  "entries": [],
  "sources": [],
  "entrySources": [],
  "encounters": [],
  "tags": [],
  "entryTags": []
}

---

### Import modes
- skip-existing
- update-existing
- import-as-new

---

## Minimal Import Example

{
  "version": 1,
  "entries": [
    {
      "original": "交渉",
      "reading": "こうしょう",
      "translation": "Negotiation",
      "category": "stat",
      "stage": "I"
    }
  ]
}
