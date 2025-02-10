#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use tauri::Manager;
use std::io::Cursor;
// use base64;
// use image::{self, GenericImageView};
// Add all necessary imports
use base64::encode;
use image::{
    imageops::FilterType,
    io::Reader as ImageReader,
    DynamicImage,
    GenericImageView,  // Add this import
    ImageOutputFormat,
};
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Serialize, Deserialize)]
struct ThumbnailResponse {
    data_url: String,
    width: u32,
    height: u32,
}

#[tauri::command]
fn get_thumbnail(path: String) -> Result<ThumbnailResponse, String> {
    // Open and decode the image
    let img: DynamicImage = ImageReader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Get original dimensions
    let (width, height) = img.dimensions();

    // Calculate aspect ratio preserving dimensions
    let aspect_ratio = width as f32 / height as f32;
    let new_width = 100;
    let new_height = (new_width as f32 / aspect_ratio) as u32;

    // Resize with high quality
    let thumbnail = img.resize_exact(
        new_width,
        new_height,
        FilterType::Lanczos3, // High-quality resampling
    );

    // Convert to JPEG bytes
    let mut bytes: Vec<u8> = Vec::new();
    thumbnail
        .write_to(&mut Cursor::new(&mut bytes), ImageOutputFormat::Jpeg(90))
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    // Create data URL
    let data_url = format!("data:image/jpeg;base64,{}", encode(&bytes));

    Ok(ThumbnailResponse {
        data_url,
        width: new_width,
        height: new_height,
    })
}

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
// fn get_thumbnail(path: String) -> Result<String, String> {
//     // Load image from path
//     let img = image::open(&path).map_err(|e| e.to_string())?;
    
//     // Resize to thumbnail while maintaining aspect ratio
//     let thumbnail = img.thumbnail(100, 100);
    
//     // Convert to JPEG bytes using a Cursor
//     let mut bytes: Vec<u8> = Vec::new();
//     let mut cursor = Cursor::new(&mut bytes);
//     thumbnail.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(85))
//         .map_err(|e| e.to_string())?;
    
//     // Convert to base64
//     let encoded = base64::encode(&bytes);
//     Ok(format!("data:image/jpeg;base64,{}", encoded))
// }
fn get_thumbnail2(path: String) -> Result<ThumbnailResponse, String> {
    // Open and decode the image
    let img = ImageReader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Calculate aspect ratio preserving dimensions
    let (width, height) = img.dimensions();
    let aspect_ratio = width as f32 / height as f32;
    let new_width = 100;
    let new_height = (new_width as f32 / aspect_ratio) as u32;

    // Resize with high quality
    let thumbnail = img.resize_exact(
        new_width,
        new_height,
        FilterType::Lanczos3, // High-quality resampling
    );

    // Convert to JPEG bytes
    let mut bytes: Vec<u8> = Vec::new();
    thumbnail
        .write_to(&mut Cursor::new(&mut bytes), ImageOutputFormat::Jpeg(90))
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    // Create data URL
    let data_url = format!("data:image/jpeg;base64,{}", encode(&bytes));

    Ok(ThumbnailResponse {
        data_url,
        width: new_width,
        height: new_height,
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_drives,open_file,get_thumbnail])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
