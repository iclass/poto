# 🚀 Bun Release Commands Cheat Sheet

Quick reference for all Bun-based version and release commands.

## 📋 Version Management

```bash
# Check current version
bun run version

# Bump versions
bun run version:patch    # 1.0.7 → 1.0.8
bun run version:minor    # 1.0.7 → 1.1.0
bun run version:major    # 1.0.7 → 2.0.0

# Set specific version
bun run version 1.2.3
bun run version 1.0.7-beta.1
```

## 🚀 Release Management

```bash
# Check if ready for release
bun run release:check

# Manual release process
bun run version:patch
git add package.json && git commit -m "Bump version to X.X.X"
bun run release

# One-command releases
bun run release:patch    # Complete patch release
bun run release:minor    # Complete minor release
bun run release:major    # Complete major release
```

## 🎯 Most Common Commands

| What you want to do | Command |
|---------------------|---------|
| Quick bug fix release | `bun run release:patch` |
| New feature release | `bun run release:minor` |
| Breaking change release | `bun run release:major` |
| Check current version | `bun run version` |
| Check if ready to release | `bun run release:check` |

## 🔄 Typical Workflow

```bash
# 1. Make your changes
git add .
git commit -m "Fix bug in authentication"

# 2. Quick patch release
bun run release:patch

# Done! 🎉
```

## ⚡ Bun Benefits

- **Faster execution** than npm
- **Consistent with your workflow** (you already use Bun)
- **Same commands** as npm but faster
- **All validation and safety checks** maintained

## 🛠️ Development Commands

```bash
bun run build          # Build the project
bun run test           # Run tests
bun run server         # Start dev server
bun run client         # Start dev client
bun run quickchat      # Start quick chat
```

---

**💡 Pro Tip**: Use `bun run release:patch` for most releases - it's the fastest way to get a new version out!
