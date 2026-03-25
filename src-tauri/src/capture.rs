use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Take a full screenshot of the active screen and return the file path.
/// Uses macOS `screencapture` which correctly handles Spaces/virtual desktops.
#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    eprintln!("[capture] capture_screen called");

    let temp_dir = std::env::temp_dir().join("game-ocr");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let temp_path = temp_dir.join("capture_bg.png");

    // -x = no sound, -C = include cursor, -m = only main/active display
    let status = std::process::Command::new("screencapture")
        .args(["-x", "-m", temp_path.to_str().unwrap()])
        .status()
        .map_err(|e| format!("Failed to run screencapture: {}", e))?;

    if !status.success() {
        return Err(format!("screencapture exited with: {}", status));
    }

    eprintln!("[capture] saved to {:?}", temp_path);
    Ok(temp_path.to_string_lossy().to_string())
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
