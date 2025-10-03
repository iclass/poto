#!/bin/bash

# Script to manage package.json version
# Usage: ./scripts/version.sh [patch|minor|major|1.2.3]

set -e

# Function to get current version
get_current_version() {
    if [ -f "package.json" ]; then
        node -p "require('./package.json').version"
    else
        echo "0.0.0"
    fi
}

# Function to update package.json version
update_package_version() {
    local new_version=$1
    echo "📦 Updating package.json to version: $new_version"
    
    # Update package.json using node
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$new_version';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n');
    "
    
    echo "✅ package.json updated to $new_version"
}

# Function to show version info
show_version_info() {
    local current=$(get_current_version)
    echo "📋 Current version: $current"
    echo ""
    echo "Available commands:"
    echo "  patch  - Increment patch version (1.0.0 → 1.0.1)"
    echo "  minor  - Increment minor version (1.0.0 → 1.1.0)"
    echo "  major  - Increment major version (1.0.0 → 2.0.0)"
    echo "  1.2.3  - Set specific version"
    echo ""
    echo "Examples:"
    echo "  ./scripts/version.sh patch"
    echo "  ./scripts/version.sh 1.2.3"
}

# Parse arguments
if [ -z "$1" ]; then
    show_version_info
    exit 0
fi

VERSION_ARG=$1

# Handle semantic versioning increments
case $VERSION_ARG in
    patch|minor|major)
        CURRENT=$(get_current_version)
        echo "🔄 Incrementing $VERSION_ARG version from $CURRENT"
        
        # Use npm version to increment (but don't create git tag)
        NEW_VERSION=$(npm version $VERSION_ARG --no-git-tag-version)
        # Remove 'v' prefix that npm adds
        NEW_VERSION=${NEW_VERSION#v}
        
        echo "✅ Version updated: $CURRENT → $NEW_VERSION"
        echo ""
        echo "Next steps:"
        echo "  1. Review changes: git diff"
        echo "  2. Commit: git add package.json && git commit -m 'Bump version to $NEW_VERSION'"
        echo "  3. Create release: ./scripts/create-release.sh"
        ;;
    *)
        # Validate version format
        if [[ ! $VERSION_ARG =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
            echo "❌ Error: Invalid version format: $VERSION_ARG"
            echo "Expected format: 1.2.3 or 1.2.3-beta.1"
            exit 1
        fi
        
        CURRENT=$(get_current_version)
        echo "🔄 Setting version from $CURRENT to $VERSION_ARG"
        update_package_version $VERSION_ARG
        echo ""
        echo "Next steps:"
        echo "  1. Review changes: git diff"
        echo "  2. Commit: git add package.json && git commit -m 'Bump version to $VERSION_ARG'"
        echo "  3. Create release: ./scripts/create-release.sh"
        ;;
esac
