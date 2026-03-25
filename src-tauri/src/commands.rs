use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub fn register_hotkey(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyX);

    app.global_shortcut()
        .on_shortcut(shortcut, |app_handle, _shortcut, _event| {
            let _ = app_handle.emit("trigger-capture", ());
        })?;

    println!("Global hotkey registered: Ctrl+Shift+X");
    Ok(())
}
