# Development Setup for Demoapp

## Poto Dependency Management

The demoapp can use either a **local development version** or the **published package** of Poto.

### Quick Commands

```bash
# Check current mode
bun run poto:status

# Switch to development mode (instant!)
bun run poto:dev

# Switch to production mode (installs from GitHub)
bun run poto:prod
```

## Development Mode (Recommended for Local Development)

**Uses a symlink** to the parent Poto directory for instant updates:

```bash
cd demoapp
bun run poto:dev
```

**Benefits:**
- ⚡ **Instant** - Creates a single symlink (vs 230+ seconds with `file:` protocol)
- 🔄 **Automatic updates** - Changes to poto are immediately available
- 💾 **No disk duplication** - Saves space

**Workflow:**
```bash
# 1. Make changes to poto
cd /Users/bran/localProjects/poto
vim src/shared/TypedJSON.ts

# 2. Rebuild poto
bun run build

# 3. Restart demoapp server (picks up changes automatically)
cd demoapp
killall bun
bun run server
```

**Note:** Avoid running `bun install` in demoapp when in dev mode, as it may replace the symlink. If you do, just run `bun run poto:dev` again.

## Production Mode

**Installs the published package** from GitHub:

```bash
cd demoapp
bun run poto:prod
```

**Benefits:**
- 📦 Uses the exact version specified in `package.json`
- 🔒 Stable and reproducible
- ✅ Same as deployed environments

**Use when:**
- Testing against a specific published version
- Verifying production behavior
- Preparing for deployment

## Current Status

Check which mode you're in:

```bash
bun run poto:status
```

**Output examples:**
```bash
# Development mode:
🔧 DEV mode: symlink to
/Users/bran/localProjects/poto

# Production mode:
📦 PROD mode: installed package
```

## Troubleshooting

### After `bun install` the symlink is gone

This is expected. Bun/npm replaces symlinks when installing. Just run:
```bash
bun run poto:dev
```

### Changes not appearing

1. Make sure you rebuilt poto: `cd /Users/bran/localProjects/poto && bun run build`
2. Restart the demoapp server: `killall bun && cd demoapp && bun run server`
3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Want to verify it's using the local version?

Check for recent changes in the build output or add a console.log:
```bash
grep -r "SKIPPED (no circular refs)" /Users/bran/localProjects/poto/dist/
```

If this finds matches, your local build has the optimization.

## Performance Testing

When in dev mode, you can quickly iterate on performance improvements:

```bash
# 1. Make optimization
vim /Users/bran/localProjects/poto/src/shared/TypedJSON.ts

# 2. Rebuild
cd /Users/bran/localProjects/poto && bun run build

# 3. Test immediately (symlink picks up changes)
cd demoapp
bun run test-optimization.ts

# 4. Benchmark
cd /Users/bran/localProjects/poto && bun run bench:typedjson
```

## Switching Between Modes

You can freely switch between modes as needed:

```bash
# Start with dev mode for active development
bun run poto:dev
bun run server

# Later, verify with prod version
killall bun
bun run poto:prod
bun run server

# Back to dev
killall bun  
bun run poto:dev
bun run server
```

## Tips

- **Default to dev mode** when working on poto itself
- **Test with prod mode** before creating a new release
- **Use `poto:status`** if you're not sure which mode you're in
- The symlink approach is **much faster** than `file:..` protocol (instant vs 230+ seconds)

