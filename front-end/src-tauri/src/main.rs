#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use tauri::Manager;
use std::io::Cursor;
use base64;
use image::{self, GenericImageView};

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
    return drives
}

#[tauri::command]
fn open_file(path: String) {
    opener::open(path).unwrap();
}

#[tauri::command]
fn get_thumbnail(path: String) -> Result<String, String> {
    // Load image from path
    let img = image::open(&path).map_err(|e| e.to_string())?;
    
    // Resize to thumbnail while maintaining aspect ratio
    let thumbnail = img.thumbnail(100, 100);
    
    // Convert to JPEG bytes using a Cursor
    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    thumbnail.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(85))
        .map_err(|e| e.to_string())?;
    
    // Convert to base64
    let encoded = base64::encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", encoded))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_drives,open_file,get_thumbnail])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
