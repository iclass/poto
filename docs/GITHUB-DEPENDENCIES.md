# Using Poto Framework as GitHub Dependency

This guide shows how to reference the Poto framework directly from GitHub in your other projects, without publishing to NPM.

## 🚀 Quick Start

### Method 1: Direct GitHub URL (Recommended)

Add to your project's `package.json`:

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#main"
  }
}
```

### Method 2: Specific Version/Tag

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#v1.0.0"
  }
}
```

### Method 3: Specific Branch

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#develop"
  }
}
```

### Method 4: SSH (if you have access)

```json
{
  "dependencies": {
    "poto": "git+ssh://git@github.com/YOUR_USERNAME/poto.git#main"
  }
}
```

## 📦 Package Manager Support

### Bun (Recommended)

```bash
# Install directly
bun add git+https://github.com/YOUR_USERNAME/poto.git#main

# Or add to package.json and run
bun install
```

### npm

```bash
# Install directly
npm install git+https://github.com/YOUR_USERNAME/poto.git#main

# Or add to package.json and run
npm install
```

### yarn

```bash
# Install directly
yarn add git+https://github.com/YOUR_USERNAME/poto.git#main

# Or add to package.json and run
yarn install
```

### pnpm

```bash
# Install directly
pnpm add git+https://github.com/YOUR_USERNAME/poto.git#main

# Or add to package.json and run
pnpm install
```

## 🔧 Usage in Your Project

### Basic Import

```typescript
// Import from the installed package
import { PotoServer } from 'poto/dist/server/PotoServer';
import { PotoClient } from 'poto/dist/web/rpc/PotoClient';
import { InMemoryUserProvider } from 'poto/dist/server/UserProvider';
```

### TypeScript Configuration

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@poto/*": ["node_modules/poto/dist/*"]
    }
  }
}
```

### With Path Mapping

```typescript
// Cleaner imports with path mapping
import { PotoServer } from '@poto/server/PotoServer';
import { PotoClient } from '@poto/web/rpc/PotoClient';
```

## 🎯 Complete Example

### 1. Server Setup

```typescript
// server.ts
import { PotoServer } from 'poto/dist/server/PotoServer';
import { InMemoryUserProvider } from 'poto/dist/server/UserProvider';

const server = new PotoServer({
    port: 3999,
    staticDir: './public',
    jwtSecret: 'your-secret-key',
    routePrefix: 'api'
});

server.setUserProvider(new InMemoryUserProvider());
server.run();

console.log('Server running on http://localhost:3999');
```

### 2. Client Setup

```typescript
// client.ts
import { PotoClient } from 'poto/dist/web/rpc/PotoClient';

const client = new PotoClient('http://localhost:3999');

async function main() {
    try {
        await client.loginAsVisitor();
        console.log('Connected to Poto server');
        
        // Use your modules here
        // const myModule = client.getProxy<MyModule>('MyModule');
        
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

main();
```

### 3. Package.json Example

```json
{
  "name": "my-poto-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#main"
  },
  "scripts": {
    "dev": "bun --hot server.ts",
    "start": "bun server.ts"
  }
}
```

## 🔄 Version Management

### Update to Latest

```bash
# Update to latest main branch
bun update poto

# Or remove and reinstall
bun remove poto
bun add git+https://github.com/YOUR_USERNAME/poto.git#main
```

### Pin to Specific Version

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#v1.2.3"
  }
}
```

### Use Development Branch

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#develop"
  }
}
```

## 🚀 Advanced Usage

### Private Repository Access

If your repository is private, you'll need authentication:

#### Using Personal Access Token

```bash
# Set up authentication
git config --global url."https://YOUR_TOKEN@github.com/".insteadOf "https://github.com/"

# Then install normally
bun add git+https://github.com/YOUR_USERNAME/poto.git#main
```

#### Using SSH Keys

```bash
# Add SSH key to GitHub, then use SSH URL
bun add git+ssh://git@github.com/YOUR_USERNAME/poto.git#main
```

### Custom Build Configuration

If you need to build the framework yourself:

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#main"
  },
  "scripts": {
    "postinstall": "cd node_modules/poto && bun install && bun run build"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Build errors**: The framework needs to be built before use
   ```bash
   cd node_modules/poto
   bun install
   bun run build
   ```

2. **TypeScript errors**: Ensure you have the correct import paths
   ```typescript
   // Correct
   import { PotoServer } from 'poto/dist/server/PotoServer';
   
   // Incorrect
   import { PotoServer } from 'poto/src/server/PotoServer';
   ```

3. **Module resolution**: Check your TypeScript configuration
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true
     }
   }
   ```

### Debug Information

```bash
# Check installed version
bun list poto

# Check package contents
ls -la node_modules/poto/

# Check build output
ls -la node_modules/poto/dist/
```

## 📋 Best Practices

### 1. Use Specific Versions in Production

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#v1.0.0"
  }
}
```

### 2. Use Main Branch for Development

```json
{
  "dependencies": {
    "poto": "git+https://github.com/YOUR_USERNAME/poto.git#main"
  }
}
```

### 3. Set Up Automated Updates

Create a script to update the framework:

```bash
#!/bin/bash
# update-poto.sh
echo "Updating Poto framework..."
bun remove poto
bun add git+https://github.com/YOUR_USERNAME/poto.git#main
echo "Poto framework updated!"
```

### 4. Use GitHub Actions for Updates

```yaml
# .github/workflows/update-poto.yml
name: Update Poto Framework
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
    - run: bun update poto
    - run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add package.json bun.lockb
        git commit -m "Update Poto framework" || exit 0
        git push
```

## 🆘 Support

- **Issues**: Report issues on the [GitHub repository](https://github.com/YOUR_USERNAME/poto/issues)
- **Documentation**: Check the main [README.md](https://github.com/YOUR_USERNAME/poto/blob/main/README.md)
- **Examples**: See the `genericChatCli` directory for complete examples

## 📝 License

This framework is available under the MIT License. See the LICENSE file for details.
