#!/bin/bash
# Conductor setup script - installs dependencies and builds the extension

set -e
. "$(dirname "$0")/../scripts/ensure-bun.sh"

echo "📦 Installing dependencies..."
"$BUN" install

echo ""
echo "🔨 Building extension..."
"$BUN" run build

echo ""
echo "✅ Setup complete!"
