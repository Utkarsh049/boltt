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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "config")]
pub enum AuthConfig {
    None,
    Inherit,
    Bearer { token: String },
    Basic { username: String, password: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseExtractor {
    pub id: String,
    pub source: String,
    pub property: String,
    pub target_variable: String,
    pub enabled: bool,
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
    #[serde(default)]
    pub extractors: Option<Vec<ResponseExtractor>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TimingWaterfall {
    pub dns_ms: u64,
    pub connect_ms: u64,
    pub tls_ms: u64,
    pub ttfb_ms: u64,
    pub transfer_ms: u64,
    pub total_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<KeyValue>,
    pub body: String,
    pub time_ms: u64,
    pub size_bytes: usize,
    #[serde(default)]
    pub timing: Option<TimingWaterfall>,
}

/// Evaluates built-in dynamic variables such as {{$uuid}}, {{$timestamp}}, {{$isoTimestamp}},
/// {{$randomInt}}, {{$randomEmail}}, {{$randomAlphaNumeric}}.
/// Returns Some(value) if matched, otherwise None.
pub fn generate_dynamic_variable(var_name: &str) -> Option<String> {
    match var_name {
        "$uuid" | "$guid" => Some(uuid::Uuid::new_v4().to_string()),
        "$timestamp" => Some(chrono::Utc::now().timestamp().to_string()),
        "$timestampMs" | "$timestampMillis" => Some(chrono::Utc::now().timestamp_millis().to_string()),
        "$isoTimestamp" => Some(chrono::Utc::now().to_rfc3339()),
        "$randomInt" => {
            let n = (uuid::Uuid::new_v4().as_u128() % 1000) + 1;
            Some(n.to_string())
        }
        "$randomEmail" => {
            let id = (uuid::Uuid::new_v4().as_u128() % 90000) + 10000;
            Some(format!("test.user{}@example.com", id))
        }
        "$randomAlphaNumeric" => {
            let hex = uuid::Uuid::new_v4().simple().to_string();
            Some(hex[..10].to_string())
        }
        _ => None,
    }
}

/// Substitute `{{variable}}` patterns in a string with their values from the provided map,
/// or from built-in dynamic generators like `{{$uuid}}` and `{{$timestamp}}`.
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
                } else if let Some(dynamic_val) = generate_dynamic_variable(trimmed) {
                    result.push_str(&dynamic_val);
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

/// Checks if the input string begins with a valid URI scheme (e.g., `http://`, `https://`).
pub fn has_url_scheme(url: &str) -> bool {
    if let Some(idx) = url.find("://") {
        let scheme = &url[..idx];
        if scheme.is_empty() {
            return false;
        }
        let mut chars = scheme.chars();
        match chars.next() {
            Some(first) if first.is_ascii_alphabetic() => {
                chars.all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '-' || c == '.')
            }
            _ => false,
        }
    } else {
        false
    }
}

/// Normalizes a URL string by trimming and prepending `http://` if no scheme is specified.
/// Preserves unresolved template URLs starting with `{{`.
pub fn normalize_url(raw_url: &str) -> Result<String, String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return Err("URL cannot be empty".to_string());
    }
    if trimmed.starts_with("{{") {
        return Ok(trimmed.to_string());
    }
    if !has_url_scheme(trimmed) {
        Ok(format!("http://{}", trimmed))
    } else {
        Ok(trimmed.to_string())
    }
}

