#!/bin/bash
# Conductor run script - builds the Chrome Extension

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run ./toolkit/Conductor/setup.sh first."
    exit 1
fi

bun run build
