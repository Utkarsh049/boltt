use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    HEAD,
    OPTIONS,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "content")]
pub enum RequestBody {
    Json(String),
    Raw(String),
    FormData(Vec<KeyValue>),
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum AuthConfig {
    None,
    Bearer { token: String },
    Basic { username: String, password: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltRequest {
    pub id: Option<String>,
    pub name: String,
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<KeyValue>,
    pub params: Vec<KeyValue>,
    pub body: RequestBody,
    pub auth: AuthConfig,
    pub ssl_verify: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<KeyValue>,
    pub body: String,
    pub time_ms: u64,
    pub size_bytes: usize,
}
