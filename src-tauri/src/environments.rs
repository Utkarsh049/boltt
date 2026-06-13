use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub id: String,
    pub name: String,
    pub variables: Vec<Variable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentsFile {
    pub environments: Vec<Environment>,
    #[serde(rename = "activeId")]
    pub active_id: Option<String>,
}

fn get_env_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config directory: {}", e))?;
    Ok(config_dir.join("environments.json"))
}

#[tauri::command]
pub fn load_environments(app_handle: tauri::AppHandle) -> Result<EnvironmentsFile, String> {
    let file_path = get_env_file_path(&app_handle)?;
    if !file_path.exists() {
        return Ok(EnvironmentsFile {
            environments: Vec::new(),
            active_id: None,
        });
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read environments file: {}", e))?;
    
    let file_data: EnvironmentsFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse environments JSON: {}", e))?;

    Ok(file_data)
}

#[tauri::command]
pub fn save_environments(
    app_handle: tauri::AppHandle,
    data: EnvironmentsFile,
) -> Result<(), String> {
    let file_path = get_env_file_path(&app_handle)?;
    
    // Create directory if it doesn't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
    }

    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize environments JSON: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write environments file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_active_variables(
    data: EnvironmentsFile,
) -> Result<HashMap<String, String>, String> {
    let mut vars = HashMap::new();
    if let Some(active_id) = &data.active_id {
        if let Some(env) = data.environments.iter().find(|e| &e.id == active_id) {
            for v in &env.variables {
                if v.enabled && !v.key.is_empty() {
                    vars.insert(v.key.clone(), v.value.clone());
                }
            }
        }
    }
    Ok(vars)
}
