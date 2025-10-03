# Poto Framework Integration Guide

This guide explains how to integrate the Poto framework into your other projects using the built artifacts from GitHub.

## 🚀 Quick Start

### Method 1: Using GitHub Releases (Recommended)

1. **Download the latest release:**
   ```bash
   # Get the latest release URL from GitHub
   curl -s https://api.github.com/repos/YOUR_USERNAME/poto/releases/latest | grep "browser_download_url.*poto.tar.gz" | cut -d '"' -f 4
   
   # Download and extract
   wget -O poto.tar.gz "RELEASE_URL_HERE"
   tar -xzf poto.tar.gz
   ```

2. **Copy to your project:**
   ```bash
   # Copy the framework to your project
   cp -r poto/* ./lib/poto/
   ```

3. **Update your package.json:**
   ```json
   {
     "dependencies": {
       "poto": "file:./lib/poto"
     }
   }
   ```

### Method 2: Using GitHub Actions Artifacts

1. **Download from GitHub Actions:**
   - Go to your repository's Actions tab
   - Find the latest successful workflow run
   - Download the `poto-{commit-sha}` artifact

2. **Extract and use:**
   ```bash
   # Extract the artifact
   tar -xzf poto.tar.gz
   
   # Copy to your project
   cp -r dist-package/* ./lib/poto/
   ```

### Method 3: Direct Git Submodule

```bash
# Add as submodule
git submodule add https://github.com/YOUR_USERNAME/poto.git lib/poto

# Update to latest
git submodule update --remote lib/poto
```

## 📦 Integration Examples

### Basic Server Setup

```typescript
// server.ts
import { PotoServer } from './lib/poto/dist/server/PotoServer';
import { InMemoryUserProvider } from './lib/poto/dist/server/UserProvider';

const server = new PotoServer({
    port: 3999,
    staticDir: './public',
    jwtSecret: 'your-secret-key',
    routePrefix: 'api'
});

server.setUserProvider(new InMemoryUserProvider());
server.addModule(new MyBusinessModule());
server.run();
```

### Basic Client Setup

```typescript
// client.ts
import { PotoClient } from './lib/poto/dist/web/rpc/PotoClient';

const client = new PotoClient('http://localhost:3999');
const myModule = client.getProxy<MyBusinessModule>('MyBusinessModule');
```

### TypeScript Configuration

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@poto/*": ["./lib/poto/dist/*"]
    }
  }
}
```

### Import with Path Mapping

```typescript
// Use path mapping for cleaner imports
import { PotoServer } from '@poto/server/PotoServer';
import { PotoClient } from '@poto/web/rpc/PotoClient';
```

## 🔧 Build Scripts for Your Project

Add these scripts to your project's `package.json`:

```json
{
  "scripts": {
    "update-poto": "curl -s https://api.github.com/repos/YOUR_USERNAME/poto/releases/latest | grep 'browser_download_url.*poto.tar.gz' | cut -d '\"' -f 4 | xargs wget -O poto.tar.gz && tar -xzf poto.tar.gz && cp -r poto/* ./lib/poto/ && rm -rf poto poto.tar.gz",
    "build": "bun run build:clean && bun run build:compile",
    "build:clean": "rimraf dist",
    "build:compile": "bun run tsc"
  }
}
```

## 🚀 Automated Integration

### Using GitHub Actions in Your Project

Create `.github/workflows/update-poto.yml`:

```yaml
name: Update Poto Framework

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  update-poto:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Download latest Poto release
      run: |
        curl -s https://api.github.com/repos/YOUR_USERNAME/poto/releases/latest | \
        grep "browser_download_url.*poto.tar.gz" | \
        cut -d '"' -f 4 | \
        xargs wget -O poto.tar.gz
        
    - name: Extract and update
      run: |
        tar -xzf poto.tar.gz
        rm -rf lib/poto
        mkdir -p lib
        mv poto lib/poto
        rm poto.tar.gz
        
    - name: Commit changes
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add lib/poto
        git commit -m "Update Poto framework" || exit 0
        git push
```

## 📋 Version Management

### Check Current Version

```bash
# Check the version in your project
cat lib/poto/package.json | grep version
```

### Update to Specific Version

```bash
# Update to a specific release
VERSION="v1.2.3"
curl -L "https://github.com/YOUR_USERNAME/poto/releases/download/$VERSION/poto.tar.gz" -o poto.tar.gz
tar -xzf poto.tar.gz
cp -r poto/* ./lib/poto/
rm -rf poto poto.tar.gz
```

## 🔍 Troubleshooting

### Common Issues

1. **TypeScript compilation errors:**
   ```bash
   # Ensure you have the correct TypeScript configuration
   # Check that your tsconfig.json includes the Poto types
   ```

2. **Import path issues:**
   ```bash
   # Verify the dist folder structure
   ls -la lib/poto/dist/
   ```

3. **Missing dependencies:**
   ```bash
   # Install Poto's dependencies in your project
   bun install --cwd lib/poto
   ```

### Debug Information

```bash
# Check framework structure
tree lib/poto/dist/ -I node_modules

# Verify package.json
cat lib/poto/package.json

# Check TypeScript declarations
ls lib/poto/dist/**/*.d.ts
```

## 📚 Advanced Usage

### Custom Build Configuration

If you need to customize the build process:

```bash
# Clone the framework repository
git clone https://github.com/YOUR_USERNAME/poto.git temp-poto
cd temp-poto

# Install dependencies
bun install

# Custom build
bun run build

# Copy to your project
cp -r dist ../your-project/lib/poto/dist
```

### Framework Development

For active development with the framework:

```bash
# Use git submodule for development
git submodule add https://github.com/YOUR_USERNAME/poto.git lib/poto
cd lib/poto
git checkout develop  # or your development branch
```

## 🆘 Support

- **Issues**: Report issues on the [GitHub repository](https://github.com/YOUR_USERNAME/poto/issues)
- **Documentation**: Check the main [README.md](https://github.com/YOUR_USERNAME/poto/blob/main/README.md)
- **Examples**: See the `genericChatCli` directory for complete examples

## 📝 License

This framework is available under the MIT License. See the LICENSE file for details.
