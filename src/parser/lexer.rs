#[derive(Debug, Clone, PartialEq)]
pub enum TokenType {
    Ident,
    String,
    Number,
    LBrace,
    RBrace,
    LParen,
    RParen,
    Question,
    At,
    Comment,
    DocComment,
    Eof,
}

#[derive(Debug, Clone)]
pub struct Token {
    pub token_type: TokenType,
    pub literal: String,
    pub line: usize,
}

pub struct Lexer {
    input: Vec<char>,
    position: usize,
    line: usize,
}

impl Lexer {
    pub fn new(input: &str) -> Self {
        Self {
            input: input.chars().collect(),
            position: 0,
            line: 1,
        }
    }

    fn current_char(&self) -> Option<char> {
        self.input.get(self.position).copied()
    }

    fn peek_char(&self) -> Option<char> {
        self.input.get(self.position + 1).copied()
    }

    fn advance(&mut self) {
        if let Some(ch) = self.current_char() {
            if ch == '\n' {
                self.line += 1;
            }
            self.position += 1;
        }
    }

    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.current_char() {
            if ch.is_whitespace() {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn read_string(&mut self) -> String {
        let quote = self.current_char().unwrap();
        self.advance(); // skip opening quote

        let mut result = String::new();
        while let Some(ch) = self.current_char() {
            if ch == quote {
                self.advance(); // skip closing quote
                break;
            }
            result.push(ch);
            self.advance();
        }
        result
    }

    fn read_identifier(&mut self) -> String {
        let mut result = String::new();
        while let Some(ch) = self.current_char() {
            if ch.is_alphanumeric() || ch == '_' || ch == '/' || ch == ':' || ch == '.' || ch == '-' || ch == ',' {
                result.push(ch);
                self.advance();
            } else {
                break;
            }
        }
        result
    }

    fn read_number(&mut self) -> String {
        let mut result = String::new();
        let mut has_dot = false;

        // Handle negative numbers
        if self.current_char() == Some('-') {
            result.push('-');
            self.advance();
        }

        while let Some(ch) = self.current_char() {
            if ch.is_ascii_digit() {
                result.push(ch);
                self.advance();
            } else if ch == '.' && !has_dot {
                has_dot = true;
                result.push(ch);
                self.advance();
            } else {
                break;
            }
        }
        result
    }

    fn read_comment(&mut self) -> String {
        self.advance(); // skip first /
        self.advance(); // skip second /

        let mut result = String::new();
        while let Some(ch) = self.current_char() {
            if ch == '\n' {
                break;
            }
            result.push(ch);
            self.advance();
        }
        result.trim().to_string()
    }

    fn read_doc_comment(&mut self) -> String {
        self.advance(); // skip /
        self.advance(); // skip *
        self.advance(); // skip *

        let mut result = String::new();
        while let Some(ch) = self.current_char() {
            if ch == '*' && self.peek_char() == Some('/') {
                self.advance(); // skip *
                self.advance(); // skip /
                break;
            }
            result.push(ch);
            self.advance();
        }

        // Clean up the doc comment: remove leading * and extra whitespace
        result
            .lines()
            .map(|line| line.trim().trim_start_matches('*').trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn peek_char_at(&self, offset: usize) -> Option<char> {
        self.input.get(self.position + offset).copied()
    }

    pub fn next_token(&mut self) -> Token {
        self.skip_whitespace();

        let line = self.line;

        match self.current_char() {
            None => Token {
                token_type: TokenType::Eof,
                literal: String::new(),
                line,
            },
            Some(ch) => match ch {
                '{' => {
                    self.advance();
                    Token {
                        token_type: TokenType::LBrace,
                        literal: "{".to_string(),
                        line,
                    }
                }
                '}' => {
                    self.advance();
                    Token {
                        token_type: TokenType::RBrace,
                        literal: "}".to_string(),
                        line,
                    }
                }
                '(' => {
                    self.advance();
                    Token {
                        token_type: TokenType::LParen,
                        literal: "(".to_string(),
                        line,
                    }
                }
                ')' => {
                    self.advance();
                    Token {
                        token_type: TokenType::RParen,
                        literal: ")".to_string(),
                        line,
                    }
                }
                '?' => {
                    self.advance();
                    Token {
                        token_type: TokenType::Question,
                        literal: "?".to_string(),
                        line,
                    }
                }
                '@' => {
                    self.advance();
                    Token {
                        token_type: TokenType::At,
                        literal: "@".to_string(),
                        line,
                    }
                }
                '"' | '\'' => {
                    let s = self.read_string();
                    Token {
                        token_type: TokenType::String,
                        literal: s,
                        line,
                    }
                }
                '/' if self.peek_char() == Some('/') => {
                    let comment = self.read_comment();
                    Token {
                        token_type: TokenType::Comment,
                        literal: comment,
                        line,
                    }
                }
                '/' if self.peek_char() == Some('*') && self.peek_char_at(2) == Some('*') => {
                    let doc = self.read_doc_comment();
                    Token {
                        token_type: TokenType::DocComment,
                        literal: doc,
                        line,
                    }
                }
                c if c.is_ascii_digit() || (c == '-' && self.peek_char().map_or(false, |p| p.is_ascii_digit())) => {
                    let num = self.read_number();
                    Token {
                        token_type: TokenType::Number,
                        literal: num,
                        line,
                    }
                }
                _ => {
                    let ident = self.read_identifier();
                    Token {
                        token_type: TokenType::Ident,
                        literal: ident,
                        line,
                    }
                }
            },
        }
    }
}
