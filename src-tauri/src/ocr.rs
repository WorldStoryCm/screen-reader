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
    python_path: Mutex<String>,
    script_path: Mutex<String>,
}

impl OcrState {
    pub fn new() -> Self {
        Self {
            python_path: Mutex::new("python3".to_string()),
            script_path: Mutex::new(String::new()),
        }
    }
}

pub fn find_ocr_script(app: &tauri::App) -> String {
    let resource_dir = app.path().resource_dir().unwrap_or_default();

    let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();

    let candidates: Vec<std::path::PathBuf> = vec![
        resource_dir.join("python/ocr_service/ocr_service.py"),
        std::env::current_dir()
            .unwrap_or_default()
            .join("python/ocr_service/ocr_service.py"),
        dev_root.join("python/ocr_service/ocr_service.py"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    candidates
        .last()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub fn run_ocr(
    state: State<OcrState>,
    image_path: String,
    preset: String,
) -> Result<OcrResult, String> {
    let python_path = state.python_path.lock().map_err(|e| e.to_string())?;
    let script_path = state.script_path.lock().map_err(|e| e.to_string())?;

    if script_path.is_empty() {
        return Err("OCR script path not initialized".to_string());
    }

    let request = OcrRequest {
        image_path,
        preset,
    };
    let request_json = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    // Spawn Python process for this single request
    let mut child = Command::new(python_path.as_str())
        .arg(script_path.as_str())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Python OCR process: {}", e))?;

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
        if !line.trim().is_empty() {
            result_line = line;
            break;
        }
    }

    // Wait for process to finish
    let _ = child.wait();

    if result_line.is_empty() {
        // Check stderr for errors
        return Err("OCR process returned no output".to_string());
    }

    let result: OcrResult =
        serde_json::from_str(&result_line).map_err(|e| format!("Failed to parse OCR result: {} — raw: {}", e, result_line))?;

    if let Some(ref error) = result.error {
        return Err(error.clone());
    }

    Ok(result)
}

fn find_python(project_root: &std::path::Path) -> String {
    // Check for venv python first
    let venv_python = project_root.join("python/.venv/bin/python3");
    if venv_python.exists() {
        return venv_python.to_string_lossy().to_string();
    }
    "python3".to_string()
}

pub fn init_ocr_state(app: &tauri::App, state: &OcrState) {
    let script = find_ocr_script(app);

    // Find project root for venv python
    let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();
    let python = find_python(&dev_root);

    if let Ok(mut path) = state.script_path.lock() {
        *path = script.clone();
    }
    if let Ok(mut path) = state.python_path.lock() {
        *path = python.clone();
    }
    println!("OCR script: {}", script);
    println!("Python: {}", python);
}
