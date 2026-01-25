//! OpenAPI parser - converts OpenAPI JSON/YAML to RqcConfig (supports local files and remote URLs)

use crate::parser::{
    ApiBlock, CategoryBlock, ConfigBlock, Field, FieldType, MethodBlock, MockValue, RqcConfig,
    SchemaBlock,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Deserialize)]
struct OpenApiSpec {
    servers: Option<Vec<Server>>,
    paths: Option<HashMap<String, HashMap<String, Operation>>>,
}

#[derive(Deserialize)]
struct Server {
    url: Option<String>,
}

#[derive(Deserialize)]
struct Operation {
    summary: Option<String>,
    description: Option<String>,
    #[serde(rename = "operationId")]
    operation_id: Option<String>,
    tags: Option<Vec<String>>,
    parameters: Option<Vec<Parameter>>,
    #[serde(rename = "requestBody")]
    request_body: Option<RequestBody>,
    responses: Option<HashMap<String, Response>>,
}

#[derive(Deserialize)]
struct Parameter {
    name: Option<String>,
    #[serde(rename = "in")]
    location: Option<String>,
    description: Option<String>,
    required: Option<bool>,
    schema: Option<Schema>,
}

#[derive(Deserialize)]
struct RequestBody {
    content: Option<HashMap<String, MediaType>>,
}

#[derive(Deserialize, Clone)]
struct Response {
    content: Option<HashMap<String, MediaType>>,
}

#[derive(Deserialize, Clone)]
struct MediaType {
    schema: Option<Schema>,
}

#[derive(Deserialize, Clone)]
struct Schema {
    #[serde(rename = "type")]
    schema_type: Option<String>,
    properties: Option<HashMap<String, Schema>>,
    items: Option<Box<Schema>>,
    required: Option<Vec<String>>,
    description: Option<String>,
    example: Option<serde_json::Value>,
}

/// Parse OpenAPI from a local file
pub fn parse_openapi_file(path: &Path) -> Result<RqcConfig, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    parse_openapi_content(&content, ext)
}

/// Parse OpenAPI from a remote URL
pub fn parse_openapi_url(url: &str) -> Result<RqcConfig, Box<dyn std::error::Error>> {
    let response = reqwest::blocking::get(url)?;

    if !response.status().is_success() {
        return Err(format!("HTTP error {}: {}", response.status(), url).into());
    }

    // Determine format from Content-Type header or URL extension
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let ext = if content_type.contains("yaml") || content_type.contains("yml") {
        "yaml"
    } else if content_type.contains("json") {
        "json"
    } else {
        // Fallback to URL extension
        url.rsplit('.').next().unwrap_or("json")
    };

    let content = response.text()?;
    parse_openapi_content(&content, ext)
}

/// Check if a path is a URL
pub fn is_url(path: &str) -> bool {
    path.starts_with("http://") || path.starts_with("https://")
}

fn parse_openapi_content(
    content: &str,
    ext: &str,
) -> Result<RqcConfig, Box<dyn std::error::Error>> {
    let spec: OpenApiSpec = match ext {
        "json" => serde_json::from_str(content)?,
        "yaml" | "yml" => serde_yaml::from_str(content)?,
        _ => {
            // Try JSON first, then YAML
            serde_json::from_str(content)
                .or_else(|_| serde_yaml::from_str(content))
                .map_err(|e| format!("Failed to parse OpenAPI: {}", e))?
        }
    };

    convert_to_rqc(spec)
}

