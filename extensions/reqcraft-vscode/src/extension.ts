import * as vscode from 'vscode';
import * as path from 'path';

const LANG_SELECTOR = { language: 'rqc', scheme: 'file' };
const URL_PATTERN = /[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[-a-zA-Z0-9_.:/?#\[\]@!$&'()*+;=%~]+/g;
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(LANG_SELECTOR, new CompletionProvider(), '.', '@', '{'),
    vscode.languages.registerHoverProvider(LANG_SELECTOR, new HoverProvider()),
    vscode.languages.registerDefinitionProvider(LANG_SELECTOR, new DefinitionProvider()),
    vscode.languages.registerDocumentSymbolProvider(LANG_SELECTOR, new DocumentSymbolProvider()),
    vscode.languages.registerDocumentLinkProvider(LANG_SELECTOR, new DocumentLinkProvider())
  );
}

export function deactivate() {}

// Completion Provider
class CompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const items: vscode.CompletionItem[] = [];

    if (this.isTopLevel(document, position)) {
      items.push(
        this.snippet('import', 'import "${1:./path}"', 'Import another file'),
        this.snippet('config', 'config {\n\tbaseUrl ${1:http://localhost:3000}\n}', 'Configuration block'),
        this.snippet('api', 'api ${1:/path} {\n\t${2:get} {\n\t\tresponse {\n\t\t\t$0\n\t\t}\n\t}\n}', 'API endpoint'),
        this.snippet('category', 'category ${1:name} {\n\tname "${2:Display Name}"\n\t$0\n}', 'API category')
      );
    }

    if (this.isInsideBlock(document, position, 'config')) {
      items.push(this.keyword('baseUrl', 'Base URL for API requests'));
    }

    if (this.isInsideBlock(document, position, 'category')) {
      items.push(
        this.keyword('name', 'Category display name'),
        this.keyword('desc', 'Category description'),
        this.keyword('prefix', 'URL prefix for child APIs'),
        this.snippet('api', 'api ${1:path} {\n\t$0\n}', 'API endpoint'),
        this.snippet('category', 'category ${1:name} {\n\t$0\n}', 'Nested category')
      );
    }

    if (this.isInsideBlock(document, position, 'api')) {
      HTTP_METHODS.forEach(m => {
        items.push(this.snippet(m, `${m} {\n\tresponse {\n\t\t$0\n\t}\n}`, `${m.toUpperCase()} request`));
      });
    }

    if (HTTP_METHODS.some(m => this.isInsideBlock(document, position, m))) {
      items.push(
        this.keyword('name', 'API display name'),
        this.snippet('request', 'request {\n\t$0\n}', 'Request body schema'),
        this.snippet('response', 'response {\n\t$0\n}', 'Response body schema')
      );
    }

    if (this.isInsideBlock(document, position, 'request') || this.isInsideBlock(document, position, 'response')) {
      items.push(
        this.type('String'), this.type('Number'), this.type('Boolean'), this.type('Any'),
        this.snippet('field', '${1:name} ${2|String,Number,Boolean,Any|}', 'Add a field'),
        this.snippet('nested', '${1:name} {\n\t$0\n}', 'Nested object')
      );
    }

    if (linePrefix.endsWith('@')) {
      items.push(
        this.snippet('mock', 'mock(${1:"value"})', 'Mock value'),
        this.snippet('example', 'example(${1:"value"})', 'Example value'),
        this.keyword('params', 'URL query parameter')
      );
    }

    return items;
  }

  private isTopLevel(doc: vscode.TextDocument, pos: vscode.Position): boolean {
    const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), pos));
    return (text.match(/\{/g) || []).length === (text.match(/\}/g) || []).length;
  }

  private isInsideBlock(doc: vscode.TextDocument, pos: vscode.Position, block: string): boolean {
    const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), pos));
    if (!new RegExp(`\\b${block}\\b[^{]*\\{`).test(text)) return false;

    let depth = 0;
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === '}') depth++;
      if (text[i] === '{') depth--;
      if (depth < 0) return new RegExp(`\\b${block}\\b[^{]*$`).test(text.substring(0, i));
    }
    return false;
  }

  private keyword(label: string, detail: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
    item.detail = detail;
    return item;
  }

  private snippet(label: string, text: string, detail: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
    item.insertText = new vscode.SnippetString(text);
    item.detail = detail;
    return item;
  }

  private type(label: string): vscode.CompletionItem {
    return new vscode.CompletionItem(label, vscode.CompletionItemKind.TypeParameter);
  }
}

