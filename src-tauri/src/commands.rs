use crate::http_client::{BoltRequest, BoltResponse};
use std::collections::HashMap;
use tauri::Manager;

#[tauri::command]
pub async fn send_request(
    app_handle: tauri::AppHandle,
    request: BoltRequest,
    env: Option<HashMap<String, String>>,
) -> Result<BoltResponse, String> {
    let env_map = env.unwrap_or_default();
    
    // Extract info for history logging before consuming request
    let method = format!("{:?}", request.method);
    let url = request.url.clone();
    
    let result = crate::http_client::execute_request(request, env_map).await;
    
    // Build history log entry
    let id = uuid::Uuid::new_v4().to_string();
    let sent_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let (status, time_ms) = match &result {
        Ok(res) => (res.status, res.time_ms),
        Err(_) => (0, 0),
    };

    let entry = crate::history::HistoryEntry {
        id,
        method,
        url,
        status,
        time_ms,
        sent_at,
    };

    // Save to history file
    let _ = crate::history::append_history_internal(&app_handle, entry);

    result
}

fn get_projects_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config directory: {}", e))?;
    Ok(config_dir.join("projects"))
}

#[tauri::command]
pub async fn export_folder_pdf(
    app_handle: tauri::AppHandle,
    project_id: String,
    folder_id: String,
    generated_date: String,
) -> Result<Option<String>, String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    let file_path = projects_dir.join(format!("{}.json", project_id));
    if !file_path.exists() {
        return Err(format!("Project not found: {}", project_id));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let project: crate::projects::Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project JSON: {}", e))?;

    // Find the folder recursively
    fn find_folder_recursive(folders: &[crate::projects::Folder], fold_id: &str) -> Option<crate::projects::Folder> {
        for folder in folders {
            if folder.id == fold_id {
                return Option::Some(folder.clone());
            }
            if let Some(f) = find_folder_recursive(&folder.subfolders, fold_id) {
                return Option::Some(f);
            }
        }
        None
    }

    let folder = find_folder_recursive(&project.folders, &folder_id)
        .ok_or_else(|| format!("Folder not found: {}", folder_id))?;

    // Open native save file dialog
    let file_handle = rfd::AsyncFileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_file_name(&format!("{}.pdf", folder.name))
        .save_file()
        .await;

    if let Some(file) = file_handle {
        let save_path = file.path();
        crate::pdf_export::generate_pdf_document(&folder, project.name, generated_date, save_path)?;
        Ok(Some(save_path.to_string_lossy().to_string()))
    } else {
        Ok(None) // User cancelled
    }
}