/// Executes an HTTP request asynchronously using reqwest.
pub async fn execute_request(
    request: BoltRequest,
    env: HashMap<String, String>,
) -> Result<BoltResponse, String> {
    // 1. Substitute variables in URL
    let substituted_url = substitute_variables(&request.url, &env);
    let normalized_url = normalize_url(&substituted_url)?;
    let mut url = reqwest::Url::parse(&normalized_url).map_err(|e| format!("Invalid URL: {}", e))?;

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

    let host = url.host_str().unwrap_or("localhost").to_string();
    let port = url.port_or_known_default().unwrap_or(if url.scheme() == "https" { 443 } else { 80 });
    let is_https = url.scheme() == "https";

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
        AuthConfig::None | AuthConfig::Inherit => {}
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

    // 8. Fire request and measure detailed network timing waterfall
    // Phase 1: DNS Lookup
    let dns_start = Instant::now();
    let resolved_addrs: Option<Vec<std::net::SocketAddr>> = tokio::net::lookup_host((host.as_str(), port))
        .await
        .ok()
        .map(|iter| iter.collect());
    let dns_ms = dns_start.elapsed().as_millis() as u64;

    // Phase 2: TCP Connect probe
    let connect_start = Instant::now();
    let _ = if let Some(ref addrs) = resolved_addrs {
        if let Some(&first_addr) = addrs.first() {
            tokio::time::timeout(
                std::time::Duration::from_millis(1000),
                tokio::net::TcpStream::connect(first_addr),
            )
            .await
            .ok()
            .and_then(|r| r.ok())
        } else {
            None
        }
    } else {
        None
    };
    let connect_ms = connect_start.elapsed().as_millis() as u64;

    // Phase 3 & 4: TLS Handshake & TTFB
    let req_start = Instant::now();
    let send_result = req_builder.send().await;
    let req_header_duration = req_start.elapsed();

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

            // Phase 5: Content Transfer (reading body payload)
            let body_start = Instant::now();
            let body_bytes = res.bytes().await.map_err(|e| format!("Failed to read response body: {}", e))?;
            let transfer_ms = body_start.elapsed().as_millis() as u64;
            let size_bytes = body_bytes.len();
            let body = String::from_utf8_lossy(&body_bytes).into_owned();

            // Calculate estimated TLS handshake and TTFB
            let header_ms = req_header_duration.as_millis() as u64;
            let estimated_tls = if is_https { connect_ms } else { 0 };
            let (tls_ms, ttfb_ms) = if header_ms > estimated_tls {
                (estimated_tls, header_ms.saturating_sub(estimated_tls))
            } else {
                (0, header_ms)
            };

            let total_ms = dns_ms + connect_ms + tls_ms + ttfb_ms + transfer_ms;

            let timing = TimingWaterfall {
                dns_ms,
                connect_ms,
                tls_ms,
                ttfb_ms,
                transfer_ms,
                total_ms,
            };

            Ok(BoltResponse {
                status,
                status_text,
                headers: response_headers,
                body,
                time_ms: total_ms,
                size_bytes,
                timing: Some(timing),
            })
        }
        Err(e) => {
            let elapsed_ms = req_header_duration.as_millis() as u64;
            let total_ms = dns_ms + connect_ms + elapsed_ms;
            // Handle network-level errors cleanly
            Ok(BoltResponse {
                status: 0,
                status_text: "Network Error".to_string(),
                headers: Vec::new(),
                body: format!("{}", e),
                time_ms: total_ms,
                size_bytes: 0,
                timing: None,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_substitute_variables_single() {
        let mut vars = HashMap::new();
        vars.insert("baseUrl".to_string(), "https://api.example.com".to_string());
        let res = substitute_variables("{{baseUrl}}/users", &vars);
        assert_eq!(res, "https://api.example.com/users");
    }

    #[test]
    fn test_substitute_variables_with_whitespace() {
        let mut vars = HashMap::new();
        vars.insert("id".to_string(), "42".to_string());
        let res = substitute_variables("items/{{  id  }}", &vars);
        assert_eq!(res, "items/42");
    }

    #[test]
    fn test_substitute_variables_unmatched() {
        let vars = HashMap::new();
        let res = substitute_variables("{{unknown}}/test", &vars);
        assert_eq!(res, "{{unknown}}/test");
    }

    #[test]
    fn test_substitute_variables_multiple() {
        let mut vars = HashMap::new();
        vars.insert("protocol".to_string(), "https".to_string());
        vars.insert("host".to_string(), "api.example.com".to_string());
        vars.insert("version".to_string(), "v1".to_string());
        let res = substitute_variables("{{protocol}}://{{host}}/{{version}}/status", &vars);
        assert_eq!(res, "https://api.example.com/v1/status");
    }

    #[test]
    fn test_substitute_variables_dynamic_uuid() {
        let vars = HashMap::new();
        let res1 = substitute_variables("{{$uuid}}", &vars);
        let res2 = substitute_variables("{{$uuid}}", &vars);
        assert_eq!(res1.len(), 36);
        assert_ne!(res1, res2); // Each evaluation produces a unique UUID
        assert!(uuid::Uuid::parse_str(&res1).is_ok());
    }

    #[test]
    fn test_substitute_variables_dynamic_timestamp() {
        let vars = HashMap::new();
        let res = substitute_variables("{{$timestamp}}", &vars);
        let ts: i64 = res.parse().expect("should be valid integer timestamp");
        assert!(ts > 1_700_000_000);
    }

    #[test]
    fn test_substitute_variables_dynamic_iso_timestamp() {
        let vars = HashMap::new();
        let res = substitute_variables("{{$isoTimestamp}}", &vars);
        assert!(chrono::DateTime::parse_from_rfc3339(&res).is_ok());
    }

    #[test]
    fn test_substitute_variables_dynamic_random_int() {
        let vars = HashMap::new();
        let res = substitute_variables("{{$randomInt}}", &vars);
        let num: u32 = res.parse().expect("should be valid number");
        assert!((1..=1000).contains(&num));
    }

    #[test]
    fn test_substitute_variables_dynamic_random_email() {
        let vars = HashMap::new();
        let res = substitute_variables("{{$randomEmail}}", &vars);
        assert!(res.starts_with("test.user"));
        assert!(res.ends_with("@example.com"));
    }

    #[test]
    fn test_substitute_variables_user_override_precedence() {
        let mut vars = HashMap::new();
        vars.insert("$uuid".to_string(), "custom-override-id".to_string());
        let res = substitute_variables("{{$uuid}}", &vars);
        assert_eq!(res, "custom-override-id");
    }

    #[test]
    fn test_normalize_url() {
        assert_eq!(normalize_url("localhost:3000").unwrap(), "http://localhost:3000");
        assert_eq!(normalize_url("127.0.0.1:8080/api").unwrap(), "http://127.0.0.1:8080/api");
        assert_eq!(normalize_url("https://api.example.com").unwrap(), "https://api.example.com");
        assert_eq!(normalize_url("http://api.example.com").unwrap(), "http://api.example.com");
        assert_eq!(
            normalize_url("localhost:3000/callback?next=https://example.com").unwrap(),
            "http://localhost:3000/callback?next=https://example.com"
        );
        assert_eq!(normalize_url("{{baseUrl}}/users").unwrap(), "{{baseUrl}}/users");
        assert!(normalize_url("").is_err());
        assert!(normalize_url("   ").is_err());
    }
}
