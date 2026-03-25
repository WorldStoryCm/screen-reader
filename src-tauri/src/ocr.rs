use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OcrResult {
    pub raw_text: String,
    pub normalized_text: String,
    pub confidence: f64,
    pub error: Option<String>,
}

pub struct OcrState {
    engine: Mutex<OcrEngine>,
}

enum OcrEngine {
    None,
    Tesseract(String), // path to tesseract.exe
    #[cfg(target_os = "macos")]
    VisionBinary(String),
    #[cfg(target_os = "windows")]
    PowerShell(String), // path to ocr.ps1
}

impl OcrState {
    pub fn new() -> Self {
        Self {
            engine: Mutex::new(OcrEngine::None),
        }
    }
}

#[tauri::command]
pub fn run_ocr(
    state: State<OcrState>,
    image_path: String,
    preset: String,
) -> Result<OcrResult, String> {
    let engine = state.engine.lock().map_err(|e| e.to_string())?;

    match &*engine {
        OcrEngine::None => Err("OCR engine not found".to_string()),
        OcrEngine::Tesseract(bin) => run_tesseract(bin, &image_path, &preset),
        #[cfg(target_os = "macos")]
        OcrEngine::VisionBinary(bin) => run_vision(bin, &image_path, &preset),
        #[cfg(target_os = "windows")]
        OcrEngine::PowerShell(script) => run_powershell(script, &image_path, &preset),
    }
}

fn run_tesseract(bin: &str, image_path: &str, preset: &str) -> Result<OcrResult, String> {
    let lang = if preset == "english" { "eng" } else { "jpn" };

    // Preprocess: grayscale → invert → binarize (handles light-on-dark game UI)
    let preprocessed = preprocess_for_ocr(image_path)?;
    let input_path = preprocessed.to_string_lossy().to_string();

    eprintln!("[ocr] tesseract lang={} image={}", lang, input_path);

    let mut command = Command::new(bin);
    command.args([input_path.as_str(), "stdout", "-l", lang, "--psm", "6"]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run tesseract: {}", e))?;

    // Clean up preprocessed file
    let _ = std::fs::remove_file(&preprocessed);

    if !output.stderr.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[ocr] tesseract stderr: {}", stderr);
    }

    let raw_text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let normalized_text = raw_text.clone();
    let confidence = if raw_text.is_empty() { 0.0 } else { 90.0 };

    eprintln!("[ocr] tesseract result: {}", raw_text);

    Ok(OcrResult {
        raw_text,
        normalized_text,
        confidence,
        error: None,
    })
}

/// Preprocess image for better OCR: grayscale → 2x upscale → invert if dark background
fn preprocess_for_ocr(image_path: &str) -> Result<std::path::PathBuf, String> {
    use xcap::image::{self, imageops::FilterType};

    let img = image::open(image_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;

    let gray = img.to_luma8();

    // 2x upscale for better OCR on small text
    let upscaled = image::imageops::resize(&gray, gray.width() * 2, gray.height() * 2, FilterType::Lanczos3);

    // Check average brightness — invert if dark background (light text on dark)
    let total: u64 = upscaled.pixels().map(|p| p.0[0] as u64).sum();
    let avg = total as f64 / upscaled.pixels().count() as f64;

    let result = if avg < 128.0 {
        eprintln!("[ocr] dark background detected (avg={:.0}), inverting", avg);
        let mut inverted = upscaled;
        for pixel in inverted.pixels_mut() {
            pixel.0[0] = 255 - pixel.0[0];
        }
        inverted
    } else {
        upscaled
    };

    let out_path = std::env::temp_dir().join("game-ocr").join("ocr_preprocessed.png");
    result.save(&out_path).map_err(|e| format!("Failed to save preprocessed: {}", e))?;

    Ok(out_path)
}

#[cfg(target_os = "macos")]
fn run_vision(bin: &str, image_path: &str, preset: &str) -> Result<OcrResult, String> {
    use std::io::{BufRead, BufReader, Write};

    let request = serde_json::json!({
        "image_path": image_path,
        "preset": preset,
    });
    let request_json = request.to_string();

    let mut child = Command::new(bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn vision_ocr: {}", e))?;

    if let Some(ref mut stdin) = child.stdin {
        writeln!(stdin, "{}", request_json)
            .map_err(|e| format!("Failed to write to vision_ocr: {}", e))?;
    }
    drop(child.stdin.take());

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);

    let mut result_line = String::new();
    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if !line.trim().is_empty() {
            result_line = line;
            break;
        }
    }

    let _ = child.wait_with_output();

    if result_line.is_empty() {
        return Err("vision_ocr returned no output".to_string());
    }

    serde_json::from_str(&result_line)
        .map_err(|e| format!("Failed to parse vision_ocr result: {}", e))
}

