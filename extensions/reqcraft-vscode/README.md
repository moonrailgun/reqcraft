# ReqCraft VSCode Extension

Syntax highlighting and code completion for `.rqc` files.

## Features

- **Syntax Highlighting**: Full syntax highlighting for ReqCraft DSL
- **Code Completion**: Context-aware completions for keywords, types, and annotations
- **Snippets**: Quick templates for common patterns
- **Hover Information**: Descriptions for keywords and annotations

## Supported Syntax

### Keywords

- `import` - Import other files
- `config` - Configuration block
- `api` - API endpoint definition
- `category` - Group APIs together
- `get`, `post`, `put`, `delete`, `patch` - HTTP methods
- `request`, `response` - Request/response schemas

### Types

- `String` - String type
- `Number` - Number type
- `Boolean` - Boolean type
- `Any` - Any type

### Annotations

- `@mock("value")` - Mock value for testing
- `@example("value")` - Example value
- `@params` - Mark as URL query parameter

## Installation

### From VSIX

1. Build the extension:
   ```bash
   cd extensions/reqcraft-vscode
   npm install
   npm run compile
   npx vsce package
   ```

2. Install in VSCode:
   - Open VSCode
   - Go to Extensions (Ctrl+Shift+X)
   - Click "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

### Development

1. Open the `extensions/reqcraft` folder in VSCode
2. Press F5 to launch the Extension Development Host
3. Open a `.rqc` file to test

## Example

```rqc
import "./openapi.json"

config {
  baseUrl http://localhost:3000
}

category user {
  name "User"
  desc "User management APIs"
  prefix "/user"
  
  api /info {
    /**
     * Get user information
     */
    get {
      name "Get User Info"
      
      request {}
      
      response {
        username String @mock("john_doe")
        age Number @mock(25)
        email String
      }
    }
  }
}
```

## License

MIT
