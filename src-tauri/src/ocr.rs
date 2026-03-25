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
    ocr_binary_path: Mutex<String>,
}

impl OcrState {
    pub fn new() -> Self {
        Self {
            ocr_binary_path: Mutex::new(String::new()),
        }
    }
}

/// macOS: find the compiled Swift Vision binary.
#[cfg(target_os = "macos")]
fn find_ocr_executable(app: &tauri::App) -> Option<(String, Vec<String>)> {
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let candidates = vec![
        resource_dir.join("bin/vision_ocr"),
        dev_root.join("bin/vision_ocr"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some((candidate.to_string_lossy().to_string(), Vec::new()));
        }
    }
    None
}

/// Windows: use PowerShell with the bundled OCR script.
#[cfg(target_os = "windows")]
fn find_ocr_executable(app: &tauri::App) -> Option<(String, Vec<String>)> {
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let dev_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let candidates = vec![
        resource_dir.join("windows/ocr.ps1"),
        dev_root.join("windows/ocr.ps1"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some((
                "powershell".to_string(),
                vec![
                    "-NoProfile".to_string(),
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                    "-File".to_string(),
                    candidate.to_string_lossy().to_string(),
                ],
            ));
        }
    }
    None
}

/// Linux/other: no OCR backend available yet.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn find_ocr_executable(_app: &tauri::App) -> Option<(String, Vec<String>)> {
    None
}

#[tauri::command]
pub fn run_ocr(
    state: State<OcrState>,
    image_path: String,
    preset: String,
) -> Result<OcrResult, String> {
    let binary_info = state.ocr_binary_path.lock().map_err(|e| e.to_string())?;

    if binary_info.is_empty() {
        return Err("OCR engine not found".to_string());
    }

    // Parse stored binary info: "cmd\0arg1\0arg2..."
    let parts: Vec<&str> = binary_info.split('\0').collect();
    let cmd = parts[0];
    let extra_args: Vec<&str> = parts[1..].to_vec();

    let request = OcrRequest {
        image_path,
        preset,
    };
    let request_json = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    eprintln!("[ocr] cmd={}, args={:?}", cmd, extra_args);
    eprintln!("[ocr] request: {}", request_json);

    let mut command = Command::new(cmd);
    for arg in &extra_args {
        command.arg(arg);
    }

    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn OCR process: {}", e))?;

    // Write request
    if let Some(ref mut stdin) = child.stdin {
        writeln!(stdin, "{}", request_json)
            .map_err(|e| format!("Failed to write to OCR process: {}", e))?;
    }
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
    match find_ocr_executable(app) {
        Some((cmd, args)) => {
            // Store as null-separated string: "cmd\0arg1\0arg2"
            let mut combined = cmd.clone();
            for arg in &args {
                combined.push('\0');
                combined.push_str(arg);
            }
            println!("OCR engine: {} {:?}", cmd, args);
            if let Ok(mut p) = state.ocr_binary_path.lock() {
                *p = combined;
            }
        }
        None => {
            eprintln!("[ocr] WARNING: No OCR engine found for this platform!");
        }
    }
}
