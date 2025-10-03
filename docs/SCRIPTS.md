# Bun Scripts Reference

This project includes centralized Bun scripts for version management and releases.

## 📋 Version Management

### Check Current Version
```bash
bun run version
# Shows current version and available commands
```

### Bump Versions
```bash
# Patch version (bug fixes): 1.0.7 → 1.0.8
bun run version:patch

# Minor version (new features): 1.0.7 → 1.1.0
bun run version:minor

# Major version (breaking changes): 1.0.7 → 2.0.0
bun run version:major
```

### Set Specific Version
```bash
# Set any version you want
bun run version 1.2.3
bun run version 1.0.7-beta.1
```

## 🚀 Release Management

### Check Release Readiness
```bash
# Verify working directory is clean
bun run release:check
```

### Create Release (Manual Steps)
```bash
# Step 1: Bump version
bun run version:patch

# Step 2: Commit the change
git add package.json
git commit -m "Bump version to X.X.X"

# Step 3: Create release
bun run release
```

### Create Release (One Command)
```bash
# Complete patch release (bump + commit + release)
bun run release:patch

# Complete minor release
bun run release:minor

# Complete major release
bun run release:major
```

## 🎯 Quick Reference

| Command | Description | Example |
|---------|-------------|---------|
| `bun run version` | Show current version | `1.0.7` |
| `bun run version:patch` | Bump patch version | `1.0.7 → 1.0.8` |
| `bun run version:minor` | Bump minor version | `1.0.7 → 1.1.0` |
| `bun run version:major` | Bump major version | `1.0.7 → 2.0.0` |
| `bun run release:check` | Check if ready for release | ✅/❌ |
| `bun run release` | Create release from current version | Creates `v1.0.7` |
| `bun run release:patch` | Complete patch release | Bump + Commit + Release |
| `bun run release:minor` | Complete minor release | Bump + Commit + Release |
| `bun run release:major` | Complete major release | Bump + Commit + Release |

## 🔄 Common Workflows

### Bug Fix Release
```bash
# Quick patch release
bun run release:patch
```

### Feature Release
```bash
# Quick minor release
bun run release:minor
```

### Breaking Change Release
```bash
# Quick major release
bun run release:major
```

### Pre-release
```bash
# Set pre-release version
bun run version 1.2.3-beta.1
git add package.json
git commit -m "Bump version to 1.2.3-beta.1"
bun run release
```

## ⚠️ Important Notes

- **Always commit changes** before creating releases
- **Check working directory** with `bun run release:check`
- **Version must match** between `package.json` and git tag
- **GitHub workflow validates** version sync automatically

## 🛠️ Development Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the project |
| `npm run test` | Run tests |
| `npm run server` | Start development server |
| `npm run client` | Start development client |
| `npm run quickchat` | Start quick chat client |
