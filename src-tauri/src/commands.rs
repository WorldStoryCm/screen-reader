use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::db::DbState;

/// Parse a hotkey string like "Ctrl+Shift+X" into a Shortcut.
fn parse_hotkey(s: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    if parts.is_empty() {
        return Err("Empty hotkey".into());
    }

    let mut mods = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in &parts {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift" => mods |= Modifiers::SHIFT,
            "alt" | "option" => mods |= Modifiers::ALT,
            "meta" | "super" | "cmd" | "command" => mods |= Modifiers::META,
            key => {
                key_code = Some(str_to_code(key)?);
            }
        }
    }

    let code = key_code.ok_or_else(|| format!("No key found in hotkey: {}", s))?;
    let mods_opt = if mods.is_empty() { None } else { Some(mods) };
    Ok(Shortcut::new(mods_opt, code))
}

fn str_to_code(s: &str) -> Result<Code, String> {
    match s.to_lowercase().as_str() {
        "a" => Ok(Code::KeyA), "b" => Ok(Code::KeyB), "c" => Ok(Code::KeyC),
        "d" => Ok(Code::KeyD), "e" => Ok(Code::KeyE), "f" => Ok(Code::KeyF),
        "g" => Ok(Code::KeyG), "h" => Ok(Code::KeyH), "i" => Ok(Code::KeyI),
        "j" => Ok(Code::KeyJ), "k" => Ok(Code::KeyK), "l" => Ok(Code::KeyL),
        "m" => Ok(Code::KeyM), "n" => Ok(Code::KeyN), "o" => Ok(Code::KeyO),
        "p" => Ok(Code::KeyP), "q" => Ok(Code::KeyQ), "r" => Ok(Code::KeyR),
        "s" => Ok(Code::KeyS), "t" => Ok(Code::KeyT), "u" => Ok(Code::KeyU),
        "v" => Ok(Code::KeyV), "w" => Ok(Code::KeyW), "x" => Ok(Code::KeyX),
        "y" => Ok(Code::KeyY), "z" => Ok(Code::KeyZ),
        "0" => Ok(Code::Digit0), "1" => Ok(Code::Digit1), "2" => Ok(Code::Digit2),
        "3" => Ok(Code::Digit3), "4" => Ok(Code::Digit4), "5" => Ok(Code::Digit5),
        "6" => Ok(Code::Digit6), "7" => Ok(Code::Digit7), "8" => Ok(Code::Digit8),
        "9" => Ok(Code::Digit9),
        "f1" => Ok(Code::F1), "f2" => Ok(Code::F2), "f3" => Ok(Code::F3),
        "f4" => Ok(Code::F4), "f5" => Ok(Code::F5), "f6" => Ok(Code::F6),
        "f7" => Ok(Code::F7), "f8" => Ok(Code::F8), "f9" => Ok(Code::F9),
        "f10" => Ok(Code::F10), "f11" => Ok(Code::F11), "f12" => Ok(Code::F12),
        "space" => Ok(Code::Space),
        "enter" | "return" => Ok(Code::Enter),
        "escape" | "esc" => Ok(Code::Escape),
        "backspace" => Ok(Code::Backspace),
        "tab" => Ok(Code::Tab),
        "delete" => Ok(Code::Delete),
        "home" => Ok(Code::Home), "end" => Ok(Code::End),
        "pageup" => Ok(Code::PageUp), "pagedown" => Ok(Code::PageDown),
        "arrowup" | "up" => Ok(Code::ArrowUp),
        "arrowdown" | "down" => Ok(Code::ArrowDown),
        "arrowleft" | "left" => Ok(Code::ArrowLeft),
        "arrowright" | "right" => Ok(Code::ArrowRight),
        "printscreen" => Ok(Code::PrintScreen),
        "insert" => Ok(Code::Insert),
        "," | "comma" => Ok(Code::Comma),
        "." | "period" => Ok(Code::Period),
        "/" | "slash" => Ok(Code::Slash),
        "`" | "backquote" => Ok(Code::Backquote),
        "-" | "minus" => Ok(Code::Minus),
        "=" | "equal" => Ok(Code::Equal),
        "[" | "bracketleft" => Ok(Code::BracketLeft),
        "]" | "bracketright" => Ok(Code::BracketRight),
        "\\" | "backslash" => Ok(Code::Backslash),
        ";" | "semicolon" => Ok(Code::Semicolon),
        "'" | "quote" => Ok(Code::Quote),
        other => Err(format!("Unknown key: {}", other)),
    }
}

pub fn register_hotkey(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Try to load saved hotkey from DB, fall back to default
    let hotkey_str = {
        let db_state = app.state::<DbState>();
        let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'hotkey'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "Ctrl+Shift+X".to_string())
    };

    let shortcut = parse_hotkey(&hotkey_str).map_err(|e| {
        eprintln!("Failed to parse saved hotkey '{}': {}, using default", hotkey_str, e);
        e
    }).unwrap_or_else(|_| Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyX));

    app.global_shortcut()
        .on_shortcut(shortcut, |app_handle, _shortcut, _event| {
            let _ = app_handle.emit("trigger-capture", ());
        })?;

    println!("Global hotkey registered: {}", hotkey_str);
    Ok(())
}

#[tauri::command]
pub fn update_hotkey(app: AppHandle, state: State<DbState>, hotkey: String) -> Result<(), String> {
    // Parse first to validate
    let new_shortcut = parse_hotkey(&hotkey)?;

    // Unregister all existing shortcuts
    app.global_shortcut().unregister_all().map_err(|e| e.to_string())?;

    // Register the new one
    app.global_shortcut()
        .on_shortcut(new_shortcut, |app_handle, _shortcut, _event| {
            let _ = app_handle.emit("trigger-capture", ());
        })
        .map_err(|e| e.to_string())?;

    // Save to DB
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('hotkey', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![hotkey],
    )
    .map_err(|e| e.to_string())?;

    // Notify frontend
    let _ = app.emit("hotkey-changed", &hotkey);

    println!("Global hotkey updated: {}", hotkey);
    Ok(())
}
