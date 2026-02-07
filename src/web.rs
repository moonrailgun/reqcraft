use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, Request, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{any, get},
    Json, Router,
};
use rust_embed::Embed;
use serde::Serialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::{Arc, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};

use crate::parser::{ApiEndpoint, CategoryInfo, EndpointType, FieldType, HeaderDefinition, MockValue, RqcConfig, SchemaBlock, VariableDefinition};

#[derive(Embed)]
#[folder = "web-ui/dist"]
struct Assets;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<RwLock<RqcConfig>>,
    pub mock_mode: bool,
    pub cors_mode: bool,
    pub http_client: reqwest::Client,
    pub reload_tx: tokio::sync::broadcast::Sender<()>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiInfo {
    pub name: String,
    pub version: String,
    pub base_urls: Vec<String>,
    pub endpoint_count: usize,
    pub mock_mode: bool,
    pub cors_mode: bool,
}

pub async fn start_server(
    host: &str,
    port: u16,
    config: Arc<RwLock<RqcConfig>>,
    mock_mode: bool,
    cors_mode: bool,
    reload_tx: tokio::sync::broadcast::Sender<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    let http_client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()?;

    let state = AppState {
        config,
        mock_mode,
        cors_mode,
        http_client,
        reload_tx,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = Router::new()
        .route("/api/info", get(api_info))
        .route("/api/config", get(get_config))
        .route("/api/endpoints", get(get_endpoints))
        .route("/api/categories", get(get_categories))
        .route("/api/variables", get(get_variables))
        .route("/api/headers", get(get_headers))
        .route("/ws", get(ws_handler));

    // Add mock proxy endpoint in mock mode
    if mock_mode {
        app = app.route("/mock/*path", any(mock_handler));
    }

    // Add CORS proxy endpoint in cors mode
    if cors_mode {
        app = app.route("/proxy/*path", any(cors_proxy_handler));
    }

    let app = app.fallback(static_handler).layer(cors).with_state(state);

    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
    info!("ReqCraft dev server running at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                [(header::CONTENT_TYPE, mime.as_ref())],
                content.data.into_owned(),
            )
                .into_response()
        }
        None => {
            // SPA fallback: serve index.html for client-side routing
            match Assets::get("index.html") {
                Some(content) => (
                    [(header::CONTENT_TYPE, "text/html")],
                    content.data.into_owned(),
                )
                    .into_response(),
                None => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
            }
        }
    }
}

async fn api_info(State(state): State<AppState>) -> Json<ApiInfo> {
    let config = state.config.read().unwrap();
    let endpoints = config.to_endpoints();
    Json(ApiInfo {
        name: "reqcraft".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        base_urls: config.get_base_urls(),
        endpoint_count: endpoints.len(),
        mock_mode: state.mock_mode,
        cors_mode: state.cors_mode,
    })
}

async fn get_config(State(state): State<AppState>) -> Json<RqcConfig> {
    let config = state.config.read().unwrap();
    Json(config.clone())
}

async fn get_endpoints(State(state): State<AppState>) -> Json<Vec<ApiEndpoint>> {
    let config = state.config.read().unwrap();
    Json(config.to_endpoints())
}

async fn get_categories(State(state): State<AppState>) -> Json<Vec<CategoryInfo>> {
    let config = state.config.read().unwrap();
    Json(config.to_categories())
}

async fn get_variables(State(state): State<AppState>) -> Json<Vec<VariableDefinition>> {
    let config = state.config.read().unwrap();
    Json(
        config
            .config
            .as_ref()
            .map(|c| c.variables.clone())
            .unwrap_or_default(),
    )
}

async fn get_headers(State(state): State<AppState>) -> Json<Vec<HeaderDefinition>> {
    let config = state.config.read().unwrap();
    Json(
        config
            .config
            .as_ref()
            .map(|c| c.headers.clone())
            .unwrap_or_default(),
    )
}

async fn mock_handler(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request<Body>,
) -> Response {
    let method = req.method().clone();
    let request_path = format!("/{}", path);

    // Find matching API endpoint from flattened endpoints list
    let config = state.config.read().unwrap();
    let endpoints = config.to_endpoints();
    for endpoint in &endpoints {
        if endpoint.endpoint_type == EndpointType::Http
            && endpoint.path == request_path
            && endpoint.method.as_deref() == Some(method.as_str())
        {
            // Found matching endpoint, generate mock response
            if let Some(ref response_schema) = endpoint.response {
                let mock_data = generate_mock_response(response_schema);
                return Json(mock_data).into_response();
            } else {
                return Json(json!({})).into_response();
            }
        }
    }

    // No mock found, return 404 with info
    (
        StatusCode::NOT_FOUND,
        Json(json!({
            "error": "No mock defined",
            "path": request_path,
            "method": method.as_str()
        })),
    )
        .into_response()
}

