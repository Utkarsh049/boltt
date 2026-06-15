use crate::http_client::{HttpMethod, KeyValue, RequestBody, AuthConfig};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedRequest {
    pub id: String,
    pub name: String,
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<KeyValue>,
    pub params: Vec<KeyValue>,
    pub body: RequestBody,
    pub auth: AuthConfig,
    pub created_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub requests: Vec<SavedRequest>,
    pub subfolders: Vec<Folder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub folders: Vec<Folder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFile {
    pub project: Project,
}

fn get_projects_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config directory: {}", e))?;
    Ok(config_dir.join("projects"))
}

#[tauri::command]
pub fn list_projects(app_handle: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();
    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(project) = serde_json::from_str::<Project>(&content) {
                        projects.push(project);
                    } else if let Ok(project_file) = serde_json::from_str::<ProjectFile>(&content) {
                        projects.push(project_file.project);
                    }
                }
            }
        }
    }

    Ok(projects)
}

#[tauri::command]
pub fn save_project(app_handle: tauri::AppHandle, project: Project) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }

    let file_path = projects_dir.join(format!("{}.json", project.id));
    let content = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_project(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    let file_path = projects_dir.join(format!("{}.json", id));
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete project file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn save_request_to_project(
    app_handle: tauri::AppHandle,
    project_id: String,
    folder_id: String,
    request: SavedRequest,
) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    let file_path = projects_dir.join(format!("{}.json", project_id));
    if !file_path.exists() {
        return Err(format!("Project not found: {}", project_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let mut project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project JSON: {}", e))?;

    let mut found = false;
    fn add_request_recursive(folders: &mut [Folder], folder_id: &str, req: &SavedRequest) -> bool {
        for folder in folders {
            if folder.id == folder_id {
                if let Some(pos) = folder.requests.iter().position(|r| r.id == req.id) {
                    folder.requests[pos] = req.clone();
                } else {
                    folder.requests.push(req.clone());
                }
                return true;
            }
            if add_request_recursive(&mut folder.subfolders, folder_id, req) {
                return true;
            }
        }
        false
    }

    if add_request_recursive(&mut project.folders, &folder_id, &request) {
        found = true;
    }

    if !found {
        return Err(format!("Folder not found: {}", folder_id));
    }

    let content = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_request_from_project(
    app_handle: tauri::AppHandle,
    project_id: String,
    request_id: String,
) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    let file_path = projects_dir.join(format!("{}.json", project_id));
    if !file_path.exists() {
        return Err(format!("Project not found: {}", project_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let mut project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project JSON: {}", e))?;

    fn remove_request_recursive(folders: &mut [Folder], req_id: &str) -> bool {
        for folder in folders {
            let initial_len = folder.requests.len();
            folder.requests.retain(|r| r.id != req_id);
            if folder.requests.len() < initial_len {
                return true;
            }
            if remove_request_recursive(&mut folder.subfolders, req_id) {
                return true;
            }
        }
        false
    }

    if remove_request_recursive(&mut project.folders, &request_id) {
        let content = serde_json::to_string_pretty(&project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to write project file: {}", e))?;
        Ok(())
    } else {
        Err(format!("Request not found: {}", request_id))
    }
}

#[tauri::command]
pub fn rename_folder_in_project(
    app_handle: tauri::AppHandle,
    project_id: String,
    folder_id: String,
    new_name: String,
) -> Result<(), String> {
    let projects_dir = get_projects_dir(&app_handle)?;
    let file_path = projects_dir.join(format!("{}.json", project_id));
    if !file_path.exists() {
        return Err(format!("Project not found: {}", project_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let mut project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project JSON: {}", e))?;

    fn rename_folder_recursive(folders: &mut [Folder], fold_id: &str, name: &str) -> bool {
        for folder in folders {
            if folder.id == fold_id {
                folder.name = name.to_string();
                return true;
            }
            if rename_folder_recursive(&mut folder.subfolders, fold_id, name) {
                return true;
            }
        }
        false
    }

    if rename_folder_recursive(&mut project.folders, &folder_id, &new_name) {
        let content = serde_json::to_string_pretty(&project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to write project file: {}", e))?;
        Ok(())
    } else {
        Err(format!("Folder not found: {}", folder_id))
    }
}

#[tauri::command]
pub async fn import_project(app_handle: tauri::AppHandle) -> Result<Option<Project>, String> {
    let file_handle = rfd::AsyncFileDialog::new()
        .add_filter("Boltt Project JSON", &["json"])
        .pick_file()
        .await;

    if let Some(file) = file_handle {
        let content = fs::read_to_string(file.path())
            .map_err(|e| format!("Failed to read project file: {}", e))?;
        
        let project: Project = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid project JSON format: {}", e))?;

        // Save the project to disk
        save_project(app_handle, project.clone())?;
        Ok(Some(project))
    } else {
        Ok(None)
    }
}

