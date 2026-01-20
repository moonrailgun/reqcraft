mod cli;
mod openapi;
mod parser;
mod web;

use cli::{Cli, Commands};
use parser::{Parser, RqcConfig};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

const RQC_FILE: &str = ".rqc";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "reqcraft=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse_args();

    match cli.command {
        Commands::Init => {
            init_project()?;
        }
        Commands::Dev { port, host, mock } => {
            dev_server(&host, port, mock).await?;
        }
    }

    Ok(())
}

fn init_project() -> Result<(), Box<dyn std::error::Error>> {
    let rqc_path = Path::new(RQC_FILE);

    if rqc_path.exists() {
        println!("⚠️  {} already exists", RQC_FILE);
        return Ok(());
    }

    // Create with example content
    let example = r#"// Import other .rqc files
// import "./user.rqc"

config {
  baseUrl http://localhost:3000
}

api /api/user {
  get {
    request {}
    response {
      username String @mock("john_doe")
      email String @mock("john@example.com")
      age Number @mock(25)
      active Boolean @mock(true)
    }
  }
}

api /api/posts {
  get {
    request {}
    response {
      title String @mock("Hello World")
      content String @mock("This is a mock post content")
    }
  }
  post {
    request {
      title String
      content String
    }
    response {
      id Number @mock(1)
      success Boolean @mock(true)
    }
  }
}
"#;
    fs::write(rqc_path, example)?;
    println!("✅ Created {} file with example config", RQC_FILE);
    println!("   Run 'rqc dev' to start the development server");

    Ok(())
}

async fn dev_server(
    host: &str,
    port: u16,
    mock_mode: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let rqc_path = Path::new(RQC_FILE);

    if !rqc_path.exists() {
        println!("❌ {} not found. Run 'rqc init' first.", RQC_FILE);
        return Ok(());
    }

    // Parse .rqc file with imports
    let base_dir = rqc_path.parent().unwrap_or(Path::new("."));
    let config = parse_with_imports(rqc_path, base_dir)?;

    info!("Loaded {} file with {} APIs", RQC_FILE, config.apis.len());

    let endpoints = config.to_endpoints();
    println!("📦 Loaded {} API endpoints", endpoints.len());

    if mock_mode {
        println!("🎭 Mock mode enabled");
    }

    web::start_server(host, port, config, mock_mode).await?;

    Ok(())
}

fn parse_with_imports(
    file_path: &Path,
    base_dir: &Path,
) -> Result<RqcConfig, Box<dyn std::error::Error>> {
    let mut visited = HashSet::new();
    parse_file_recursive(file_path, base_dir, &mut visited)
}

fn parse_file_recursive(
    file_path: &Path,
    base_dir: &Path,
    visited: &mut HashSet<PathBuf>,
) -> Result<RqcConfig, Box<dyn std::error::Error>> {
    let canonical_path = file_path.canonicalize().unwrap_or(file_path.to_path_buf());

    // Prevent circular imports
    if visited.contains(&canonical_path) {
        info!("Skipping already imported file: {:?}", file_path);
        return Ok(RqcConfig::default());
    }
    visited.insert(canonical_path);

    let content = fs::read_to_string(file_path)?;
    let mut parser = Parser::new(&content);
    let mut config = parser
        .parse()
        .map_err(|e| format!("Parse error in {:?}: {}", file_path, e))?;

    // Process imports
    let imports = std::mem::take(&mut config.imports);
    for import_path in imports {
        let import_path_clean = import_path.trim_matches(|c| c == '"' || c == '\'');

        // Check if it's a remote URL
        if openapi::is_url(import_path_clean) {
            info!("Importing OpenAPI from URL: {}", import_path_clean);
            match openapi::parse_openapi_url(import_path_clean) {
                Ok(imported_config) => {
                    println!("🌐 Loaded OpenAPI from URL: {}", import_path_clean);
                    merge_configs(&mut config, imported_config);
                }
                Err(e) => {
                    println!("⚠️  Failed to fetch OpenAPI {}: {}", import_path_clean, e);
                }
            }
            continue;
        }

        // Handle local file imports
        let import_file = resolve_import_path(&import_path, base_dir, file_path);

        if !import_file.exists() {
            println!("⚠️  Import not found: {}", import_path);
            continue;
        }

        let ext = import_file
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match ext {
            "rqc" => {
                info!("Importing RQC file: {:?}", import_file);
                let import_base = import_file.parent().unwrap_or(base_dir);
                let imported_config = parse_file_recursive(&import_file, import_base, visited)?;
                merge_configs(&mut config, imported_config);
            }
            "json" | "yaml" | "yml" => {
                info!("Importing OpenAPI file: {:?}", import_file);
                match openapi::parse_openapi_file(&import_file) {
                    Ok(imported_config) => {
                        println!("📄 Loaded OpenAPI: {}", import_path);
                        merge_configs(&mut config, imported_config);
                    }
                    Err(e) => {
                        println!("⚠️  Failed to parse OpenAPI {}: {}", import_path, e);
                    }
                }
            }
            _ => {
                println!("⚠️  Unsupported import format: {}", import_path);
            }
        }
    }

    Ok(config)
}

fn resolve_import_path(import_path: &str, base_dir: &Path, current_file: &Path) -> PathBuf {
    let import_path = import_path.trim_matches(|c| c == '"' || c == '\'');

    if import_path.starts_with("./") || import_path.starts_with("../") {
        // Relative to current file
        current_file.parent().unwrap_or(base_dir).join(import_path)
    } else {
        // Relative to base directory
        base_dir.join(import_path)
    }
}

fn merge_configs(target: &mut RqcConfig, source: RqcConfig) {
    // Merge config block (source takes precedence if target is None)
    if target.config.is_none() {
        target.config = source.config;
    } else if let (Some(ref mut t), Some(s)) = (&mut target.config, source.config) {
        if t.base_urls.is_empty() {
            t.base_urls = s.base_urls;
        }
    }

    // Merge APIs
    target.apis.extend(source.apis);

    // Merge categories
    target.categories.extend(source.categories);
}
