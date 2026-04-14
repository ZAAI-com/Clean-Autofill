#!/bin/bash
# Conductor setup script - installs dependencies and builds the extension

set -e
export PATH="$HOME/.bun/bin:$PATH"

echo "📦 Installing dependencies..."
bun install

echo ""
echo "🔨 Building extension..."
bun run build

echo ""
echo "✅ Setup complete!"