fn generate_mock_response(schema: &SchemaBlock) -> Value {
    let mut obj = serde_json::Map::new();

    for field in &schema.fields {
        let value = if let Some(ref mock) = field.mock {
            match mock {
                MockValue::String(s) => Value::String(s.clone()),
                MockValue::Number(n) => json!(*n),
                MockValue::Boolean(b) => Value::Bool(*b),
            }
        } else if let Some(ref nested) = field.nested {
            generate_mock_response(nested)
        } else {
            // Generate default mock based on type
            match field.field_type {
                FieldType::String => Value::String(format!("mock_{}", field.name)),
                FieldType::Number => json!(0),
                FieldType::Boolean => Value::Bool(false),
                FieldType::Array => Value::Array(vec![]),
                FieldType::Object => Value::Object(serde_json::Map::new()),
            }
        };

        obj.insert(field.name.clone(), value);
    }

    Value::Object(obj)
}

async fn cors_proxy_handler(
    State(state): State<AppState>,
    Path(path): Path<String>,
    headers: HeaderMap,
    method: Method,
    body: Body,
) -> Response {
    // The path format should be: /proxy/{encoded_url}
    // where encoded_url is the full URL to proxy to
    let target_url = match urlencoding::decode(&path) {
        Ok(url) => url.to_string(),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "Invalid URL encoding",
                    "path": path
                })),
            )
                .into_response();
        }
    };

    // Build the request
    let client = &state.http_client;
    let mut request_builder = match method {
        Method::GET => client.get(&target_url),
        Method::POST => client.post(&target_url),
        Method::PUT => client.put(&target_url),
        Method::DELETE => client.delete(&target_url),
        Method::PATCH => client.patch(&target_url),
        Method::HEAD => client.head(&target_url),
        Method::OPTIONS => client.request(reqwest::Method::OPTIONS, &target_url),
        _ => {
            return (
                StatusCode::METHOD_NOT_ALLOWED,
                Json(json!({
                    "error": "Method not allowed",
                    "method": method.as_str()
                })),
            )
                .into_response();
        }
    };

    // Forward headers (except host and some hop-by-hop headers)
    let skip_headers = [
        "host",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    ];

    for (key, value) in headers.iter() {
        let key_str = key.as_str().to_lowercase();
        if !skip_headers.contains(&key_str.as_str()) {
            if let Ok(header_name) = reqwest::header::HeaderName::from_bytes(key.as_str().as_bytes())
            {
                if let Ok(header_value) = reqwest::header::HeaderValue::from_bytes(value.as_bytes())
                {
                    request_builder = request_builder.header(header_name, header_value);
                }
            }
        }
    }

    // Forward body for methods that support it
    if matches!(
        method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    ) {
        let body_bytes = match axum::body::to_bytes(body, usize::MAX).await {
            Ok(bytes) => bytes,
            Err(e) => {
                warn!("Failed to read request body: {}", e);
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "error": "Failed to read request body",
                        "details": e.to_string()
                    })),
                )
                    .into_response();
            }
        };
        request_builder = request_builder.body(body_bytes);
    }

    // Execute the request
    match request_builder.send().await {
        Ok(response) => {
            let status = StatusCode::from_u16(response.status().as_u16())
                .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

            // Build response headers
            let mut response_headers = HeaderMap::new();
            for (key, value) in response.headers().iter() {
                let key_str = key.as_str().to_lowercase();
                // Skip CORS and hop-by-hop headers as we manage CORS ourselves
                if !skip_headers.contains(&key_str.as_str())
                    && !key_str.starts_with("access-control-")
                {
                    if let Ok(header_name) = HeaderName::from_bytes(key.as_str().as_bytes()) {
                        if let Ok(header_value) = HeaderValue::from_bytes(value.as_bytes()) {
                            response_headers.insert(header_name, header_value);
                        }
                    }
                }
            }

            // Stream the response body directly (supports SSE and large responses)
            let body = Body::from_stream(response.bytes_stream());
            (status, response_headers, body).into_response()
        }
        Err(e) => {
            warn!("Proxy request failed: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": "Proxy request failed",
                    "target_url": target_url,
                    "details": e.to_string()
                })),
            )
                .into_response()
        }
    }
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(|socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: AppState) {
    let mut rx = state.reload_tx.subscribe();
    loop {
        tokio::select! {
            result = rx.recv() => {
                match result {
                    Ok(()) => {
                        let msg = Message::Text(r#"{"type":"reload"}"#.into());
                        if socket.send(msg).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}
