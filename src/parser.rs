mod ast;
mod lexer;

pub use ast::*;
pub use lexer::Lexer;

use std::fs;
use std::path::Path;

pub struct Parser {
    lexer: Lexer,
    current_token: lexer::Token,
}

impl Parser {
    pub fn new(input: &str) -> Self {
        let mut lexer = Lexer::new(input);
        let current_token = lexer.next_token();
        Self {
            lexer,
            current_token,
        }
    }

    pub fn parse_file(path: &Path) -> Result<RqcConfig, ParseError> {
        let content = fs::read_to_string(path)?;
        let mut parser = Parser::new(&content);
        parser.parse()
    }

    fn next_token(&mut self) {
        self.current_token = self.lexer.next_token();
    }

    fn expect(&mut self, expected: lexer::TokenType) -> Result<String, ParseError> {
        if self.current_token.token_type == expected {
            let value = self.current_token.literal.clone();
            self.next_token();
            Ok(value)
        } else {
            Err(ParseError::UnexpectedToken {
                expected: format!("{:?}", expected),
                got: format!("{:?}", self.current_token.token_type),
                line: self.current_token.line,
            })
        }
    }

    pub fn parse(&mut self) -> Result<RqcConfig, ParseError> {
        let mut config = RqcConfig::default();
        let mut category_counter = 0;

        while self.current_token.token_type != lexer::TokenType::Eof {
            match self.current_token.literal.as_str() {
                "config" => {
                    config.config = Some(self.parse_config_block()?);
                }
                "api" => {
                    config.apis.push(self.parse_api_block()?);
                }
                "import" => {
                    config.imports.push(self.parse_import()?);
                }
                "category" => {
                    config
                        .categories
                        .push(self.parse_category_block(&mut category_counter)?);
                }
                _ => {
                    self.next_token();
                }
            }
        }

        Ok(config)
    }

    fn parse_config_block(&mut self) -> Result<ConfigBlock, ParseError> {
        self.next_token(); // skip 'config'
        self.expect(lexer::TokenType::LBrace)?;

        let mut config = ConfigBlock::default();

        while self.current_token.token_type != lexer::TokenType::RBrace {
            match self.current_token.literal.as_str() {
                "baseUrl" => {
                    self.next_token();
                    // Parse comma-separated URLs
                    let urls_str = self.current_token.literal.clone();
                    config.base_urls = urls_str
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    self.next_token();
                }
                _ => {
                    self.next_token();
                }
            }
        }

        self.expect(lexer::TokenType::RBrace)?;
        Ok(config)
    }

    fn parse_api_block(&mut self) -> Result<ApiBlock, ParseError> {
        self.next_token(); // skip 'api'

        let path = self.current_token.literal.clone();
        self.next_token();

        self.expect(lexer::TokenType::LBrace)?;

        let mut api = ApiBlock {
            path,
            methods: Vec::new(),
        };

        let mut pending_doc_comment: Option<String> = None;

        while self.current_token.token_type != lexer::TokenType::RBrace {
            // Capture doc comments
            if self.current_token.token_type == lexer::TokenType::DocComment {
                pending_doc_comment = Some(self.current_token.literal.clone());
                self.next_token();
                continue;
            }

            let method_name = self.current_token.literal.to_lowercase();
            if ["get", "post", "put", "delete", "patch"].contains(&method_name.as_str()) {
                let mut method = self.parse_method_block()?;
                // Assign pending doc comment to method description
                if pending_doc_comment.is_some() {
                    method.description = pending_doc_comment.take();
                }
                api.methods.push(method);
            } else {
                self.next_token();
            }
        }

        self.expect(lexer::TokenType::RBrace)?;
        Ok(api)
    }

    fn parse_method_block(&mut self) -> Result<MethodBlock, ParseError> {
        let method = self.current_token.literal.to_uppercase();
        self.next_token();
        self.expect(lexer::TokenType::LBrace)?;

        let mut method_block = MethodBlock {
            method,
            name: None,
            description: None,
            request: None,
            response: None,
        };

        while self.current_token.token_type != lexer::TokenType::RBrace {
            match self.current_token.literal.as_str() {
                "name" => {
                    self.next_token();
                    if self.current_token.token_type == lexer::TokenType::String {
                        method_block.name = Some(self.current_token.literal.clone());
                        self.next_token();
                    }
                }
                "request" => {
                    self.next_token();
                    method_block.request = Some(self.parse_schema_block()?);
                }
                "response" => {
                    self.next_token();
                    method_block.response = Some(self.parse_schema_block()?);
                }
                _ => {
                    self.next_token();
                }
            }
        }

        self.expect(lexer::TokenType::RBrace)?;
        Ok(method_block)
    }

    fn parse_schema_block(&mut self) -> Result<SchemaBlock, ParseError> {
        self.expect(lexer::TokenType::LBrace)?;

        let mut fields = Vec::new();

        while self.current_token.token_type != lexer::TokenType::RBrace {
            if self.current_token.token_type == lexer::TokenType::Ident {
                fields.push(self.parse_field()?);
            } else {
                self.next_token();
            }
        }

        self.expect(lexer::TokenType::RBrace)?;

        // Check for optional marker
        let optional = if self.current_token.literal == "?" {
            self.next_token();
            true
        } else {
            false
        };

        Ok(SchemaBlock { fields, optional })
    }

