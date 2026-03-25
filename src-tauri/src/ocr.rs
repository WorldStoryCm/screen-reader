use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
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

#[derive(Debug, Serialize, Deserialize)]
struct OcrRequest {
    image_path: String,
    preset: String,
}

pub struct OcrState {
    vision_binary_path: Mutex<String>,
}

impl OcrState {
    pub fn new() -> Self {
        Self {
            vision_binary_path: Mutex::new(String::new()),
        }
    }
}

fn find_vision_binary(app: &tauri::App) -> Option<String> {
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let candidates = vec![
        resource_dir.join("bin/vision_ocr"),
        dev_root.join("bin/vision_ocr"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

#[tauri::command]
pub fn run_ocr(
    state: State<OcrState>,
    image_path: String,
    preset: String,
) -> Result<OcrResult, String> {
    let binary_path = state.vision_binary_path.lock().map_err(|e| e.to_string())?;

    if binary_path.is_empty() {
        return Err("Vision OCR binary not found".to_string());
    }

    let request = OcrRequest {
        image_path,
        preset,
    };
    let request_json = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    eprintln!("[ocr] binary={}", binary_path);
    eprintln!("[ocr] request: {}", request_json);

    let mut child = Command::new(binary_path.as_str())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Vision OCR process: {}", e))?;

    // Write request
    if let Some(ref mut stdin) = child.stdin {
        writeln!(stdin, "{}", request_json)
            .map_err(|e| format!("Failed to write to OCR process: {}", e))?;
    }
    // Close stdin to signal we're done
    drop(child.stdin.take());

    // Read response
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture OCR process stdout")?;
    let reader = BufReader::new(stdout);

    let mut result_line = String::new();
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read OCR output: {}", e))?;
        eprintln!("[ocr] stdout line: {}", line);
        if !line.trim().is_empty() {
            result_line = line;
            break;
        }
    }

    // Wait for process to finish and capture stderr
    let output = child.wait_with_output().ok();
    if let Some(ref out) = output {
        if !out.stderr.is_empty() {
            let stderr_str = String::from_utf8_lossy(&out.stderr);
            eprintln!("[ocr] stderr: {}", stderr_str);
        }
    }

    if result_line.is_empty() {
        let stderr_msg = output
            .as_ref()
            .map(|o| String::from_utf8_lossy(&o.stderr).to_string())
            .unwrap_or_default();
        return Err(format!(
            "OCR process returned no output. stderr: {}",
            stderr_msg
        ));
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
    match find_vision_binary(app) {
        Some(path) => {
            println!("Vision OCR binary: {}", path);
            if let Ok(mut p) = state.vision_binary_path.lock() {
                *p = path;
            }
        }
        None => {
            eprintln!("[ocr] WARNING: Vision OCR binary not found!");
        }
    }
}
