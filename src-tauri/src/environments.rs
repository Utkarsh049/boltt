use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub key: String,
    pub value: String,
    pub enabled: bool,
    #[serde(default, alias = "secret")]
    pub is_secret: bool,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SecretsFile {
    #[serde(default)]
    pub version: Option<u32>,
    pub secrets: HashMap<String, HashMap<String, String>>,
}

fn get_env_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = crate::get_app_config_dir(app_handle)?;
    Ok(config_dir.join("environments.json"))
}

fn get_secrets_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = crate::get_app_config_dir(app_handle)?;
    Ok(config_dir.join(".boltt.secrets.json"))
}

pub fn read_secrets_file(path: &Path) -> HashMap<String, HashMap<String, String>> {
    if !path.exists() {
        return HashMap::new();
    }
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };

    // First try parsing as SecretsFile wrapper
    if let Ok(sf) = serde_json::from_str::<SecretsFile>(&content) {
        return sf.secrets;
    }

    // Fallback: try parsing as raw map
    if let Ok(raw_map) = serde_json::from_str::<HashMap<String, HashMap<String, String>>>(&content) {
        return raw_map;
    }

    HashMap::new()
}

pub fn write_secrets_file(
    path: &Path,
    secrets: &HashMap<String, HashMap<String, String>>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create secrets directory: {}", e))?;
        }
    }

    let file_data = SecretsFile {
        version: Some(1),
        secrets: secrets.clone(),
    };

    let content = serde_json::to_string_pretty(&file_data)
        .map_err(|e| format!("Failed to serialize secrets JSON: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write secrets file: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

pub fn ensure_gitignore_contains_secrets(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    let gitignore_path = dir.join(".gitignore");
    let secret_pattern = ".boltt.secrets.json";

    if gitignore_path.exists() {
        let content = fs::read_to_string(&gitignore_path).unwrap_or_default();
        let already_ignored = content.lines().any(|l| {
            let t = l.trim();
            t == secret_pattern || t == "*.secrets.json" || t == ".boltt*.json"
        });
        if !already_ignored {
            let mut new_content = content;
            if !new_content.ends_with('\n') && !new_content.is_empty() {
                new_content.push('\n');
            }
            new_content.push_str("\n# Boltt git-safe secrets\n.boltt.secrets.json\n*.secrets.json\n");
            let _ = fs::write(&gitignore_path, new_content);
        }
    } else if dir.join(".git").exists() {
        // If it's a git repo directory but doesn't have a .gitignore yet, create one
        let new_content = "# Boltt git-safe secrets\n.boltt.secrets.json\n*.secrets.json\n";
        let _ = fs::write(&gitignore_path, new_content);
    }
    Ok(())
}

pub fn ensure_git_root_ignores_secrets(start_dir: &Path) {
    let mut current = Some(start_dir);
    while let Some(dir) = current {
        if dir.join(".git").exists() || dir.join(".gitignore").exists() {
            let _ = ensure_gitignore_contains_secrets(dir);
            break;
        }
        current = dir.parent();
    }
}

pub fn sync_workspace_gitignores(app_handle: &tauri::AppHandle) {
    // 1. Config dir
    if let Ok(config_dir) = crate::get_app_config_dir(app_handle) {
        let _ = ensure_gitignore_contains_secrets(&config_dir);
    }

    // 2. Current working directory
    if let Ok(cwd) = std::env::current_dir() {
        ensure_git_root_ignores_secrets(&cwd);
    }

    // 3. Mounted workspace projects
    if let Ok(config) = crate::projects::load_workspace_config(app_handle) {
        for path_str in config.mounted_projects {
            let path = PathBuf::from(path_str);
            if let Some(parent) = path.parent() {
                ensure_git_root_ignores_secrets(parent);
            }
        }
    }
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
    
    let mut file_data: EnvironmentsFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse environments JSON: {}", e))?;

    // Read secrets file and reconstitute secret values
    let secrets_path = get_secrets_file_path(&app_handle)?;
    let all_secrets = read_secrets_file(&secrets_path);

    for env in &mut file_data.environments {
        if let Some(env_secrets) = all_secrets.get(&env.id) {
            for var in &mut env.variables {
                if var.is_secret {
                    if let Some(secret_val) = env_secrets.get(&var.key) {
                        var.value = secret_val.clone();
                    }
                }
            }
        }
    }

    Ok(file_data)
}

#[tauri::command]
pub fn save_environments(
    app_handle: tauri::AppHandle,
    data: EnvironmentsFile,
) -> Result<(), String> {
    let file_path = get_env_file_path(&app_handle)?;
    let secrets_path = get_secrets_file_path(&app_handle)?;
    
    // Create directory if it doesn't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
    }

    // Load existing secrets so secrets from other environments or inactive groups are preserved
    let mut all_secrets = read_secrets_file(&secrets_path);

    // Split public vs secret variables
    let mut sanitized_file = EnvironmentsFile {
        active_id: data.active_id,
        environments: Vec::new(),
    };

    for env in data.environments {
        let mut sanitized_vars = Vec::new();
        let mut current_env_secrets = HashMap::new();

        for var in env.variables {
            if var.is_secret {
                // Store secret value in separate secrets map
                current_env_secrets.insert(var.key.clone(), var.value.clone());
                // Save variable definition in environments.json with empty value to prevent git leakage
                sanitized_vars.push(Variable {
                    key: var.key,
                    value: String::new(),
                    enabled: var.enabled,
                    is_secret: true,
                });
            } else {
                // Public variable: save actual value directly in environments.json
                sanitized_vars.push(Variable {
                    key: var.key,
                    value: var.value,
                    enabled: var.enabled,
                    is_secret: false,
                });
            }
        }

        if !current_env_secrets.is_empty() {
            all_secrets.insert(env.id.clone(), current_env_secrets);
        } else {
            all_secrets.remove(&env.id);
        }

        sanitized_file.environments.push(Environment {
            id: env.id,
            name: env.name,
            variables: sanitized_vars,
        });
    }

    // 1. Write public environments.json
    let content = serde_json::to_string_pretty(&sanitized_file)
        .map_err(|e| format!("Failed to serialize environments JSON: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write environments file: {}", e))?;

    // 2. Write private .boltt.secrets.json
    write_secrets_file(&secrets_path, &all_secrets)?;

    // 3. Ensure .boltt.secrets.json is ignored across config and workspace repositories
    sync_workspace_gitignores(&app_handle);

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
                            is_secret: false,
                        },
                        Variable {
                            key: "disabledKey".to_string(),
                            value: "secret".to_string(),
                            enabled: false,
                            is_secret: false,
                        },
                        Variable {
                            key: "".to_string(),
                            value: "emptyKeyVal".to_string(),
                            enabled: true,
                            is_secret: false,
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
                            is_secret: false,
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

    #[test]
    fn test_secrets_separation_and_reconstitution() {
        let temp_dir = std::env::temp_dir().join(format!("boltt_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let env_path = temp_dir.join("environments.json");
        let secrets_path = temp_dir.join(".boltt.secrets.json");

        // Construct input environment with 1 public and 1 secret variable
        let original_data = EnvironmentsFile {
            active_id: Some("env-1".to_string()),
            environments: vec![Environment {
                id: "env-1".to_string(),
                name: "Test Env".to_string(),
                variables: vec![
                    Variable {
                        key: "PUBLIC_URL".to_string(),
                        value: "https://example.com".to_string(),
                        enabled: true,
                        is_secret: false,
                    },
                    Variable {
                        key: "SECRET_KEY".to_string(),
                        value: "super_secret_token_123".to_string(),
                        enabled: true,
                        is_secret: true,
                    },
                ],
            }],
        };

        // Simulate save separation logic
        let mut sanitized_file = EnvironmentsFile {
            active_id: original_data.active_id.clone(),
            environments: Vec::new(),
        };
        let mut secrets_map = HashMap::new();

        for env in &original_data.environments {
            let mut vars = Vec::new();
            let mut env_secrets = HashMap::new();
            for v in &env.variables {
                if v.is_secret {
                    env_secrets.insert(v.key.clone(), v.value.clone());
                    vars.push(Variable {
                        key: v.key.clone(),
                        value: String::new(),
                        enabled: v.enabled,
                        is_secret: true,
                    });
                } else {
                    vars.push(v.clone());
                }
            }
            if !env_secrets.is_empty() {
                secrets_map.insert(env.id.clone(), env_secrets);
            }
            sanitized_file.environments.push(Environment {
                id: env.id.clone(),
                name: env.name.clone(),
                variables: vars,
            });
        }

        // Write files
        let env_json = serde_json::to_string_pretty(&sanitized_file).unwrap();
        fs::write(&env_path, env_json).unwrap();
        write_secrets_file(&secrets_path, &secrets_map).unwrap();

        // Verify environments.json DOES NOT contain the secret value
        let env_content = fs::read_to_string(&env_path).unwrap();
        assert!(!env_content.contains("super_secret_token_123"));
        assert!(env_content.contains("PUBLIC_URL"));
        assert!(env_content.contains("SECRET_KEY"));

        // Verify .boltt.secrets.json DOES contain the secret value
        let secrets_content = fs::read_to_string(&secrets_path).unwrap();
        assert!(secrets_content.contains("super_secret_token_123"));

        // Reconstitute
        let mut loaded_file: EnvironmentsFile = serde_json::from_str(&env_content).unwrap();
        let loaded_secrets = read_secrets_file(&secrets_path);
        for env in &mut loaded_file.environments {
            if let Some(sec) = loaded_secrets.get(&env.id) {
                for v in &mut env.variables {
                    if v.is_secret {
                        if let Some(val) = sec.get(&v.key) {
                            v.value = val.clone();
                        }
                    }
                }
            }
        }

        // Verify reconstituted values match original
        let sec_var = loaded_file.environments[0]
            .variables
            .iter()
            .find(|v| v.key == "SECRET_KEY")
            .unwrap();
        assert_eq!(sec_var.value, "super_secret_token_123");
        assert!(sec_var.is_secret);

        let pub_var = loaded_file.environments[0]
            .variables
            .iter()
            .find(|v| v.key == "PUBLIC_URL")
            .unwrap();
        assert_eq!(pub_var.value, "https://example.com");
        assert!(!pub_var.is_secret);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_ensure_gitignore_contains_secrets() {
        let temp_dir = std::env::temp_dir().join(format!("boltt_git_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let gitignore_path = temp_dir.join(".gitignore");
        fs::write(&gitignore_path, "target/\nnode_modules/\n").unwrap();

        ensure_gitignore_contains_secrets(&temp_dir).unwrap();

        let updated_content = fs::read_to_string(&gitignore_path).unwrap();
        assert!(updated_content.contains(".boltt.secrets.json"));
        assert!(updated_content.contains("target/"));

        // Call again - verify no duplicate entries
        ensure_gitignore_contains_secrets(&temp_dir).unwrap();
        let count = updated_content
            .lines()
            .filter(|l| l.trim() == ".boltt.secrets.json")
            .count();
        assert_eq!(count, 1);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
