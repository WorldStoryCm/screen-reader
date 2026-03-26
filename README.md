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

## Usage

### Download & Install

Go to the [Releases](https://github.com/WorldStoryCm/screen-reader/releases) page and download the latest installer for your platform:

| Platform | File |
|----------|------|
| Windows | `.msi` or `.exe` installer |
| macOS | `.dmg` |
| Linux | `.deb` / `.AppImage` |

### Windows Requirements

- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) — install to default path (`C:\Program Files\Tesseract-OCR\`)
  - During install, check **Additional language data** and select **Japanese**
- If Tesseract is not installed, the app falls back to Windows.Media.Ocr (PowerShell). This requires the [Japanese language pack](ms-settings:regionlanguage) installed via **Settings > Time & Language > Language**.

### macOS Requirements

- Tesseract (recommended): `brew install tesseract tesseract-lang`
- If Tesseract is not installed, the app falls back to the macOS Vision framework

### How to Use

1. Open the app (or use the system tray icon)
2. Press **Ctrl+Shift+X** or click **Capture** to screenshot your screen
3. **Left-drag** to select a text region — OCR runs automatically
4. **Scroll** to zoom in/out on the screenshot
5. **Right-drag** to pan around a zoomed image
6. **Middle-click** to reset zoom to 100%
7. Click any word in the results to copy it or create a flashcard
8. Manage cards in the **Cards** tab — set SRS levels, add readings/meanings
9. Browse past captures in **History**, re-tag or re-OCR them

### OCR Presets

Presets control how the image is processed before OCR. Set the default in Settings or pick per-capture in History when re-running OCR.

| Preset | Use case |
|--------|----------|
| `default_ui` | General game UI text (default) |
| `small_text` | Small or low-resolution fonts |
| `dark_bg` | Light text on dark backgrounds |
| `light_bg` | Dark text on light backgrounds |

All presets run through automatic preprocessing: grayscale conversion, 2x Lanczos upscale, and dark-background detection with inversion.

---

## Development

### Prerequisites

- [Rust](https://rustup.rs/) 1.70+
- [Bun](https://bun.sh/) (or Node.js 18+)
- [Tauri CLI v2](https://v2.tauri.app/start/prerequisites/)

**Windows** additionally requires:

- Visual Studio Build Tools (MSVC toolchain)
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) with Japanese language data

**macOS** additionally requires:

- Xcode Command Line Tools: `xcode-select --install`
- Tesseract (optional): `brew install tesseract tesseract-lang`

**Linux** additionally requires:

- System libs: `sudo apt install build-essential libssl-dev pkg-config libwebkit2gtk-4.1-dev`
- Tesseract: `sudo apt install tesseract-ocr tesseract-ocr-jpn`

### Setup & Run

```bash
# Install JS dependencies
bun install

# Run in development mode (hot-reload)
bun tauri dev

# Build for production
bun tauri build
```

Production builds are output to `src-tauri/target/release/bundle/`.

### Project Structure

```
src/                    # React frontend (Vite + Tailwind)
  features/
    MainView.tsx        # Main capture screen with zoom/pan/selection
    capture/            # OCR overlay, result panel, token popover
    cards/              # Flashcard management
    history/            # Capture history browser
    tags/               # Tag management
    settings/           # App settings
src-tauri/
  src/
    capture.rs          # Screen capture (xcap / screencapture)
    ocr.rs              # OCR engine (Tesseract / Vision / PowerShell)
    db.rs               # SQLite database
    commands.rs         # Global hotkey registration
  windows/ocr.ps1      # Windows.Media.Ocr fallback script
```

### Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Vite
- **Backend**: Rust, Tauri 2
- **OCR**: Tesseract (primary), macOS Vision / Windows.Media.Ocr (fallback)
- **Database**: SQLite via rusqlite (bundled)
- **Screen capture**: xcap crate

### Data Storage

- **Database**: `{APP_DATA}/db.sqlite` — captures, cards, tags, settings
- **Screenshots**: `{APP_DATA}/captures/` — cropped PNGs
- **Temp files**: `{TEMP}/game-ocr/` — full screenshots and preprocessed images
