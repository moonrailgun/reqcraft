use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "rqc")]
#[command(author, version, about = "ReqCraft - API Request Crafting Tool", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Initialize a new project, creates .rqc file in current directory
    Init,

    /// Start development server with web UI
    Dev {
        /// Port to listen on
        #[arg(short, long, default_value = "6400")]
        port: u16,

        /// Host to bind to
        #[arg(short = 'H', long, default_value = "127.0.0.1")]
        host: String,

        /// Enable mock mode - intercept requests and return mock data
        #[arg(short, long, default_value = "false")]
        mock: bool,

        /// Enable CORS proxy mode - proxy requests through local server to bypass CORS
        #[arg(short, long, default_value = "false")]
        cors: bool,

        /// Enable watch mode - auto reload on .rqc file changes
        #[arg(short, long, default_value = "false")]
        watch: bool,
    },
}

impl Cli {
    pub fn parse_args() -> Self {
        Cli::parse()
    }
}
