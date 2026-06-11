use crate::http_client::{BoltRequest, BoltResponse, KeyValue};

#[tauri::command]
pub async fn send_request(request: BoltRequest) -> Result<BoltResponse, String> {
    println!("Backend received send_request invoke for: {}", request.name);
    Ok(BoltResponse {
        status: 200,
        status_text: "OK".to_string(),
        headers: vec![
            KeyValue {
                key: "Content-Type".to_string(),
                value: "application/json".to_string(),
                enabled: true,
            },
            KeyValue {
                key: "Server".to_string(),
                value: "BolttMock/0.1.0".to_string(),
                enabled: true,
            },
        ],
        body: r#"{"status": "success", "message": "Hello from Boltt Rust backend!"}"#.to_string(),
        time_ms: 45,
        size_bytes: 68,
    })
}
