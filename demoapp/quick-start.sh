#!/bin/bash

# Poto Demo Quick Start Script

echo "🎯 Poto Framework Demo - Quick Start"
echo "===================================="
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun is installed"

# Install dependencies
echo "📦 Installing dependencies..."
bun install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Start the demo
echo "🚀 Starting the demo..."
echo "   This will start the server, run the client demo, and clean up automatically."
echo ""

bun run start

echo ""
echo "🎉 Demo completed!"
echo ""
echo "📚 Next steps:"
echo "   • Read the README.md for more details"
echo "   • Explore the src/ directory to understand the code"
echo "   • Try running 'bun run server' and 'bun run client' separately"
echo "   • Modify the code to experiment with the framework"
