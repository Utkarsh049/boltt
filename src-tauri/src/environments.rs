use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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
    let config_dir = crate::get_app_config_dir(app_handle)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_active_variables_resolves_enabled_only() {
        let env_file = EnvironmentsFile {
            active_id: Some("env-1".to_string()),
            environments: vec![
                Environment {
                    id: "env-1".to_string(),
                    name: "Staging".to_string(),
                    variables: vec![
                        Variable {
                            key: "apiUrl".to_string(),
                            value: "https://staging.api.com".to_string(),
                            enabled: true,
                        },
                        Variable {
                            key: "disabledKey".to_string(),
                            value: "secret".to_string(),
                            enabled: false,
                        },
                        Variable {
                            key: "".to_string(),
                            value: "emptyKeyVal".to_string(),
                            enabled: true,
                        },
                    ],
                },
                Environment {
                    id: "env-2".to_string(),
                    name: "Production".to_string(),
                    variables: vec![
                        Variable {
                            key: "apiUrl".to_string(),
                            value: "https://api.com".to_string(),
                            enabled: true,
                        },
                    ],
                },
            ],
        };

        let vars = get_active_variables(env_file).unwrap();
        assert_eq!(vars.len(), 1);
        assert_eq!(vars.get("apiUrl").unwrap(), "https://staging.api.com");
        assert!(!vars.contains_key("disabledKey"));
    }

    #[test]
    fn test_get_active_variables_none_active() {
        let env_file = EnvironmentsFile {
            active_id: None,
            environments: vec![],
        };
        let vars = get_active_variables(env_file).unwrap();
        assert!(vars.is_empty());
    }
}