fn convert_to_rqc(spec: OpenApiSpec) -> Result<RqcConfig, Box<dyn std::error::Error>> {
    let mut config = RqcConfig::default();

    // Extract base URL from servers
    if let Some(servers) = spec.servers {
        if let Some(url) = servers.first().and_then(|s| s.url.clone()) {
            config.config = Some(ConfigBlock {
                base_urls: vec![url],
                cors: false,
                mock: false,
                variables: Vec::new(),
                headers: Vec::new(),
            });
        }
    }

    // Convert paths to APIs
    let Some(paths) = spec.paths else {
        return Ok(config);
    };

    let mut tag_groups: HashMap<String, Vec<ApiBlock>> = HashMap::new();
    let mut untagged_apis: Vec<ApiBlock> = Vec::new();

    for (path, methods) in paths {
        let mut api_block = ApiBlock {
            path: path.clone(),
            methods: Vec::new(),
        };
        let mut api_tag: Option<String> = None;

        for (method, op) in methods {
            let method_upper = method.to_uppercase();
            if !matches!(
                method_upper.as_str(),
                "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
            ) {
                continue;
            }

            if api_tag.is_none() {
                api_tag = op.tags.as_ref().and_then(|t| t.first().cloned());
            }

            let mut request_fields = parse_parameters(&op.parameters);

            // Parse request body
            if let Some(body) = op.request_body {
                if let Some(schema) = body
                    .content
                    .and_then(|c| c.get("application/json").cloned())
                    .and_then(|m| m.schema)
                {
                    request_fields.extend(parse_schema(&schema));
                }
            }

            // Parse response
            let response = op.responses.and_then(|r| {
                r.get("200")
                    .or_else(|| r.get("201"))
                    .or_else(|| r.get("default"))
                    .cloned()
            });

            let response_fields = response
                .and_then(|r| r.content)
                .and_then(|c| c.get("application/json").cloned())
                .and_then(|m| m.schema)
                .map(|s| parse_schema(&s))
                .unwrap_or_default();

            api_block.methods.push(MethodBlock {
                method: method_upper,
                name: op.summary.or(op.operation_id),
                description: op.description,
                request: if request_fields.is_empty() {
                    None
                } else {
                    Some(SchemaBlock {
                        fields: request_fields,
                        optional: false,
                    })
                },
                response: if response_fields.is_empty() {
                    None
                } else {
                    Some(SchemaBlock {
                        fields: response_fields,
                        optional: false,
                    })
                },
            });
        }

        if !api_block.methods.is_empty() {
            match api_tag {
                Some(tag) => tag_groups.entry(tag).or_default().push(api_block),
                None => untagged_apis.push(api_block),
            }
        }
    }

    // Build child categories from tags
    let mut children: Vec<CategoryBlock> = tag_groups
        .into_iter()
        .map(|(tag, apis)| CategoryBlock {
            id: format!("openapi-{}", tag.to_lowercase().replace(' ', "-")),
            name: Some(tag),
            desc: None,
            prefix: None,
            apis,
            ws_apis: Vec::new(),
            children: Vec::new(),
        })
        .collect();

    // Sort children by name for consistent ordering
    children.sort_by(|a, b| a.name.cmp(&b.name));

    // Wrap everything in a parent "openapi" category
    config.categories.push(CategoryBlock {
        id: "openapi".to_string(),
        name: Some("OpenAPI".to_string()),
        desc: Some("Imported from OpenAPI specification".to_string()),
        prefix: None,
        apis: untagged_apis,
        ws_apis: Vec::new(),
        children,
    });

    Ok(config)
}

fn parse_parameters(params: &Option<Vec<Parameter>>) -> Vec<Field> {
    let Some(params) = params else {
        return Vec::new();
    };

    params
        .iter()
        .filter_map(|p| {
            let name = p.name.clone()?;
            let field_type = p
                .schema
                .as_ref()
                .and_then(|s| s.schema_type.clone())
                .unwrap_or_else(|| "string".to_string());

            Some(Field {
                name,
                field_type: convert_type(&field_type),
                optional: !p.required.unwrap_or(false),
                nested: None,
                mock: None,
                comment: p.description.clone(),
                example: p.schema.as_ref().and_then(|s| convert_example(&s.example)),
                is_params: p.location.as_deref() == Some("query"),
            })
        })
        .collect()
}

fn parse_schema(schema: &Schema) -> Vec<Field> {
    let Some(properties) = &schema.properties else {
        return Vec::new();
    };

    let required = schema.required.clone().unwrap_or_default();

    properties
        .iter()
        .map(|(name, prop)| {
            let field_type = prop
                .schema_type
                .clone()
                .unwrap_or_else(|| "string".to_string());

            let nested = match field_type.as_str() {
                "object" => {
                    let fields = parse_schema(prop);
                    (!fields.is_empty()).then(|| {
                        Box::new(SchemaBlock {
                            fields,
                            optional: false,
                        })
                    })
                }
                "array" => prop.items.as_ref().and_then(|items| {
                    let fields = parse_schema(items);
                    (!fields.is_empty()).then(|| {
                        Box::new(SchemaBlock {
                            fields,
                            optional: false,
                        })
                    })
                }),
                _ => None,
            };

            Field {
                name: name.clone(),
                field_type: convert_type(&field_type),
                optional: !required.contains(name),
                nested,
                mock: None,
                comment: prop.description.clone(),
                example: convert_example(&prop.example),
                is_params: false,
            }
        })
        .collect()
}

fn convert_type(t: &str) -> FieldType {
    match t.to_lowercase().as_str() {
        "string" => FieldType::String,
        "integer" | "number" => FieldType::Number,
        "boolean" => FieldType::Boolean,
        "array" => FieldType::Array,
        "object" => FieldType::Object,
        _ => FieldType::String,
    }
}

fn convert_example(value: &Option<serde_json::Value>) -> Option<MockValue> {
    value.as_ref().and_then(|v| match v {
        serde_json::Value::String(s) => Some(MockValue::String(s.clone())),
        serde_json::Value::Number(n) => n.as_f64().map(MockValue::Number),
        serde_json::Value::Bool(b) => Some(MockValue::Boolean(*b)),
        _ => None,
    })
}
