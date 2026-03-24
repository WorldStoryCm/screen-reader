use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::capture;

pub fn register_hotkey(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyX);

    app.global_shortcut()
        .on_shortcut(shortcut, |app_handle, _shortcut, _event| {
            let _ = capture::open_capture_overlay(app_handle.clone());
        })?;

    println!("Global hotkey registered: Ctrl+Shift+X");
    Ok(())
}
