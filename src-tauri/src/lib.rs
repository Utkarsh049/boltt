use tauri::Manager;

pub mod commands;
pub mod http_client;
pub mod projects;
pub mod environments;
pub mod history;
pub mod pdf_export;

pub fn get_app_config_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let base_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config directory: {}", e))?;

    #[cfg(debug_assertions)]
    {
        // Isolate development data to ~/.config/boltt-dev so stable app data is never affected
        if let Some(parent) = base_dir.parent() {
            return Ok(parent.join("boltt-dev"));
        }
    }

    Ok(base_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
                #[cfg(debug_assertions)]
                {
                    let _ = window.set_title("Boltt [DEV]");
                }
            }

            // On Linux, write a local .desktop file only in dev mode when Boltt is NOT already installed on the system
            #[cfg(target_os = "linux")]
            {
                use std::fs;
                use std::path::PathBuf;

                if let Some(home_dir) = std::env::var_os("HOME").map(PathBuf::from) {
                    if let Ok(current_exe) = std::env::current_exe() {
                        let is_system_install = current_exe.starts_with("/usr");
                        let system_desktop_exists = std::path::Path::new("/usr/share/applications/boltt.desktop").exists();

                        // Never overwrite or create ~/.local/share/applications/boltt.desktop if system package is installed
                        if !is_system_install && !system_desktop_exists {
                            let desktop_dir = home_dir.join(".local/share/applications");
                            let _ = fs::create_dir_all(&desktop_dir);
                            let desktop_file = desktop_dir.join("boltt.desktop");

                            let icon_str = if std::path::Path::new("src-tauri/icons/icon.png").exists() {
                                std::env::current_dir()
                                    .map(|d| d.join("src-tauri/icons/icon.png").to_string_lossy().to_string())
                                    .unwrap_or_else(|_| "boltt".to_string())
                            } else {
                                "boltt".to_string()
                            };

                            let content = format!(
                                "[Desktop Entry]\n\
                                 Type=Application\n\
                                 Name=Boltt\n\
                                 Exec=\"{}\"\n\
                                 Icon={}\n\
                                 Terminal=false\n\
                                 StartupWMClass=boltt\n",
                                current_exe.to_string_lossy().replace('"', "\\\""),
                                icon_str
                            );
                            let _ = fs::write(desktop_file, content);
                        }
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_request,
            environments::load_environments,
            environments::save_environments,
            environments::get_active_variables,
            projects::list_projects,
            projects::save_project,
            projects::save_request_to_project,
            projects::delete_request_from_project,
            projects::rename_folder_in_project,
            projects::create_project_dialog,
            projects::import_project_dialog,
            projects::unmount_project,
            projects::delete_project_file,
            projects::open_in_file_explorer,
            history::load_history,
            history::clear_history,
            history::append_history,
            commands::export_folder_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
