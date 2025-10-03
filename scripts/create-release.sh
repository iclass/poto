#!/bin/bash

# Script to create a semantic version release
# Usage: ./scripts/create-release.sh [v1.2.3] or ./scripts/create-release.sh (uses package.json)

set -e

# Function to get version from package.json
get_package_version() {
    if [ -f "package.json" ]; then
        node -p "require('./package.json').version"
    else
        echo ""
    fi
}

# Check if version is provided, otherwise use package.json
if [ -z "$1" ]; then
    PACKAGE_VERSION=$(get_package_version)
    if [ -z "$PACKAGE_VERSION" ]; then
        echo "❌ Error: No version provided and package.json not found"
        echo "Usage: $0 v1.2.3"
        exit 1
    fi
    VERSION="v$PACKAGE_VERSION"
    echo "📦 Using version from package.json: $VERSION"
else
    VERSION=$1
    echo "🏷️  Using provided version: $VERSION"
fi

# Validate semantic version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    echo "❌ Error: Invalid semantic version format: $VERSION"
    echo "Expected format: v1.2.3 or v1.2.3-beta.1"
    exit 1
fi

# If version was provided manually, check if it matches package.json
if [ -n "$1" ]; then
    PACKAGE_VERSION=$(get_package_version)
    if [ -n "$PACKAGE_VERSION" ]; then
        PACKAGE_VERSION_WITH_V="v$PACKAGE_VERSION"
        if [ "$VERSION" != "$PACKAGE_VERSION_WITH_V" ]; then
            echo "⚠️  Warning: Version mismatch!"
            echo "   Git tag: $VERSION"
            echo "   package.json: $PACKAGE_VERSION_WITH_V"
            echo ""
            read -p "Continue with git tag version? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "❌ Aborted. Please update package.json first:"
                echo "   npm version $VERSION --no-git-tag-version"
                exit 1
            fi
        fi
    fi
fi

echo "🚀 Creating release: $VERSION"

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not 'main'"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi
fi

# Check if tag already exists
if git tag -l | grep -q "^$VERSION$"; then
    echo "❌ Error: Tag $VERSION already exists"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Working directory is not clean"
    echo "Please commit or stash your changes first"
    exit 1
fi

# Create and push the tag
echo "📝 Creating tag: $VERSION"
git tag -a "$VERSION" -m "Release $VERSION"

echo "📤 Pushing tag to origin..."
git push origin "$VERSION"

echo "✅ Release $VERSION created successfully!"
echo ""
echo "The GitHub workflow will now:"
echo "  1. Build and test the project"
echo "  2. Create a GitHub release with the distribution package"
echo "  3. Mark as pre-release if version contains '-alpha', '-beta', '-rc', etc."
echo ""
echo "You can monitor the workflow at:"
echo "https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\)\.git.*/\1/')/actions"
