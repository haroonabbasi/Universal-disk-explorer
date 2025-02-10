#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Bring in the commands module.
mod commands;

// The macro defined in `commands.rs` is exported to the crate root,
// so you can call it directly.
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(register_commands!())
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
