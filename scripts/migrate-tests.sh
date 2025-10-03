#!/bin/bash

# Script to migrate test files to proper directory structure
# Run this from the project root

echo "Creating test directory structure..."

# Create test directories
mkdir -p tests/unit/server
mkdir -p tests/unit/shared
mkdir -p tests/unit/llms
mkdir -p tests/integration/llms
mkdir -p tests/e2e/web/rpc

echo "Moving test files..."

# Move unit tests
if [ -f "src/server/PotoServer.test.ts" ]; then
    mv src/server/PotoServer.test.ts tests/unit/server/
    echo "Moved PotoServer.test.ts"
fi

if [ -f "src/server/GeneratorModuleExample.test.ts" ]; then
    mv src/server/GeneratorModuleExample.test.ts tests/unit/server/
    echo "Moved GeneratorModuleExample.test.ts"
fi

if [ -f "src/shared/ReactiveBinder.test.ts" ]; then
    mv src/shared/ReactiveBinder.test.ts tests/unit/shared/
    echo "Moved ReactiveBinder.test.ts"
fi

if [ -f "src/shared/rangetools.test.ts" ]; then
    mv src/shared/rangetools.test.ts tests/unit/shared/
    echo "Moved rangetools.test.ts"
fi

if [ -f "src/shared/fetch-eventsource/parse.spec.test.ts" ]; then
    mv src/shared/fetch-eventsource/parse.spec.test.ts tests/unit/shared/
    echo "Moved parse.spec.test.ts"
fi

if [ -f "src/llms/llm.test.ts" ]; then
    mv src/llms/llm.test.ts tests/unit/llms/
    echo "Moved llm.test.ts"
fi

# Move integration tests
if [ -f "src/llms/llm.integration.test.ts" ]; then
    mv src/llms/llm.integration.test.ts tests/integration/llms/
    echo "Moved llm.integration.test.ts"
fi

# Move e2e tests
if [ -f "src/web/rpc/PotoClientPotoServerE2E.test.ts" ]; then
    mv src/web/rpc/PotoClientPotoServerE2E.test.ts tests/e2e/web/rpc/
    echo "Moved PotoClientPotoServerE2E.test.ts"
fi

echo "Cleaning up dist directory..."
# Remove test files from dist
find dist -name "*.test.js" -delete
find dist -name "*.test.d.ts" -delete
find dist -name "*.test.js.map" -delete
find dist -name "*.spec.js" -delete
find dist -name "*.spec.d.ts" -delete
find dist -name "*.spec.js.map" -delete

echo "Migration complete!"
echo "Next steps:"
echo "1. Update import paths in moved test files"
echo "2. Run 'bun test' to verify tests still work"
echo "3. Run 'bun run build' to verify no tests in dist/"
