#!/bin/bash
# Conductor run script - builds the Chrome Extension

. "$(dirname "$0")/../scripts/ensure-bun.sh"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run ./toolkit/Conductor/setup.sh first."
    exit 1
fi

"$BUN" run build