#[cfg(target_os = "windows")]
fn run_powershell(script: &str, image_path: &str, preset: &str) -> Result<OcrResult, String> {
    use std::io::{BufRead, BufReader, Write};

    let request = serde_json::json!({
        "image_path": image_path,
        "preset": preset,
    });
    let request_json = request.to_string();

    eprintln!("[ocr] powershell script={}", script);
    eprintln!("[ocr] request: {}", request_json);

    let mut command = Command::new("powershell");
    command.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script]);

    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn PowerShell: {}", e))?;

    if let Some(ref mut stdin) = child.stdin {
        writeln!(stdin, "{}", request_json)
            .map_err(|e| format!("Failed to write to PowerShell: {}", e))?;
    }
    drop(child.stdin.take());

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);

    let mut result_line = String::new();
    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        eprintln!("[ocr] stdout line: {}", line);
        if !line.trim().is_empty() {
            result_line = line;
            break;
        }
    }

    let output = child.wait_with_output().ok();
    if let Some(ref out) = output {
        if !out.stderr.is_empty() {
            eprintln!("[ocr] stderr: {}", String::from_utf8_lossy(&out.stderr));
        }
    }

    if result_line.is_empty() {
        return Err("PowerShell OCR returned no output".to_string());
    }

    let result: OcrResult = serde_json::from_str(&result_line)
        .map_err(|e| format!("Failed to parse OCR result: {} — raw: {}", e, result_line))?;

    if let Some(ref error) = result.error {
        if !error.is_empty() {
            return Err(error.clone());
        }
    }

    Ok(result)
}

pub fn init_ocr_state(app: &tauri::App, state: &OcrState) {
    let engine = find_engine(app);

    match &engine {
        OcrEngine::None => eprintln!("[ocr] WARNING: No OCR engine found!"),
        OcrEngine::Tesseract(p) => eprintln!("[ocr] Using Tesseract: {}", p),
        #[cfg(target_os = "macos")]
        OcrEngine::VisionBinary(p) => eprintln!("[ocr] Using Vision binary: {}", p),
        #[cfg(target_os = "windows")]
        OcrEngine::PowerShell(p) => eprintln!("[ocr] Using PowerShell OCR: {}", p),
    }

    if let Ok(mut e) = state.engine.lock() {
        *e = engine;
    }
}

fn find_engine(app: &tauri::App) -> OcrEngine {
    // 1. Check for Tesseract (all platforms)
    if let Some(path) = find_tesseract() {
        return OcrEngine::Tesseract(path);
    }

    // 2. Platform-specific fallbacks
    #[cfg(target_os = "macos")]
    {
        let resource_dir = app.path().resource_dir().unwrap_or_default();
        let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        for candidate in [
            resource_dir.join("bin/vision_ocr"),
            dev_root.join("bin/vision_ocr"),
        ] {
            if candidate.exists() {
                return OcrEngine::VisionBinary(candidate.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let resource_dir = app.path().resource_dir().unwrap_or_default();
        let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        for candidate in [
            resource_dir.join("windows/ocr.ps1"),
            dev_root.join("windows/ocr.ps1"),
        ] {
            if candidate.exists() {
                return OcrEngine::PowerShell(candidate.to_string_lossy().to_string());
            }
        }
    }

    let _ = app; // suppress unused warning on linux
    OcrEngine::None
}

fn find_tesseract() -> Option<String> {
    // Check common install locations
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ];
        for path in &candidates {
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    // Check PATH
    let cmd = if cfg!(target_os = "windows") {
        "tesseract.exe"
    } else {
        "tesseract"
    };

    Command::new(cmd)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .ok()
        .filter(|s| s.success())
        .map(|_| cmd.to_string())
}
