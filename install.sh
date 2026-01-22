#!/bin/bash
set -e

# ReqCraft Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/moonrailgun/reqcraft/main/install.sh | bash

REPO="moonrailgun/reqcraft"
BINARY_NAME="reqcraft"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Detect OS and architecture
detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    linux)
      case "$ARCH" in
        x86_64) TARGET="x86_64-unknown-linux-gnu" ;;
        aarch64|arm64) TARGET="aarch64-unknown-linux-gnu" ;;
        *) error "Unsupported architecture: $ARCH" ;;
      esac
      EXT="tar.gz"
      ;;
    darwin)
      case "$ARCH" in
        x86_64) TARGET="x86_64-apple-darwin" ;;
        arm64|aarch64) TARGET="aarch64-apple-darwin" ;;
        *) error "Unsupported architecture: $ARCH" ;;
      esac
      EXT="tar.gz"
      ;;
    mingw*|msys*|cygwin*)
      TARGET="x86_64-pc-windows-msvc"
      EXT="zip"
      ;;
    *)
      error "Unsupported OS: $OS"
      ;;
  esac

  info "Detected platform: $TARGET"
}

# Get latest version from GitHub
get_latest_version() {
  info "Fetching latest version..."

  if command -v curl &> /dev/null; then
    VERSION=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
  elif command -v wget &> /dev/null; then
    VERSION=$(wget -qO- "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
  else
    error "Neither curl nor wget found. Please install one of them."
  fi

  if [ -z "$VERSION" ]; then
    error "Failed to get latest version. Please check your internet connection."
  fi

  info "Latest version: $VERSION"
}

# Download and extract binary
download_binary() {
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$BINARY_NAME-$TARGET.$EXT"
  TMP_DIR=$(mktemp -d)

  info "Downloading $BINARY_NAME $VERSION..."

  if command -v curl &> /dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/archive.$EXT"
  else
    wget -q "$DOWNLOAD_URL" -O "$TMP_DIR/archive.$EXT"
  fi

  info "Extracting..."

  case "$EXT" in
    tar.gz)
      tar xzf "$TMP_DIR/archive.$EXT" -C "$TMP_DIR"
      ;;
    zip)
      unzip -q "$TMP_DIR/archive.$EXT" -d "$TMP_DIR"
      ;;
  esac

  # Find the binary
  BINARY_PATH=$(find "$TMP_DIR" -name "$BINARY_NAME" -o -name "$BINARY_NAME.exe" | head -1)

  if [ -z "$BINARY_PATH" ]; then
    error "Binary not found in archive"
  fi

  echo "$BINARY_PATH"
}

# Install binary
install_binary() {
  BINARY_PATH=$1

  # Create install directory if it doesn't exist
  mkdir -p "$INSTALL_DIR"

  # Copy binary
  cp "$BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"
  chmod +x "$INSTALL_DIR/$BINARY_NAME"

  success "Installed $BINARY_NAME to $INSTALL_DIR/$BINARY_NAME"
}

# Add to PATH if needed
setup_path() {
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    warn "$INSTALL_DIR is not in your PATH"

    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
      bash)
        RC_FILE="$HOME/.bashrc"
        ;;
      zsh)
        RC_FILE="$HOME/.zshrc"
        ;;
      fish)
        RC_FILE="$HOME/.config/fish/config.fish"
        ;;
      *)
        RC_FILE=""
        ;;
    esac

    if [ -n "$RC_FILE" ]; then
      echo "" >> "$RC_FILE"
      echo "# ReqCraft" >> "$RC_FILE"
      echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$RC_FILE"
      success "Added $INSTALL_DIR to PATH in $RC_FILE"
      warn "Please restart your terminal or run: source $RC_FILE"
    else
      echo ""
      echo "Please add the following to your shell configuration:"
      echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
    fi
  fi
}

# Cleanup
cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

# Main
main() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       ReqCraft Installer              ║${NC}"
  echo -e "${GREEN}║   API Testing Tool powered by DSL     ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
  echo ""

  trap cleanup EXIT

  detect_platform
  get_latest_version
  BINARY_PATH=$(download_binary)
  install_binary "$BINARY_PATH"
  setup_path

  echo ""
  echo -e "${GREEN}✅ Installation complete!${NC}"
  echo ""
  echo "Get started:"
  echo "  1. Create a new project:  $BINARY_NAME init"
  echo "  2. Start dev server:      $BINARY_NAME dev"
  echo "  3. Enable mock mode:      $BINARY_NAME dev --mock"
  echo ""
  echo "Documentation: https://github.com/$REPO"
  echo ""
}

main "$@"
