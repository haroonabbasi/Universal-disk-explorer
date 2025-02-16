use std::fs;
use std::io::Cursor;
use std::path::Path;
use base64::encode;
use image::{
    imageops::FilterType,
    io::Reader as ImageReader,
    DynamicImage,
    GenericImageView,
    ImageOutputFormat,
};
use serde::{Deserialize, Serialize};
use tauri::command;

/// Structure returned by the thumbnail command.
#[derive(Serialize, Deserialize)]
pub struct ThumbnailResponse {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

/// Generate a thumbnail from an image file.
#[command]
pub fn get_thumbnail(path: String) -> Result<ThumbnailResponse, String> {
    // Open and decode the image.
    let img: DynamicImage = ImageReader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Get original dimensions.
    let (width, height) = img.dimensions();

    // Calculate aspect ratio preserving dimensions.
    let aspect_ratio = width as f32 / height as f32;
    let new_width = 100;
    let new_height = (new_width as f32 / aspect_ratio) as u32;

    // Resize with high-quality Lanczos3 filter.
    let thumbnail = img.resize_exact(new_width, new_height, FilterType::Lanczos3);

    // Encode the thumbnail to JPEG bytes.
    let mut bytes: Vec<u8> = Vec::new();
    thumbnail
        .write_to(&mut Cursor::new(&mut bytes), ImageOutputFormat::Jpeg(90))
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    // Create a data URL with the base64-encoded image.
    let data_url = format!("data:image/jpeg;base64,{}", encode(&bytes));

    Ok(ThumbnailResponse {
        data_url,
        width: new_width,
        height: new_height,
    })
}

/// List available drives.
#[command]
pub fn get_drives() -> Vec<String> {
    let mut drives = Vec::new();

    if cfg!(target_os = "macos") {
        // macOS: List drives in /Volumes.
        if let Ok(entries) = fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    drives.push(path.to_string_lossy().to_string());
                }
            }
        }
    } else if cfg!(target_os = "windows") {
        // Windows: Example for detecting drives.
        drives.push("C:\\".to_string());
        drives.push("D:\\".to_string());
    } else {
        // Linux or others: Check root or other mount points.
        drives.push("/".to_string());
    }
    drives
}

/// Open a file using the system default application.
#[command]
pub fn open_file(path: String) {
    opener::open(path).unwrap();
}

#[command]
pub fn open_file_folder(path: String) {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = opener::open(parent.to_str().unwrap());
    }
}

/// Macro to auto-register all commands.
/// The fully-qualified paths are used to ensure the commands are located correctly.
#[macro_export]
macro_rules! register_commands {
    () => {
        tauri::generate_handler![
            crate::commands::get_drives,
            crate::commands::open_file,
            crate::commands::get_thumbnail,
            crate::commands::open_file_folder
        ]
    };
}