// Hover Provider
const KEYWORD_DOCS: Record<string, { desc: string; example: string }> = {
  import: {
    desc: 'Import `.rqc` files or OpenAPI specs (JSON/YAML). Supports local files and URLs.',
    example: 'import "./user-api.rqc"\nimport "https://api.example.com/openapi.json"'
  },
  config: {
    desc: 'Global configuration block.',
    example: 'config {\n  baseUrl http://localhost:3000\n}'
  },
  baseUrl: {
    desc: 'API base URL(s). Comma-separated for multi-environment.',
    example: 'baseUrl http://localhost:3000, https://api.example.com'
  },
  api: {
    desc: 'Define an API endpoint with HTTP methods.',
    example: 'api /users/{id} {\n  get {\n    response { id Number }\n  }\n}'
  },
  category: {
    desc: 'Group related APIs. Supports nesting and URL prefixes.',
    example: 'category users {\n  name "User APIs"\n  prefix "/api/v1"\n  api /list { ... }\n}'
  },
  name: { desc: 'Display name for API or category.', example: 'name "User Login"' },
  desc: { desc: 'Description for category.', example: 'desc "User management APIs"' },
  prefix: { desc: 'URL prefix for all child APIs.', example: 'prefix "/api/v1"' },
  get: { desc: 'HTTP GET method.', example: 'get {\n  response { data String }\n}' },
  post: { desc: 'HTTP POST method.', example: 'post {\n  request { name String }\n  response { id Number }\n}' },
  put: { desc: 'HTTP PUT method.', example: 'put {\n  request { name String }\n}' },
  delete: { desc: 'HTTP DELETE method.', example: 'delete {\n  response { success Boolean }\n}' },
  patch: { desc: 'HTTP PATCH method.', example: 'patch {\n  request { email String? }\n}' },
  request: { desc: 'Request body schema.', example: 'request {\n  username String @example("john")\n}' },
  response: { desc: 'Response body schema.', example: 'response {\n  id Number @mock(1)\n}' },
  String: { desc: 'String type.', example: 'name String\nemail String?' },
  Number: { desc: 'Number type (integer or float).', example: 'id Number\nprice Number @mock(99.99)' },
  Boolean: { desc: 'Boolean type.', example: 'isActive Boolean @mock(true)' },
  Any: { desc: 'Any type (no type checking).', example: 'metadata Any' },
  mock: { desc: 'Mock value for response fields.', example: 'name String @mock("John")' },
  example: { desc: 'Example value for request fields.', example: 'email String @example("john@example.com")' },
  params: { desc: 'Mark as URL query parameter.', example: 'page Number @params @example(1)' }
};

