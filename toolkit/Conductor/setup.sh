#!/bin/bash
# Conductor setup script - installs dependencies and builds the extension

set -e

echo "📦 Installing dependencies..."
bun install

echo ""
echo "🔨 Building extension..."
bun run build

echo ""
echo "✅ Setup complete!"