    fn parse_field(&mut self) -> Result<Field, ParseError> {
        let name = self.current_token.literal.clone();
        self.next_token();

        let (field_type, nested, optional) =
            if self.current_token.token_type == lexer::TokenType::LBrace {
                // Nested object
                let schema = self.parse_schema_block()?;
                (
                    FieldType::Object,
                    Some(Box::new(schema.clone())),
                    schema.optional,
                )
            } else {
                // Simple type
                let type_str = self.current_token.literal.clone();
                self.next_token();

                let optional = if self.current_token.literal == "?" {
                    self.next_token();
                    true
                } else {
                    false
                };

                let field_type = match type_str.as_str() {
                    "String" => FieldType::String,
                    "Number" => FieldType::Number,
                    "Boolean" => FieldType::Boolean,
                    "Array" => FieldType::Array,
                    _ => FieldType::String,
                };

                (field_type, None, optional)
            };

        // Parse annotations (@mock, @example, @params)
        let mut mock: Option<MockValue> = None;
        let mut example: Option<MockValue> = None;
        let mut is_params = false;

        while self.current_token.token_type == lexer::TokenType::At {
            self.next_token(); // skip @
            let annotation_name = self.current_token.literal.clone();
            self.next_token(); // skip annotation name

            if annotation_name == "params" {
                is_params = true;
            } else if annotation_name == "mock" || annotation_name == "example" {
                self.expect(lexer::TokenType::LParen)?;

                let value = match self.current_token.token_type {
                    lexer::TokenType::String => {
                        let val = MockValue::String(self.current_token.literal.clone());
                        self.next_token();
                        val
                    }
                    lexer::TokenType::Number => {
                        let num: f64 = self.current_token.literal.parse().unwrap_or(0.0);
                        self.next_token();
                        MockValue::Number(num)
                    }
                    lexer::TokenType::Ident => {
                        let val = match self.current_token.literal.as_str() {
                            "true" => MockValue::Boolean(true),
                            "false" => MockValue::Boolean(false),
                            _ => MockValue::String(self.current_token.literal.clone()),
                        };
                        self.next_token();
                        val
                    }
                    _ => MockValue::String(String::new()),
                };

                self.expect(lexer::TokenType::RParen)?;

                if annotation_name == "mock" {
                    mock = Some(value);
                } else {
                    example = Some(value);
                }
            }
        }

        // Capture comments
        let comment = if self.current_token.token_type == lexer::TokenType::Comment {
            let c = Some(self.current_token.literal.clone());
            self.next_token();
            c
        } else {
            None
        };

        Ok(Field {
            name,
            field_type,
            optional,
            nested,
            mock,
            example,
            comment,
            is_params,
        })
    }

    fn parse_import(&mut self) -> Result<String, ParseError> {
        self.next_token(); // skip 'import'
        let path = self
            .current_token
            .literal
            .clone()
            .trim_matches('"')
            .to_string();
        self.next_token();
        Ok(path)
    }

    fn parse_category_block(&mut self, counter: &mut usize) -> Result<CategoryBlock, ParseError> {
        self.next_token(); // skip 'category'

        // Category identifier (e.g., "user")
        let category_id_name = self.current_token.literal.clone();
        self.next_token();

        self.expect(lexer::TokenType::LBrace)?;

        *counter += 1;
        let mut category = CategoryBlock {
            id: format!("cat-{}-{}", category_id_name, counter),
            name: None,
            desc: None,
            prefix: None,
            apis: Vec::new(),
            children: Vec::new(),
        };

        while self.current_token.token_type != lexer::TokenType::RBrace {
            match self.current_token.literal.as_str() {
                "name" => {
                    self.next_token();
                    if self.current_token.token_type == lexer::TokenType::String {
                        category.name = Some(self.current_token.literal.clone());
                        self.next_token();
                    }
                }
                "desc" => {
                    self.next_token();
                    if self.current_token.token_type == lexer::TokenType::String {
                        category.desc = Some(self.current_token.literal.clone());
                        self.next_token();
                    }
                }
                "prefix" => {
                    self.next_token();
                    if self.current_token.token_type == lexer::TokenType::String {
                        category.prefix = Some(self.current_token.literal.clone());
                        self.next_token();
                    } else {
                        // Allow unquoted prefix like /user
                        category.prefix = Some(self.current_token.literal.clone());
                        self.next_token();
                    }
                }
                "api" => {
                    category.apis.push(self.parse_api_block()?);
                }
                "category" => {
                    category.children.push(self.parse_category_block(counter)?);
                }
                _ => {
                    self.next_token();
                }
            }
        }

        self.expect(lexer::TokenType::RBrace)?;
        Ok(category)
    }
}

#[derive(Debug)]
pub enum ParseError {
    IoError(std::io::Error),
    UnexpectedToken {
        expected: String,
        got: String,
        line: usize,
    },
}

impl From<std::io::Error> for ParseError {
    fn from(err: std::io::Error) -> Self {
        ParseError::IoError(err)
    }
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::IoError(e) => write!(f, "IO error: {}", e),
            ParseError::UnexpectedToken {
                expected,
                got,
                line,
            } => {
                write!(f, "Line {}: expected {}, got {}", line, expected, got)
            }
        }
    }
}
