#!/bin/bash

echo "🚀 Starting Iframe RPC Demo..."
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Error: bun is not installed"
    echo "Please install bun first: https://bun.sh/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "demo-server.ts" ]; then
    echo "❌ Error: demo-server.ts not found"
    echo "Please run this script from the demo-iframe-rpc directory"
    exit 1
fi

echo "✅ Bun found"
echo "✅ Demo files found"
echo ""

echo "🌐 Starting demo server on http://localhost:3001"
echo "📖 Open your browser to: http://localhost:3001"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Run the demo server
bun run demo-server.ts 