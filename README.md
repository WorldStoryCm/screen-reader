# Game OCR — Japanese Screen Reader

Desktop tool for extracting Japanese text from games. Capture your screen, select a region, run OCR, and build a vocabulary flashcard deck — all in one app.

Built with Tauri 2, React, and Rust.

## Features

- **Screen capture** with global hotkey (Ctrl+Shift+X) and region selection
- **Japanese OCR** via Tesseract with automatic image preprocessing (upscale, dark background inversion)
- **Word tokenization** using `Intl.Segmenter` — click any word to create a flashcard
- **Flashcard system** with 5 SRS levels (New → Learned), color-coded in text
- **Capture history** with tags, notes, and re-OCR support
- **Tag system** for organizing captures and cards
- **TSV export** for flashcard decks
- **System tray** with quick capture

## Prerequisites

### All platforms

- [Rust](https://rustup.rs/) 1.70+
- [Bun](https://bun.sh/) (or Node.js)
- [Tauri CLI v2](https://v2.tauri.app/start/prerequisites/)

### Windows

- Visual Studio Build Tools (MSVC toolchain)
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) — install to default path (`C:\Program Files\Tesseract-OCR\`)
  - During install, check **Additional language data** and select **Japanese**
  - Falls back to Windows.Media.Ocr (PowerShell) if Tesseract is not found — requires [Japanese language pack](ms-settings:regionlanguage) installed via Settings > Time & Language > Language

### macOS

- Xcode Command Line Tools: `xcode-select --install`
- Tesseract (recommended): `brew install tesseract tesseract-lang`
- Falls back to macOS Vision framework if Tesseract is not found

### Linux

- System dependencies: `sudo apt install build-essential libssl-dev pkg-config libwebkit2gtk-4.1-dev`
- Tesseract: `sudo apt install tesseract-ocr tesseract-ocr-jpn`

## Setup

```bash
bun install
bun tauri dev
```

To build for production:

```bash
bun tauri build
```

## OCR Presets

Presets control how the image is processed before OCR. You can set the default in Settings or pick per-capture in History when re-running OCR.

| Preset | Use case |
|--------|----------|
| `default_ui` | General game UI text (default) |
| `small_text` | Small or low-resolution fonts |
| `dark_bg` | Light text on dark backgrounds |
| `light_bg` | Dark text on light backgrounds |

All presets run through automatic preprocessing: grayscale conversion, 2x Lanczos upscale, and dark-background detection with inversion.

## Usage

1. Open the app (or use the system tray icon)
2. Press **Ctrl+Shift+X** or click **Capture** to screenshot your screen
3. Drag to select the text region on the screenshot
4. OCR runs automatically — results appear below with confidence score
5. Click any word to copy it or create a flashcard
6. Manage cards in the **Cards** tab — set SRS levels, add readings/meanings
7. Browse past captures in **History**, re-tag or re-OCR them

## Project Structure

```
src/                    # React frontend
src-tauri/
  src/
    capture.rs          # Screen capture (xcap / screencapture)
    ocr.rs              # OCR engine (Tesseract / Vision / PowerShell)
    db.rs               # SQLite database
    commands.rs         # Global hotkey registration
  windows/ocr.ps1      # Windows.Media.Ocr fallback script
```

## Data Storage

- **Database**: `{APP_DATA}/db.sqlite` — captures, cards, tags, settings
- **Screenshots**: `{APP_DATA}/captures/` — cropped PNGs
- **Temp files**: `{TEMP}/game-ocr/` — full screenshots and preprocessed images
