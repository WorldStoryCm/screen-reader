# Phase 1: App Shell & Foundation

## Goal
Set up Tauri app as a background tray app with global hotkey support.

## Tasks

### 1.1 Project cleanup
- [ ] Remove default Tauri greeting template (App.tsx, lib.rs)
- [ ] Set up folder structure: `src/features/`, `src/components/`, `src/lib/`, `src/types/`
- [ ] Add Tailwind CSS for styling

### 1.2 Tray integration
- [ ] Add `tauri-plugin-system-tray` / system tray support
- [ ] App minimizes to tray on close
- [ ] Tray icon with context menu (Show, Capture, Quit)
- [ ] App starts minimized to tray

### 1.3 Window management
- [ ] Main window: hidden by default, shown from tray
- [ ] Configure always-on-top for overlay windows
- [ ] Configure transparent/frameless window for capture overlay

### 1.4 Global hotkey
- [ ] Add `tauri-plugin-global-shortcut`
- [ ] Register default hotkey (Ctrl+Shift+X / Cmd+Shift+X)
- [ ] Hotkey triggers capture mode event
- [ ] Hotkey works when app is in background / game is focused

### 1.5 Basic app lifecycle
- [ ] App keeps running in background
- [ ] Graceful shutdown from tray
- [ ] Error handling for hotkey registration failures

## Exit criteria
- App runs in tray, hotkey triggers an event visible in console/logs.
