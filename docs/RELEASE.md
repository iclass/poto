# Release Process

This project uses **semantic versioning** with **package.json as the source of truth**. The git tag and package.json version must match.

## How to Create a Release

### Option 1: Using Version + Release Scripts (Recommended)
```bash
# Step 1: Update package.json version
./scripts/version.sh patch    # 1.0.5 → 1.0.6
./scripts/version.sh minor    # 1.0.5 → 1.1.0  
./scripts/version.sh major    # 1.0.5 → 2.0.0
./scripts/version.sh 1.2.3   # Set specific version

# Step 2: Commit the version change
git add package.json
git commit -m "Bump version to 1.2.3"

# Step 3: Create release (uses package.json version)
./scripts/create-release.sh
```

### Option 2: Manual Version + Release
```bash
# Step 1: Update package.json manually or with npm
npm version patch --no-git-tag-version  # Updates package.json only

# Step 2: Commit the change
git add package.json
git commit -m "Bump version to 1.2.3"

# Step 3: Create release
./scripts/create-release.sh
```

### Option 3: Override Version (Advanced)
```bash
# Create release with specific version (will warn if doesn't match package.json)
./scripts/create-release.sh v1.2.3
```

## Version Format

- **Full releases**: `v1.2.3` (major.minor.patch)
- **Pre-releases**: `v1.2.3-beta.1`, `v1.2.3-alpha.1`, `v1.2.3-rc.1`
- **Must start with 'v'** and follow semantic versioning

## What Happens When You Create a Release

1. **GitHub workflow triggers** when you push a version tag
2. **Builds and tests** the project
3. **Creates a GitHub release** with:
   - Distribution package (`poto.tar.gz`)
   - Automatic release notes
   - Pre-release flag (if version contains `-alpha`, `-beta`, `-rc`, etc.)

## Release Types

- **Full Release** (`v1.2.3`): Stable release, not marked as pre-release
- **Pre-Release** (`v1.2.3-beta.1`): Marked as pre-release in GitHub

## Examples

```bash
# Patch version bump (recommended workflow)
./scripts/version.sh patch
git add package.json && git commit -m "Bump version to 1.0.6"
./scripts/create-release.sh

# Minor version bump
./scripts/version.sh minor
git add package.json && git commit -m "Bump version to 1.1.0"
./scripts/create-release.sh

# Major version bump
./scripts/version.sh major
git add package.json && git commit -m "Bump version to 2.0.0"
./scripts/create-release.sh

# Pre-release
./scripts/version.sh 1.2.3-beta.1
git add package.json && git commit -m "Bump version to 1.2.3-beta.1"
./scripts/create-release.sh
```

## Version Management Commands

```bash
# Check current version
./scripts/version.sh

# Update to specific version
./scripts/version.sh 1.2.3

# Increment versions
./scripts/version.sh patch  # 1.0.5 → 1.0.6
./scripts/version.sh minor  # 1.0.5 → 1.1.0
./scripts/version.sh major  # 1.0.5 → 2.0.0
```

## Important Notes

- ✅ **No more automatic releases** on every commit
- ✅ **Full control** over when releases are created
- ✅ **Semantic versioning** with clear meaning
- ✅ **Pre-release support** for testing
- ✅ **Automatic build and packaging**

## Rollback

If you need to rollback a release:
1. Delete the tag: `git tag -d v1.2.3 && git push origin :v1.2.3`
2. Delete the GitHub release manually
3. Create a new release with the desired version
