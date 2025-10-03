# Bun Runtime Setup Guide

This repository uses **Bun** as the standard JavaScript/TypeScript runtime instead of npm. Bun provides significantly better performance, built-in TypeScript support, and modern tooling.

## What is Bun?

Bun is a fast all-in-one JavaScript runtime and toolkit that includes:
- **Runtime**: JavaScript/TypeScript execution engine
- **Package Manager**: Dependency management (faster than npm)
- **Bundler**: Build tool for applications
- **Test Runner**: Built-in testing framework
- **Package Installer**: Fast package installation

## Installation

### macOS & Linux
```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows
```bash
# Using PowerShell
irm bun.sh/install.ps1 | iex

# Or using Chocolatey
choco install bun
```

### Verify Installation
```bash
bun --version
# Should show version like: 1.0.x
```

## Repository Configuration

### 1. `.bunfig.toml`
- Configures Bun behavior for the entire repository
- Sets exact version pinning for reproducible builds
- Enables aggressive caching

### 2. Package Management
```bash
# Install dependencies
bun install

# Add new dependency
bun add package-name

# Add dev dependency
bun add -d package-name

# Remove dependency
bun remove package-name
```

### 3. Script Execution
```bash
# Run scripts defined in package.json
bun run script-name

# Run TypeScript files directly
bun run file.ts

# Run with hot reload
bun --hot file.ts
```

## Migration from npm

### Before (npm)
```bash
npm install
npm run dev
npm run build
npx ts-node file.ts
```

### After (Bun)
```bash
bun install
bun run dev
bun run build
bun run file.ts
```

## Benefits of Bun

### Performance
- **3x faster** than npm for package installation
- **10x faster** than Node.js for TypeScript execution
- **Built-in bundling** without additional tools

### Developer Experience
- **Zero-config TypeScript** support
- **Hot reload** out of the box
- **Built-in test runner**
- **Fast package resolution**

### Compatibility
- **Node.js compatible** APIs
- **npm registry** support
- **Existing packages** work without changes

## Script Examples

### Development
```bash
# Start development server with hot reload
bun run dev

# Run specific development script
bun run dev-front

# Run with HTTPS
bun run dev_https
```

### Building
```bash
# Build the project
bun run build

# Run build script
bun run webbuild.bun.ts
```

### Utilities
```bash
# Extract vocabulary terms
bun run extract-terms

# Run linting
bun run lint

# Fix linting issues
bun run lint:fix
```

## TypeScript Support

Bun has excellent TypeScript support out of the box:

```typescript
// No need for ts-node or separate compilation
bun run src/server/server.poto.ts

// Hot reload for development
bun --hot src/server/server.poto.ts

// Run with environment variables
bun run --env-file .env file.ts
```

## Package Lock

Bun uses `bun.lockb` as its lock file:
- **Binary format** for faster parsing
- **Deterministic** installations
- **Version pinning** for reproducible builds

## Troubleshooting

### Common Issues

1. **Bun not found**
   ```bash
   # Reinstall Bun
   curl -fsSL https://bun.sh/install | bash
   # Restart terminal
   ```

2. **Permission denied**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER ~/.bun
   ```

3. **Package conflicts**
   ```bash
   # Clear cache and reinstall
   bun install --force
   ```

### Fallback to npm
If you encounter issues with Bun, you can temporarily use npm:
```bash
npm install
npm run script-name
```

## Best Practices

1. **Always use `bun run`** instead of `npm run`
2. **Use `bun install`** for dependency management
3. **Commit `bun.lockb`** to version control
4. **Use Bun's built-in tools** when possible
5. **Test scripts** with both Bun and npm for compatibility

## Team Guidelines

- **New developers** should install Bun first
- **All scripts** should be tested with Bun
- **Documentation** should reference Bun commands
- **CI/CD** should use Bun for consistency

## Resources

- [Bun Official Documentation](https://bun.sh/docs)
- [Bun GitHub Repository](https://github.com/oven-sh/bun)
- [Migration Guide](https://bun.sh/docs/guides/migrate-from-nodejs)
- [Performance Benchmarks](https://bun.sh/docs/guides/performance)
