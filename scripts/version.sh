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

# Function to update README.md with new version
update_readme_version() {
    local new_version=$1
    if [ -f "README.md" ]; then
        # Use awk to replace version patterns in README.md
        # Replace {LATEST_VERSION} with the new version
        # Replace v[0-9].[0-9].[0-9] pattern with v + new version
        awk -v version="$new_version" '{
            gsub(/\{LATEST_VERSION\}/, version)
            gsub(/v[0-9]+\.[0-9]+\.[0-9]+/, "v" version)
        }1' README.md > README.md.tmp && mv README.md.tmp README.md
        echo "📝 Updated version patterns in README.md to v$new_version"
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
    
    # Update README.md with the new version
    update_readme_version $new_version
    
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
        
        # Calculate new version using node
        NEW_VERSION=$(node -e "
            const current = '$CURRENT';
            const [major, minor, patch] = current.split('.').map(Number);
            let newVersion;
            switch('$VERSION_ARG') {
                case 'patch': newVersion = \`\${major}.\${minor}.\${patch + 1}\`; break;
                case 'minor': newVersion = \`\${major}.\${minor + 1}.0\`; break;
                case 'major': newVersion = \`\${major + 1}.0.0\`; break;
            }
            console.log(newVersion);
        ")
        
        # Update package.json using node
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.version = '$NEW_VERSION';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n');
        "
        
        # Update README.md with the new version
        update_readme_version $NEW_VERSION
        
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
