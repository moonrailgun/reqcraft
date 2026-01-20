#!/bin/bash
set -e

echo "🔨 Building ReqCraft..."

# Build frontend
echo "📦 Building frontend..."
cd web-ui
npm install
npm run build
cd ..

# Build Rust binary
echo "🦀 Building Rust binary..."
cargo build --release

# Get binary info
BINARY="target/release/reqcraft"
if [ -f "$BINARY" ]; then
    SIZE=$(du -h "$BINARY" | cut -f1)
    echo ""
    echo "✅ Build complete!"
    echo "📁 Binary: $BINARY"
    echo "📏 Size: $SIZE"
else
    echo "❌ Build failed"
    exit 1
fi
