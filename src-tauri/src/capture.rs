use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use xcap::Monitor;

/// Step 1: Take a full screenshot, then open the overlay with that screenshot as background.
#[tauri::command]
pub fn open_capture_overlay(app: AppHandle) -> Result<(), String> {
    eprintln!("[capture] open_capture_overlay called");

    // If overlay already exists, close it first
    if let Some(window) = app.get_webview_window("capture-overlay") {
        eprintln!("[capture] closing existing overlay");
        let _ = window.close();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    // Capture full screen BEFORE showing any overlay
    eprintln!("[capture] capturing screen...");
    let monitors = Monitor::all().map_err(|e| {
        eprintln!("[capture] Monitor::all() failed: {}", e);
        e.to_string()
    })?;
    let monitor = monitors.first().ok_or("No monitor found")?;
    let full_image = monitor.capture_image().map_err(|e| {
        eprintln!("[capture] capture_image() failed: {}", e);
        e.to_string()
    })?;
    eprintln!("[capture] screen captured: {}x{}", full_image.width(), full_image.height());

    // Save full screenshot to temp location
    let temp_dir = std::env::temp_dir().join("game-ocr");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let temp_path = temp_dir.join("capture_bg.png");
    full_image.save(&temp_path).map_err(|e| {
        eprintln!("[capture] save failed: {}", e);
        e.to_string()
    })?;
    eprintln!("[capture] saved to {:?}", temp_path);

    // Create fullscreen overlay window
    let _window = WebviewWindowBuilder::new(
        &app,
        "capture-overlay",
        WebviewUrl::App("/#/capture".into()),
    )
    .title("Capture")
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| {
        eprintln!("[capture] window build failed: {}", e);
        e.to_string()
    })?;

    eprintln!("[capture] overlay window created");
    Ok(())
}

#[tauri::command]
pub fn close_capture_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture-overlay") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get the path to the pre-captured full screenshot.
#[tauri::command]
pub fn get_capture_bg_path() -> Result<String, String> {
    let temp_path = std::env::temp_dir()
        .join("game-ocr")
        .join("capture_bg.png");
    if temp_path.exists() {
        Ok(temp_path.to_string_lossy().to_string())
    } else {
        Err("No capture background found".to_string())
    }
}

/// Step 2: Crop the pre-captured screenshot to the selected region and save it.
#[tauri::command]
pub fn crop_and_save(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<String, String> {
    // Load the pre-captured full screenshot
    let temp_path = std::env::temp_dir()
        .join("game-ocr")
        .join("capture_bg.png");

    let full_image = xcap::image::open(&temp_path)
        .map_err(|e| format!("Failed to open capture: {}", e))?
        .to_rgba8();

    // Crop to selected region
    let cropped = image_crop(&full_image, x, y, width, height)?;

    // Save to app data dir
    let captures_dir = get_captures_dir(&app)?;
    let filename = format!("{}.png", chrono_timestamp());
    let filepath = captures_dir.join(&filename);

    cropped
        .save(&filepath)
        .map_err(|e| format!("Failed to save crop: {}", e))?;

    // Close overlay window
    if let Some(window) = app.get_webview_window("capture-overlay") {
        let _ = window.close();
    }

    Ok(filepath.to_string_lossy().to_string())
}

fn image_crop(
    img: &xcap::image::RgbaImage,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<xcap::image::RgbaImage, String> {
    let x = x.max(0) as u32;
    let y = y.max(0) as u32;
    let max_w = img.width().saturating_sub(x);
    let max_h = img.height().saturating_sub(y);
    let w = width.min(max_w);
    let h = height.min(max_h);

    if w == 0 || h == 0 {
        return Err("Invalid crop region".to_string());
    }

    let cropped = xcap::image::imageops::crop_imm(img, x, y, w, h).to_image();
    Ok(cropped)
}

fn get_captures_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let captures_dir = app_data.join("captures");
    std::fs::create_dir_all(&captures_dir).map_err(|e| e.to_string())?;
    Ok(captures_dir)
}

fn chrono_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", duration.as_millis())
}
