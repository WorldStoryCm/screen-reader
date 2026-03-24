use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

mod capture;
mod commands;
mod db;
mod ocr;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ocr_state = ocr::OcrState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ocr_state)
        .setup(|app| {
            // Initialize database
            let db_state = db::init_db(app).map_err(|e| e.to_string())?;
            app.manage(db_state);

            // Initialize OCR state
            let state = app.state::<ocr::OcrState>();
            ocr::init_ocr_state(app, &state);

            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let capture_item =
                MenuItem::with_id(app, "capture", "Capture", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &capture_item, &quit_item])?;

            // Build tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "capture" => {
                        let _ = capture::open_capture_overlay(app.clone());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Register global hotkey
            commands::register_hotkey(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture::open_capture_overlay,
            capture::close_capture_overlay,
            capture::get_capture_bg_path,
            capture::crop_and_save,
            ocr::run_ocr,
            db::save_capture,
            db::list_captures,
            db::get_capture,
            db::delete_capture,
            db::update_capture_tags,
            db::update_capture_note,
            db::update_capture_ocr,
            db::list_tags,
            db::create_card,
            db::update_card,
            db::list_cards,
            db::delete_card,
            db::export_cards_csv,
            db::get_setting,
            db::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
