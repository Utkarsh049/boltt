use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

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

/// Substitute `{{variable}}` patterns in a string with their values from the provided map.
/// Any unmatched patterns are left intact.
pub fn substitute_variables(input: &str, vars: &HashMap<String, String>) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();
    
    while let Some(c) = chars.next() {
        if c == '{' && chars.peek() == Some(&'{') {
            chars.next(); // consume second '{'
            let mut var_name = String::new();
            let mut closed = false;
            while let Some(&next_c) = chars.peek() {
                if next_c == '}' {
                    chars.next(); // consume first '}'
                    if chars.peek() == Some(&'}') {
                        chars.next(); // consume second '}'
                        closed = true;
                        break;
                    } else {
                        var_name.push('}');
                    }
                } else {
                    var_name.push(chars.next().unwrap());
                }
            }
            if closed {
                let trimmed = var_name.trim();
                if let Some(val) = vars.get(trimmed) {
                    result.push_str(val);
                } else {
                    result.push_str("{{");
                    result.push_str(&var_name);
                    result.push_str("}}");
                }
            } else {
                result.push_str("{{");
                result.push_str(&var_name);
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Executes an HTTP request asynchronously using reqwest.
pub async fn execute_request(
    request: BoltRequest,
    env: HashMap<String, String>,
) -> Result<BoltResponse, String> {
    // 1. Substitute variables in URL
    let substituted_url = substitute_variables(&request.url, &env);
    let mut url = reqwest::Url::parse(&substituted_url).map_err(|e| format!("Invalid URL: {}", e))?;

    // 2. Append query parameters
    if !request.params.is_empty() {
        let mut query_pairs = url.query_pairs_mut();
        for param in &request.params {
            if param.enabled {
                let key = substitute_variables(&param.key, &env);
                let val = substitute_variables(&param.value, &env);
                query_pairs.append_pair(&key, &val);
            }
        }
    }

    // 3. Build reqwest client
    let mut client_builder = reqwest::Client::builder();
    client_builder = client_builder.timeout(std::time::Duration::from_secs(30));

    // Respect ssl_verify flag
    let ssl_verify = request.ssl_verify.unwrap_or(true);
    client_builder = client_builder.danger_accept_invalid_certs(!ssl_verify);

    let client = client_builder.build().map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // 4. Map HTTP method
    let method = match request.method {
        HttpMethod::GET => reqwest::Method::GET,
        HttpMethod::POST => reqwest::Method::POST,
        HttpMethod::PUT => reqwest::Method::PUT,
        HttpMethod::PATCH => reqwest::Method::PATCH,
        HttpMethod::DELETE => reqwest::Method::DELETE,
        HttpMethod::HEAD => reqwest::Method::HEAD,
        HttpMethod::OPTIONS => reqwest::Method::OPTIONS,
    };

    let mut req_builder = client.request(method, url);

    // 5. Inject Auth Helpers
    match &request.auth {
        AuthConfig::Bearer { token } => {
            let substituted_token = substitute_variables(token, &env);
            req_builder = req_builder.header("Authorization", format!("Bearer {}", substituted_token));
        }
        AuthConfig::Basic { username, password } => {
            let substituted_username = substitute_variables(username, &env);
            let substituted_password = substitute_variables(password, &env);
            req_builder = req_builder.basic_auth(substituted_username, Some(substituted_password));
        }
        AuthConfig::None => {}
    }

    // 6. Set custom headers (these will override auth helpers if names conflict)
    for header in &request.headers {
        if header.enabled {
            let key = substitute_variables(&header.key, &env);
            let val = substitute_variables(&header.value, &env);
            req_builder = req_builder.header(key, val);
        }
    }

    // 7. Handle request body
    match &request.body {
        RequestBody::Json(json_str) => {
            let substituted_body = substitute_variables(json_str, &env);
            req_builder = req_builder
                .header("Content-Type", "application/json")
                .body(substituted_body);
        }
        RequestBody::Raw(raw_str) => {
            let substituted_body = substitute_variables(raw_str, &env);
            req_builder = req_builder
                .header("Content-Type", "text/plain")
                .body(substituted_body);
        }
        RequestBody::FormData(form_data) => {
            let mut form = reqwest::multipart::Form::new();
            for kv in form_data {
                if kv.enabled {
                    let key = substitute_variables(&kv.key, &env);
                    let val = substitute_variables(&kv.value, &env);
                    form = form.text(key, val);
                }
            }
            req_builder = req_builder.multipart(form);
        }
        RequestBody::None => {}
    }

    // 8. Fire request and measure time
    let start_time = Instant::now();
    let send_result = req_builder.send().await;
    let duration = start_time.elapsed();

    // 9. Process result
    match send_result {
        Ok(res) => {
            let status = res.status().as_u16();
            let status_text = res.status().canonical_reason().unwrap_or("").to_string();

            // Extract headers
            let mut response_headers = Vec::new();
            for (name, value) in res.headers() {
                if let Ok(val_str) = value.to_str() {
                    response_headers.push(KeyValue {
                        key: name.as_str().to_string(),
                        value: val_str.to_string(),
                        enabled: true,
                    });
                }
            }

            // Read body
            let body_bytes = res.bytes().await.map_err(|e| format!("Failed to read response body: {}", e))?;
            let size_bytes = body_bytes.len();
            let body = String::from_utf8_lossy(&body_bytes).into_owned();

            Ok(BoltResponse {
                status,
                status_text,
                headers: response_headers,
                body,
                time_ms: duration.as_millis() as u64,
                size_bytes,
            })
        }
        Err(e) => {
            // Handle network-level errors cleanly
            Ok(BoltResponse {
                status: 0,
                status_text: "Network Error".to_string(),
                headers: Vec::new(),
                body: format!("{}", e),
                time_ms: duration.as_millis() as u64,
                size_bytes: 0,
            })
        }
    }
}
