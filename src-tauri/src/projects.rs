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
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFile {
    pub project: Project,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceConfig {
    pub mounted_projects: Vec<String>,
}

fn get_workspace_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config directory: {}", e))?;
    Ok(config_dir.join("workspace_config.json"))
}

pub fn load_workspace_config(app_handle: &tauri::AppHandle) -> Result<WorkspaceConfig, String> {
    let path = get_workspace_config_path(app_handle)?;
    if !path.exists() {
        return Ok(WorkspaceConfig::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read workspace config: {}", e))?;
    let config: WorkspaceConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace config: {}", e))?;
    Ok(config)
}

fn save_workspace_config(app_handle: &tauri::AppHandle, config: &WorkspaceConfig) -> Result<(), String> {
    let path = get_workspace_config_path(app_handle)?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize workspace config: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write workspace config: {}", e))?;
    Ok(())
}

fn get_project_file_path(app_handle: &tauri::AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let config = load_workspace_config(app_handle)?;
    for path_str in &config.mounted_projects {
        let path = PathBuf::from(path_str);
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(proj) = serde_json::from_str::<Project>(&content) {
                    if proj.id == project_id {
                        return Ok(path);
                    }
                }
            }
        }
    }
    Err(format!("Project with ID {} not found in workspace", project_id))
}

#[tauri::command]
pub fn list_projects(app_handle: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let config = load_workspace_config(&app_handle)?;
    let mut projects = Vec::new();
    let mut updated_paths = Vec::new();
    let mut changed = false;

    for path_str in config.mounted_projects {
        let path = PathBuf::from(&path_str);
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut project) = serde_json::from_str::<Project>(&content) {
                    project.path = Some(path_str.clone());
                    projects.push(project);
                    updated_paths.push(path_str);
                } else if let Ok(project_file) = serde_json::from_str::<ProjectFile>(&content) {
                    let mut project = project_file.project;
                    project.path = Some(path_str.clone());
                    projects.push(project);
                    updated_paths.push(path_str);
                }
            }
        } else {
            changed = true;
        }
    }

    if changed {
        let _ = save_workspace_config(&app_handle, &WorkspaceConfig { mounted_projects: updated_paths });
    }

    Ok(projects)
}

#[tauri::command]
pub fn save_project(_app_handle: tauri::AppHandle, project: Project) -> Result<(), String> {
    let path_str = project.path.clone().ok_or_else(|| "Project path not found".to_string())?;
    let file_path = PathBuf::from(&path_str);

    let content = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write project file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn create_project_dialog(app_handle: tauri::AppHandle, default_name: String) -> Result<Option<Project>, String> {
    let file_handle = rfd::AsyncFileDialog::new()
        .add_filter("Boltt Project JSON", &["json"])
        .set_file_name(format!("{}.json", default_name))
        .save_file()
        .await;

    if let Some(file) = file_handle {
        let save_path = file.path();
        let stem = save_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&default_name)
            .to_string();

        let path_str = save_path.to_string_lossy().to_string();
        let new_project = Project {
            id: uuid::Uuid::new_v4().to_string(),
            name: stem,
            folders: Vec::new(),
            path: Some(path_str.clone()),
        };

        let content = serde_json::to_string_pretty(&new_project)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        fs::write(save_path, content)
            .map_err(|e| format!("Failed to write project file: {}", e))?;

        let mut config = load_workspace_config(&app_handle)?;
        if !config.mounted_projects.contains(&path_str) {
            config.mounted_projects.push(path_str);
            save_workspace_config(&app_handle, &config)?;
        }

        Ok(Some(new_project))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn import_project_dialog(app_handle: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let file_handle = rfd::AsyncFileDialog::new()
        .add_filter("Boltt Project JSON", &["json"])
        .pick_files()
        .await;

    let mut imported_projects = Vec::new();
    if let Some(files) = file_handle {
        let mut config = load_workspace_config(&app_handle)?;
        
        for file in files {
            let path_str = file.path().to_string_lossy().to_string();
            if let Ok(content) = fs::read_to_string(file.path()) {
                if let Ok(mut project) = serde_json::from_str::<Project>(&content) {
                    project.path = Some(path_str.clone());
                    let _ = save_project(app_handle.clone(), project.clone());
                    imported_projects.push(project);
                    
                    if !config.mounted_projects.contains(&path_str) {
                        config.mounted_projects.push(path_str);
                    }
                }
            }
        }
        
        save_workspace_config(&app_handle, &config)?;
    }
    Ok(imported_projects)
}

#[tauri::command]
pub fn unmount_project(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut config = load_workspace_config(&app_handle)?;
    config.mounted_projects.retain(|p| p != &path);
    save_workspace_config(&app_handle, &config)?;
    Ok(())
}

#[tauri::command]
pub fn delete_project_file(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut config = load_workspace_config(&app_handle)?;
    config.mounted_projects.retain(|p| p != &path);
    save_workspace_config(&app_handle, &config)?;

    let file_path = PathBuf::from(&path);
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete project file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_file_explorer(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    let dir = if file_path.is_dir() {
        file_path
    } else {
        file_path.parent().ok_or_else(|| "No parent directory found".to_string())?
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
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
    let file_path = get_project_file_path(&app_handle, &project_id)?;

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
    let file_path = get_project_file_path(&app_handle, &project_id)?;

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
    let file_path = get_project_file_path(&app_handle, &project_id)?;

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