class HoverProvider implements vscode.HoverProvider {
  provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    const range = doc.getWordRangeAtPosition(pos, /@?[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!range) return;

    const word = doc.getText(range).replace(/^@/, '');
    const info = KEYWORD_DOCS[word];
    if (!info) return;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${word}\n\n${info.desc}\n\n`);
    md.appendCodeblock(info.example, 'rqc');
    md.isTrusted = true;
    return new vscode.Hover(md);
  }
}

// Definition Provider (local file imports)
class DefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(doc: vscode.TextDocument, pos: vscode.Position): vscode.LocationLink[] | undefined {
    const line = doc.lineAt(pos).text;
    const match = line.match(/^\s*import\s+["'](.+?)["']/);
    if (!match) return;

    const importPath = match[1];
    if (importPath.startsWith('http://') || importPath.startsWith('https://')) return;

    const start = line.indexOf(importPath);
    if (pos.character < start || pos.character > start + importPath.length) return;

    const targetPath = path.resolve(path.dirname(doc.uri.fsPath), importPath);
    return [{
      targetUri: vscode.Uri.file(targetPath),
      targetRange: new vscode.Range(0, 0, 0, 0),
      originSelectionRange: new vscode.Range(pos.line, start, pos.line, start + importPath.length)
    }];
  }
}

// Document Link Provider (URLs)
class DocumentLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(doc: vscode.TextDocument): vscode.DocumentLink[] {
    const text = doc.getText();
    const links: vscode.DocumentLink[] = [];
    let match;

    while ((match = URL_PATTERN.exec(text)) !== null) {
      const start = doc.positionAt(match.index);
      const end = doc.positionAt(match.index + match[0].length);
      links.push(new vscode.DocumentLink(new vscode.Range(start, end), vscode.Uri.parse(match[0])));
    }

    return links;
  }
}

// Document Symbol Provider (outline & breadcrumb)
class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(doc: vscode.TextDocument): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    this.parseBlocks(doc, doc.getText(), 0, symbols);
    return symbols;
  }

  private parseBlocks(doc: vscode.TextDocument, text: string, offset: number, symbols: vscode.DocumentSymbol[]) {
    const pattern = /\b(config|category|api)\s+([^\s{]*)\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const [full, keyword, id] = match;
      const blockEnd = this.findClosingBrace(text, match.index + full.length - 1);
      if (blockEnd === -1) continue;

      const startPos = doc.positionAt(offset + match.index);
      const endPos = doc.positionAt(offset + blockEnd + 1);
      const name = id.replace(/["']/g, '') || keyword;

      const kind = keyword === 'config' ? vscode.SymbolKind.Module
        : keyword === 'category' ? vscode.SymbolKind.Class
        : vscode.SymbolKind.Interface;

      const symbol = new vscode.DocumentSymbol(
        name, keyword, kind,
        new vscode.Range(startPos, endPos),
        new vscode.Range(startPos, doc.positionAt(offset + match.index + full.length))
      );

      const content = text.substring(match.index + full.length, blockEnd);
      const childOffset = offset + match.index + full.length;

      if (keyword === 'category') {
        this.parseBlocks(doc, content, childOffset, symbol.children);
      } else if (keyword === 'api') {
        this.parseHttpMethods(doc, content, childOffset, symbol.children);
      }

      symbols.push(symbol);
    }
  }

  private parseHttpMethods(doc: vscode.TextDocument, text: string, offset: number, symbols: vscode.DocumentSymbol[]) {
    const pattern = /\b(get|post|put|delete|patch)\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const blockEnd = this.findClosingBrace(text, match.index + match[0].length - 1);
      if (blockEnd === -1) continue;

      const startPos = doc.positionAt(offset + match.index);
      const endPos = doc.positionAt(offset + blockEnd + 1);

      const content = text.substring(match.index + match[0].length, blockEnd);
      const nameMatch = content.match(/name\s+["']([^"']+)["']/);
      const method = match[1].toUpperCase();
      const name = nameMatch ? `${method} - ${nameMatch[1]}` : method;

      symbols.push(new vscode.DocumentSymbol(
        name, 'method', vscode.SymbolKind.Method,
        new vscode.Range(startPos, endPos),
        new vscode.Range(startPos, doc.positionAt(offset + match.index + match[0].length))
      ));
    }
  }

  private findClosingBrace(text: string, start: number): number {
    let depth = 1;
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) return i;
    }
    return -1;
  }
}
