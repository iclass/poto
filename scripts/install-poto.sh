#!/bin/bash

# Poto Framework Installation Script
# This script downloads and sets up the Poto framework in your project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
REPO_OWNER="iclass"
REPO_NAME="poto"
FRAMEWORK_DIR="poto"
VERSION="latest"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIR        Directory to install Poto framework (default: poto)"
    echo "  -v, --version VER    Version to install (default: latest)"
    echo "  -o, --owner USER     GitHub repository owner (default: iclass)"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Install latest version"
    echo "  $0 -d my-framework                    # Install to custom directory"
    echo "  $0 -v v2025.10.01-abc123             # Install specific version"
    echo "  $0 -o myusername -n myrepo           # Install from different repo"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            FRAMEWORK_DIR="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -o|--owner)
            REPO_OWNER="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

print_info "Installing Poto Framework..."
print_info "Repository: $REPO_OWNER/$REPO_NAME"
print_info "Version: $VERSION"
print_info "Directory: $FRAMEWORK_DIR"

# Check if directory already exists
if [ -d "$FRAMEWORK_DIR" ]; then
    print_warning "Directory '$FRAMEWORK_DIR' already exists."
    read -p "Do you want to remove it and continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing existing directory..."
        rm -rf "$FRAMEWORK_DIR"
    else
        print_info "Installation cancelled."
        exit 0
    fi
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
print_info "Using temporary directory: $TEMP_DIR"

# Download the release
print_info "Downloading Poto framework..."

if [ "$VERSION" = "latest" ]; then
    DOWNLOAD_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/latest/download/poto.tar.gz"
else
    DOWNLOAD_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$VERSION/poto.tar.gz"
fi

print_info "Download URL: $DOWNLOAD_URL"

# Download with curl
if ! curl -L -o "$TEMP_DIR/poto.tar.gz" "$DOWNLOAD_URL"; then
    print_error "Failed to download Poto framework from $DOWNLOAD_URL"
    print_info "Please check:"
    print_info "1. Repository exists: https://github.com/$REPO_OWNER/$REPO_NAME"
    print_info "2. Version exists: $VERSION"
    print_info "3. Release has poto.tar.gz artifact"
    exit 1
fi

print_success "Download completed!"

# Extract the archive
print_info "Extracting framework..."
if ! tar -xzf "$TEMP_DIR/poto.tar.gz" -C "$TEMP_DIR"; then
    print_error "Failed to extract the archive"
    exit 1
fi

# Move to target directory
print_info "Installing to $FRAMEWORK_DIR..."
if ! mv "$TEMP_DIR" "$FRAMEWORK_DIR"; then
    print_error "Failed to move framework to target directory"
    exit 1
fi

# Clean up
rm -f "$TEMP_DIR/poto.tar.gz"

print_success "Poto framework installed successfully!"

# Show next steps
echo ""
print_info "Next steps:"
echo "1. cd $FRAMEWORK_DIR"
echo "2. bun install"
echo "3. bun run dev"
echo ""
print_info "Or integrate into your existing project:"
echo "1. Copy the framework files to your project"
echo "2. Import PotoServer and PotoClient in your code"
echo "3. Follow the integration guide in the README"
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    print_warning "Bun is not installed. Please install it first:"
    echo "curl -fsSL https://bun.sh/install | bash"
fi

print_success "Installation complete! 🎉"