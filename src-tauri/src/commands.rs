use crate::http_client::{BoltRequest, BoltResponse};
use std::collections::HashMap;

#[tauri::command]
pub async fn send_request(
    request: BoltRequest,
    env: Option<HashMap<String, String>>,
) -> Result<BoltResponse, String> {
    let env_map = env.unwrap_or_default();
    crate::http_client::execute_request(request, env_map).await
}
