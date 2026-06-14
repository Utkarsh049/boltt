use crate::http_client::{BoltRequest, BoltResponse};
use std::collections::HashMap;

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
