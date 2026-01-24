use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, Request, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{any, get},
    Json, Router,
};
use rust_embed::Embed;
use serde::Serialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::parser::{ApiEndpoint, CategoryInfo, EndpointType, FieldType, MockValue, RqcConfig, SchemaBlock};

#[derive(Embed)]
#[folder = "web-ui/dist"]
struct Assets;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<RqcConfig>,
    pub mock_mode: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiInfo {
    pub name: String,
    pub version: String,
    pub base_urls: Vec<String>,
    pub endpoint_count: usize,
    pub mock_mode: bool,
}

pub async fn start_server(
    host: &str,
    port: u16,
    config: RqcConfig,
    mock_mode: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState {
        config: Arc::new(config),
        mock_mode,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = Router::new()
        .route("/api/info", get(api_info))
        .route("/api/config", get(get_config))
        .route("/api/endpoints", get(get_endpoints))
        .route("/api/categories", get(get_categories));

    // Add mock proxy endpoint in mock mode
    if mock_mode {
        app = app.route("/mock/*path", any(mock_handler));
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
    let endpoints = state.config.to_endpoints();
    Json(ApiInfo {
        name: "reqcraft".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        base_urls: state.config.get_base_urls(),
        endpoint_count: endpoints.len(),
        mock_mode: state.mock_mode,
    })
}

async fn get_config(State(state): State<AppState>) -> Json<RqcConfig> {
    Json((*state.config).clone())
}

async fn get_endpoints(State(state): State<AppState>) -> Json<Vec<ApiEndpoint>> {
    Json(state.config.to_endpoints())
}

async fn get_categories(State(state): State<AppState>) -> Json<Vec<CategoryInfo>> {
    Json(state.config.to_categories())
}

async fn mock_handler(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request<Body>,
) -> Response {
    let method = req.method().clone();
    let request_path = format!("/{}", path);

    // Find matching API endpoint from flattened endpoints list
    let endpoints = state.config.to_endpoints();
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
