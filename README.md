# ReqCraft

A powerful API testing tool powered by DSL configuration.

[![CI](https://github.com/moonrailgun/reqcraft/workflows/CI/badge.svg)](https://github.com/moonrailgun/reqcraft/actions)
[![Release](https://img.shields.io/github/v/release/moonrailgun/reqcraft)](https://github.com/moonrailgun/reqcraft/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **DSL-Powered** - Define your APIs using simple `.rqc` configuration files
- 🎭 **Mock Mode** - Get instant mock responses for rapid development
- 🌐 **Web UI** - Beautiful built-in web interface for testing APIs
- 📦 **Single Binary** - No dependencies, just download and run
- 🔄 **OpenAPI Import** - Import existing OpenAPI/Swagger specifications
- 🌍 **Multi-Environment** - Switch between different base URLs easily

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/moonrailgun/reqcraft/main/install.sh | bash
```

### Manual Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/moonrailgun/reqcraft/releases).

#### Linux (x86_64)
```bash
curl -LO https://github.com/moonrailgun/reqcraft/releases/latest/download/reqcraft-x86_64-unknown-linux-gnu.tar.gz
tar xzf reqcraft-x86_64-unknown-linux-gnu.tar.gz
sudo mv reqcraft /usr/local/bin/
```

#### macOS (Apple Silicon)
```bash
curl -LO https://github.com/moonrailgun/reqcraft/releases/latest/download/reqcraft-aarch64-apple-darwin.tar.gz
tar xzf reqcraft-aarch64-apple-darwin.tar.gz
sudo mv reqcraft /usr/local/bin/
```

#### macOS (Intel)
```bash
curl -LO https://github.com/moonrailgun/reqcraft/releases/latest/download/reqcraft-x86_64-apple-darwin.tar.gz
tar xzf reqcraft-x86_64-apple-darwin.tar.gz
sudo mv reqcraft /usr/local/bin/
```

#### Windows
Download `reqcraft-x86_64-pc-windows-msvc.zip` from the releases page and add to your PATH.

### From Source

```bash
git clone https://github.com/moonrailgun/reqcraft.git
cd reqcraft
cd web-ui && npm install && npm run build && cd ..
cargo build --release
```

## Quick Start

1. Initialize a new project:
   ```bash
   reqcraft init
   ```

2. Start the development server:
   ```bash
   reqcraft dev
   ```

3. Enable mock mode for testing:
   ```bash
   reqcraft dev --mock
   ```

4. Open http://localhost:6400 in your browser

## DSL Syntax

Create a `.rqc` file to define your APIs:

```rqc
// Import other files
import "./user-api.rqc"
import "./openapi.json"

config {
  baseUrl http://localhost:3000, https://api.example.com
}

category users {
  name "User Management"
  prefix "/api/v1"

  api /users {
    get {
      name "List Users"
      request {
        page Number @params @example(1)
        limit Number @params @example(10)
      }
      response {
        users {
          id Number @mock(1)
          name String @mock("John Doe")
        }
      }
    }

    post {
      name "Create User"
      request {
        name String @example("John")
        email String @example("john@example.com")
      }
      response {
        id Number @mock(1)
        success Boolean @mock(true)
      }
    }
  }
}
```

## Development

### Prerequisites

- Rust 1.70+
- Node.js 18+

### Building

```bash
# Build web UI
cd web-ui
npm install
npm run build
cd ..

# Build binary
cargo build --release
```

### Release

Using [cargo-release](https://github.com/crate-ci/cargo-release):

```bash
# Install cargo-release
cargo install cargo-release

# Release a new version
cargo release patch  # 0.1.0 → 0.1.1
cargo release minor  # 0.1.0 → 0.2.0
cargo release major  # 0.1.0 → 1.0.0

# Dry run (preview changes without executing)
cargo release patch --dry-run
```

## License

MIT License - see [LICENSE](LICENSE) for details.
