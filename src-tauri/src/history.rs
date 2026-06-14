use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub method: String,
    pub url: String,
    pub status: u16,
    #[serde(rename = "timeMs")]
    pub time_ms: u64,
    #[serde(rename = "sentAt")]
    pub sent_at: u64, // Epoch milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryFile {
    pub entries: Vec<HistoryEntry>,
}

fn get_history_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config directory: {}", e))?;
    Ok(config_dir.join("history.json"))
}

#[tauri::command]
pub fn load_history(app_handle: tauri::AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let file_path = get_history_file_path(&app_handle)?;
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read history file: {}", e))?;
    
    let file_data: HistoryFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse history JSON: {}", e))?;

    Ok(file_data.entries)
}

#[tauri::command]
pub fn clear_history(app_handle: tauri::AppHandle) -> Result<(), String> {
    let file_path = get_history_file_path(&app_handle)?;
    
    // Ensure parent dir exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let file_data = HistoryFile {
        entries: Vec::new(),
    };

    let content = serde_json::to_string_pretty(&file_data)
        .map_err(|e| format!("Failed to serialize empty history: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write history file: {}", e))?;

    Ok(())
}

pub fn append_history_internal(app_handle: &tauri::AppHandle, entry: HistoryEntry) -> Result<(), String> {
    let file_path = get_history_file_path(app_handle)?;

    // Ensure parent dir exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let mut entries = if file_path.exists() {
        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read history file: {}", e))?;
        let file_data: HistoryFile = serde_json::from_str(&content)
            .unwrap_or(HistoryFile { entries: Vec::new() });
        file_data.entries
    } else {
        Vec::new()
    };

    // Prepend entry
    entries.insert(0, entry);

    // Limit to 100
    if entries.len() > 100 {
        entries.truncate(100);
    }

    let file_data = HistoryFile { entries };
    let content = serde_json::to_string_pretty(&file_data)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write history file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn append_history(app_handle: tauri::AppHandle, entry: HistoryEntry) -> Result<(), String> {
    append_history_internal(&app_handle, entry)
}
