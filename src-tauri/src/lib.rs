use tauri::Manager;

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
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            // On Linux, write a local .desktop file to resolve GNOME Shell / Ubuntu dock icon mapping
            #[cfg(target_os = "linux")]
            {
                use std::fs;
                use std::path::PathBuf;

                if let Some(home_dir) = std::env::var_os("HOME").map(PathBuf::from) {
                    let desktop_dir = home_dir.join(".local/share/applications");
                    if desktop_dir.exists() {
                        let desktop_file = desktop_dir.join("boltt.desktop");
                        if let Ok(current_exe) = std::env::current_exe() {
                            if let Ok(current_dir) = std::env::current_dir() {
                                let icon_path = current_dir.join("icons/icon.png");
                                if icon_path.exists() {
                                    let content = format!(
                                        "[Desktop Entry]\n\
                                         Type=Application\n\
                                         Name=Boltt\n\
                                         Exec={}\n\
                                         Icon={}\n\
                                         Terminal=false\n\
                                         StartupWMClass=boltt\n",
                                        current_exe.to_string_lossy(),
                                        icon_path.to_string_lossy()
                                    );
                                    let _ = fs::write(desktop_file, content);
                                }
                            }
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
