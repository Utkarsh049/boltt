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

            // On Linux:
            // 1. If a system package exists (/usr/share/applications/boltt.desktop), clean up any stale
            //    user-level ~/.local/share/applications/boltt.desktop so the release entry is never shadowed.
            // 2. In debug builds, write to isolated boltt-dev.desktop (never boltt.desktop) with NoDisplay=true
            //    so dock WMClass matches without polluting or conflicting with the release app.
            #[cfg(target_os = "linux")]
            {
                use std::fs;
                use std::path::PathBuf;

                if let Some(home_dir) = std::env::var_os("HOME").map(PathBuf::from) {
                    let desktop_dir = home_dir.join(".local/share/applications");
                    let dev_desktop_file = desktop_dir.join("boltt-dev.desktop");
                    let shared_desktop_file = desktop_dir.join("boltt.desktop");
                    let system_desktop_exists = std::path::Path::new("/usr/share/applications/boltt.desktop").exists();

                    if system_desktop_exists && shared_desktop_file.exists() {
                        // Ensure stale user-level file is cleaned up so system desktop file is never shadowed
                        let _ = fs::remove_file(&shared_desktop_file);
                    }

                    if cfg!(debug_assertions) {
                        if let Ok(current_exe) = std::env::current_exe() {
                            let _ = fs::create_dir_all(&desktop_dir);

                            // Resolve icon path: check resource dir first, or search relative to current exe
                            let icon_path = app
                                .path()
                                .resource_dir()
                                .map(|r| r.join("icons/icon.png"))
                                .ok()
                                .filter(|p| p.exists())
                                .or_else(|| {
                                    let mut dir = current_exe.parent();
                                    while let Some(d) = dir {
                                        let candidate = d.join("src-tauri/icons/icon.png");
                                        if candidate.exists() {
                                            return Some(candidate);
                                        }
                                        let candidate2 = d.join("icons/icon.png");
                                        if candidate2.exists() {
                                            return Some(candidate2);
                                        }
                                        dir = d.parent();
                                    }
                                    None
                                });

                            let icon_line = match &icon_path {
                                Some(path) => format!("Icon={}\n", path.to_string_lossy()),
                                None => String::new(),
                            };

                            let content = format!(
                                "[Desktop Entry]\n\
                                 Type=Application\n\
                                 Name=Boltt (Dev)\n\
                                 Exec=\"{}\"\n\
                                 {}Terminal=false\n\
                                 NoDisplay=true\n\
                                 StartupWMClass=boltt\n",
                                current_exe.to_string_lossy().replace('"', "\\\""),
                                icon_line
                            );
                            let _ = fs::write(dev_desktop_file, content);
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
