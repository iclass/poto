#!/bin/bash

# Script to add Poto Framework as a dependency to an existing project

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REPO_OWNER="iclass"
REPO_NAME="poto"
VERSION="latest"
PACKAGE_NAME="poto"

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_warning "No package.json found. Creating one..."
    cat > package.json << EOF
{
  "name": "my-poto-app",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {},
  "scripts": {
    "dev": "bun run src/server.ts",
    "start": "bun run src/server.ts"
  }
}
EOF
    print_success "Created package.json"
fi

# Add Poto dependency
print_info "Adding Poto Framework as dependency..."

if [ "$VERSION" = "latest" ]; then
    DEPENDENCY_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/latest/poto.tar.gz"
else
    DEPENDENCY_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$VERSION/poto.tar.gz"
fi

# Use bun to add the dependency
bun add "$PACKAGE_NAME@$DEPENDENCY_URL"

print_success "Poto Framework added as dependency!"

# Create example files if they don't exist
if [ ! -f "src/server.ts" ]; then
    print_info "Creating example server file..."
    mkdir -p src
    cat > src/server.ts << 'EOF'
import { PotoServer, PotoModule } from 'poto';

class MyModule extends PotoModule {
    async getHello_(): Promise<string> {
        return "Hello from Poto Framework!";
    }
    
    async *getStream_(): AsyncGenerator<{ message: string; timestamp: string }> {
        for (let i = 0; i < 5; i++) {
            yield {
                message: `Stream message ${i + 1}`,
                timestamp: new Date().toISOString()
            };
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

const server = new PotoServer({
    port: 3000,
    jwtSecret: 'your-secret-key',
    staticDir: './public'
});

server.addModule(new MyModule());
server.run();

console.log('🚀 Server running on http://localhost:3000');
EOF
    print_success "Created src/server.ts"
fi

if [ ! -f "src/client.ts" ]; then
    print_info "Creating example client file..."
    cat > src/client.ts << 'EOF'
import { PotoClient } from 'poto';

async function main() {
    const client = new PotoClient('http://localhost:3000');
    
    try {
        // Example: Call a method (you'll need to define the module type)
        console.log('Connecting to Poto server...');
        
        // This is just an example - you'll need to define your actual module
        console.log('Client ready!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
EOF
    print_success "Created src/client.ts"
fi

print_success "Setup complete! 🎉"
echo ""
print_info "Next steps:"
echo "1. bun install"
echo "2. bun run dev"
echo ""
print_info "Your Poto Framework is ready to use!"
