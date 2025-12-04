// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod memory_commands;

use memory_commands::{
    memori_add_memory, memori_completion, memori_config, memori_context, memori_create_session,
    memori_extract, memori_health, memori_ingest, memori_search, start_memori_sidecar,
    stop_memori_sidecar, SidecarState,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState::default())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                let state = event.window().state::<SidecarState>();
                let _ = state.stop();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_memori_sidecar,
            stop_memori_sidecar,
            memori_health,
            memori_config,
            memori_completion,
            memori_add_memory,
            memori_extract,
            memori_ingest,
            memori_search,
            memori_context,
            memori_create_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
