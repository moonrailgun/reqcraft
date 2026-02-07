use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RqcConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<ConfigBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub imports: Vec<String>,
    #[serde(default)]
    pub apis: Vec<ApiBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ws_apis: Vec<WsBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub socketio_apis: Vec<WsBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sse_apis: Vec<SseBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub categories: Vec<CategoryBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsBlock {
    pub url: String,
    pub events: Vec<WsEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connect_headers: Option<SchemaBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsEvent {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<SchemaBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseBlock {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<SchemaBlock>,
    #[serde(default)]
    pub events: Vec<SseEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseEvent {
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<Field>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBlock {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    #[serde(default)]
    pub apis: Vec<ApiBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ws_apis: Vec<WsBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub socketio_apis: Vec<WsBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sse_apis: Vec<SseBlock>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<CategoryBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBlock {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub base_urls: Vec<String>,
    #[serde(default)]
    pub cors: bool,
    #[serde(default)]
    pub mock: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<VariableDefinition>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub headers: Vec<HeaderDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableDefinition {
    pub name: String,
    pub var_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderDefinition {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiBlock {
    pub path: String,
    pub methods: Vec<MethodBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodBlock {
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<SchemaBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaBlock {
    pub fields: Vec<Field>,
    #[serde(default)]
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    pub name: String,
    pub field_type: FieldType,
    #[serde(default)]
    pub optional: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nested: Option<Box<SchemaBlock>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mock: Option<MockValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub example: Option<MockValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(default)]
    pub is_params: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MockValue {
    String(String),
    Number(f64),
    Boolean(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EndpointType {
    Http,
    Websocket,
    Socketio,
    Sse,
}

// Flattened API representation for Web UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiEndpoint {
    pub id: String,
    pub endpoint_type: EndpointType,
    pub path: String,
    pub full_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events: Option<Vec<WsEvent>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sse_events: Option<Vec<SseEvent>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connect_headers: Option<SchemaBlock>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_name: Option<String>,
}

// Category representation for Web UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInfo {
    pub id: String,
    pub name: Option<String>,
    pub desc: Option<String>,
    pub endpoint_count: usize,
    #[serde(default)]
    pub children: Vec<CategoryInfo>,
}

impl RqcConfig {
    pub fn get_base_urls(&self) -> Vec<String> {
        self.config
            .as_ref()
            .map(|c| c.base_urls.clone())
            .unwrap_or_default()
    }

    pub fn to_endpoints(&self) -> Vec<ApiEndpoint> {
        let base_url = self.get_base_urls().first().cloned();
        let mut endpoints = Vec::new();
        let mut id_counter = 0;

        // Process top-level HTTP APIs
        for api in &self.apis {
            for method in &api.methods {
                id_counter += 1;
                let full_url = base_url
                    .as_ref()
                    .map(|base| format!("{}{}", base.trim_end_matches('/'), &api.path));

                endpoints.push(ApiEndpoint {
                    id: format!("api-{}", id_counter),
                    endpoint_type: EndpointType::Http,
                    path: api.path.clone(),
                    full_url,
                    method: Some(method.method.clone()),
                    name: method.name.clone(),
                    description: method.description.clone(),
                    request: method.request.clone(),
                    response: method.response.clone(),
                    events: None,
                    sse_events: None,
                    auth: None,
                    connect_headers: None,
                    category_id: None,
                    category_name: None,
                });
            }
        }

        // Process top-level WebSocket APIs
        for ws in &self.ws_apis {
            id_counter += 1;
            endpoints.push(ApiEndpoint {
                id: format!("ws-{}", id_counter),
                endpoint_type: EndpointType::Websocket,
                path: ws.url.clone(),
                full_url: Some(ws.url.clone()),
                method: None,
                name: ws.name.clone(),
                description: ws.description.clone(),
                request: None,
                response: None,
                events: Some(ws.events.clone()),
                sse_events: None,
                auth: None,
                connect_headers: None,
                category_id: None,
                category_name: None,
            });
        }

        // Process top-level SocketIO APIs
        for sio in &self.socketio_apis {
            id_counter += 1;
            endpoints.push(ApiEndpoint {
                id: format!("sio-{}", id_counter),
                endpoint_type: EndpointType::Socketio,
                path: sio.url.clone(),
                full_url: Some(sio.url.clone()),
                method: None,
                name: sio.name.clone(),
                description: sio.description.clone(),
                request: None,
                response: None,
                events: Some(sio.events.clone()),
                sse_events: None,
                auth: sio.auth.clone(),
                connect_headers: sio.connect_headers.clone(),
                category_id: None,
                category_name: None,
            });
        }

        // Process top-level SSE APIs
        for sse in &self.sse_apis {
            id_counter += 1;
            let full_url = base_url
                .as_ref()
                .map(|base| format!("{}{}", base.trim_end_matches('/'), &sse.path));

            endpoints.push(ApiEndpoint {
                id: format!("sse-{}", id_counter),
                endpoint_type: EndpointType::Sse,
                path: sse.path.clone(),
                full_url,
                method: Some("SSE".to_string()),
                name: sse.name.clone(),
                description: sse.description.clone(),
                request: sse.request.clone(),
                response: None,
                events: None,
                sse_events: Some(sse.events.clone()),
                auth: None,
                connect_headers: None,
                category_id: None,
                category_name: None,
            });
        }

        // Process categories recursively
        fn process_category(
            category: &CategoryBlock,
            base_url: &Option<String>,
            prefix_stack: &str,
            endpoints: &mut Vec<ApiEndpoint>,
            id_counter: &mut usize,
        ) {
            let current_prefix = if let Some(ref p) = category.prefix {
                format!("{}{}", prefix_stack, p)
            } else {
                prefix_stack.to_string()
            };

            // Process HTTP APIs in this category
            for api in &category.apis {
                for method in &api.methods {
                    *id_counter += 1;
                    let full_path = format!("{}{}", current_prefix, api.path);
                    let full_url = base_url
                        .as_ref()
                        .map(|base| format!("{}{}", base.trim_end_matches('/'), &full_path));

                    endpoints.push(ApiEndpoint {
                        id: format!("api-{}", id_counter),
                        endpoint_type: EndpointType::Http,
                        path: full_path,
                        full_url,
                        method: Some(method.method.clone()),
                        name: method.name.clone(),
                        description: method.description.clone(),
                        request: method.request.clone(),
                        response: method.response.clone(),
                        events: None,
                        sse_events: None,
                        auth: None,
                        connect_headers: None,
                        category_id: Some(category.id.clone()),
                        category_name: category.name.clone(),
                    });
                }
            }

            // Process WebSocket APIs in this category
            for ws in &category.ws_apis {
                *id_counter += 1;
                endpoints.push(ApiEndpoint {
                    id: format!("ws-{}", id_counter),
                    endpoint_type: EndpointType::Websocket,
                    path: ws.url.clone(),
                    full_url: Some(ws.url.clone()),
                    method: None,
                    name: ws.name.clone(),
                    description: ws.description.clone(),
                    request: None,
                    response: None,
                    events: Some(ws.events.clone()),
                    sse_events: None,
                    auth: None,
                    connect_headers: None,
                    category_id: Some(category.id.clone()),
                    category_name: category.name.clone(),
                });
            }

            // Process SocketIO APIs in this category
            for sio in &category.socketio_apis {
                *id_counter += 1;
                endpoints.push(ApiEndpoint {
                    id: format!("sio-{}", id_counter),
                    endpoint_type: EndpointType::Socketio,
                    path: sio.url.clone(),
                    full_url: Some(sio.url.clone()),
                    method: None,
                    name: sio.name.clone(),
                    description: sio.description.clone(),
                    request: None,
                    response: None,
                    events: Some(sio.events.clone()),
                    sse_events: None,
                    auth: sio.auth.clone(),
                    connect_headers: sio.connect_headers.clone(),
                    category_id: Some(category.id.clone()),
                    category_name: category.name.clone(),
                });
            }

            // Process SSE APIs in this category
            for sse in &category.sse_apis {
                *id_counter += 1;
                let full_path = format!("{}{}", current_prefix, sse.path);
                let full_url = base_url
                    .as_ref()
                    .map(|base| format!("{}{}", base.trim_end_matches('/'), &full_path));

                endpoints.push(ApiEndpoint {
                    id: format!("sse-{}", id_counter),
                    endpoint_type: EndpointType::Sse,
                    path: full_path,
                    full_url,
                    method: Some("SSE".to_string()),
                    name: sse.name.clone(),
                    description: sse.description.clone(),
                    request: sse.request.clone(),
                    response: None,
                    events: None,
                    sse_events: Some(sse.events.clone()),
                    auth: None,
                    connect_headers: None,
                    category_id: Some(category.id.clone()),
                    category_name: category.name.clone(),
                });
            }

            // Process nested categories
            for child in &category.children {
                process_category(child, base_url, &current_prefix, endpoints, id_counter);
            }
        }

        for category in &self.categories {
            process_category(category, &base_url, "", &mut endpoints, &mut id_counter);
        }

        endpoints
    }

    pub fn to_categories(&self) -> Vec<CategoryInfo> {
        fn convert_category(category: &CategoryBlock) -> CategoryInfo {
            let mut endpoint_count = 0;
            for api in &category.apis {
                endpoint_count += api.methods.len();
            }
            endpoint_count += category.ws_apis.len();
            endpoint_count += category.socketio_apis.len();
            endpoint_count += category.sse_apis.len();

            CategoryInfo {
                id: category.id.clone(),
                name: category.name.clone(),
                desc: category.desc.clone(),
                endpoint_count,
                children: category.children.iter().map(convert_category).collect(),
            }
        }

        self.categories.iter().map(convert_category).collect()
    }
}
