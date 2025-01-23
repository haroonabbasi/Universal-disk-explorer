#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
fn get_drives() -> Vec<String> {
    let mut drives = Vec::new();

    if cfg!(target_os = "macos") {
        // macOS: List drives in /Volumes
        if let Ok(entries) = fs::read_dir("/Volumes") {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_dir() {
                        drives.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    } else if cfg!(target_os = "windows") {
        // Windows: Example for detecting drives
        drives.push("C:\\".to_string());
        drives.push("D:\\".to_string());
    } else {
        // Linux: Check root or other mount points
        drives.push("/".to_string());
    }

    drives
}

#[tauri::command]
fn select_folder() -> Option<String> {
    // Placeholder for folder selection logic
    Some("/Users/haroonabbasi/Documents/mix".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_drives, select_folder])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
