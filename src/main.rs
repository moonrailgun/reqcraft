mod cli;
mod openapi;
mod parser;
mod web;

use cli::{Cli, Commands};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use parser::{Parser, RqcConfig};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tracing::{error, info, warn};
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
        Commands::Dev { port, host, mock, cors, watch } => {
            dev_server(&host, port, mock, cors, watch).await?;
        }
    }

    Ok(())
}

fn init_project() -> Result<(), Box<dyn std::error::Error>> {
    let rqc_path = Path::new(RQC_FILE);

    if rqc_path.exists() {
        warn!("{} already exists", RQC_FILE);
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
    info!("Created {} file with example config", RQC_FILE);
    info!("Run 'rqc dev' to start the development server");

    Ok(())
}

async fn dev_server(
    host: &str,
    port: u16,
    cli_mock: bool,
    cli_cors: bool,
    watch: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let rqc_path = Path::new(RQC_FILE);

    if !rqc_path.exists() {
        error!("{} not found. Run 'rqc init' first.", RQC_FILE);
        return Ok(());
    }

    // Parse .rqc file with imports
    let base_dir = rqc_path.parent().unwrap_or(Path::new("."));
    let config = parse_with_imports(rqc_path, base_dir)?;

    let endpoints = config.to_endpoints();
    info!("Loaded {} API endpoints from {}", endpoints.len(), RQC_FILE);

    // Merge CLI flags with config file settings (CLI takes precedence)
    let config_mock = config.config.as_ref().map(|c| c.mock).unwrap_or(false);
    let config_cors = config.config.as_ref().map(|c| c.cors).unwrap_or(false);
    
    let mock_mode = cli_mock || config_mock;
    let cors_mode = cli_cors || config_cors;

    if mock_mode {
        info!("Mock mode enabled");
    }
    if cors_mode {
        info!("CORS proxy mode enabled");
    }

    let config = Arc::new(RwLock::new(config));
    let (reload_tx, _) = tokio::sync::broadcast::channel::<()>(16);

    if watch {
        info!("Watch mode enabled - watching for .rqc file changes");
        let config_clone = Arc::clone(&config);
        let reload_tx_clone = reload_tx.clone();
        start_watcher(config_clone, reload_tx_clone)?;
    }

    web::start_server(host, port, config, mock_mode, cors_mode, reload_tx).await?;

    Ok(())
}

fn start_watcher(
    config: Arc<RwLock<RqcConfig>>,
    reload_tx: tokio::sync::broadcast::Sender<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(1);

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let is_rqc_change = matches!(
                event.kind,
                EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
            ) && event.paths.iter().any(|p| {
                p.extension().and_then(|e| e.to_str()) == Some("rqc")
                    || p.file_name().and_then(|n| n.to_str()) == Some(".rqc")
            });

            if is_rqc_change {
                let _ = tx.try_send(());
            }
        }
    })?;

    let watch_dir = Path::new(".");
    watcher.watch(watch_dir, RecursiveMode::Recursive)?;

    tokio::spawn(async move {
        let _watcher = watcher; // keep watcher alive
        while rx.recv().await.is_some() {
            // Debounce: drain pending events and wait 500ms
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            while rx.try_recv().is_ok() {}

            info!("Detected .rqc file changes, reloading...");

            let rqc_path = Path::new(RQC_FILE);
            let base_dir = rqc_path.parent().unwrap_or(Path::new("."));

            match parse_with_imports(rqc_path, base_dir) {
                Ok(new_config) => {
                    let endpoints = new_config.to_endpoints();
                    info!("Reloaded {} API endpoints from {}", endpoints.len(), RQC_FILE);
                    let mut config_guard = config.write().unwrap();
                    *config_guard = new_config;
                    drop(config_guard);
                    let _ = reload_tx.send(());
                }
                Err(e) => {
                    warn!("Failed to reload config: {}", e);
                }
            }
        }
    });

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
            match openapi::parse_openapi_url(import_path_clean) {
                Ok(imported_config) => {
                    info!("Loaded OpenAPI from URL: {}", import_path_clean);
                    merge_configs(&mut config, imported_config);
                }
                Err(e) => {
                    warn!("Failed to fetch OpenAPI {}: {}", import_path_clean, e);
                }
            }
            continue;
        }

        // Handle local file imports
        let import_file = resolve_import_path(&import_path, base_dir, file_path);

        if !import_file.exists() {
            warn!("Import not found: {}", import_path);
            continue;
        }

        let ext = import_file
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match ext {
            "rqc" => {
                info!("Importing RQC file: {}", import_path);
                let import_base = import_file.parent().unwrap_or(base_dir);
                let imported_config = parse_file_recursive(&import_file, import_base, visited)?;
                merge_configs(&mut config, imported_config);
            }
            "json" | "yaml" | "yml" => match openapi::parse_openapi_file(&import_file) {
                Ok(imported_config) => {
                    info!("Loaded OpenAPI file: {}", import_path);
                    merge_configs(&mut config, imported_config);
                }
                Err(e) => {
                    warn!("Failed to parse OpenAPI {}: {}", import_path, e);
                }
            },
            _ => {
                warn!("Unsupported import format: {}", import_path);
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

    // Merge WebSocket APIs
    target.ws_apis.extend(source.ws_apis);

    // Merge categories
    target.categories.extend(source.categories);
}
