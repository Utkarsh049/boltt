pub mod commands;
pub mod http_client;
pub mod projects;
pub mod environments;
pub mod history;
pub mod pdf_export;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::send_request,
            environments::load_environments,
            environments::save_environments,
            environments::get_active_variables
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
