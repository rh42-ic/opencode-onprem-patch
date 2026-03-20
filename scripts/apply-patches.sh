#!/bin/bash
# apply-patches.sh - Apply onprem modifications to opencode source
# Usage: ./apply-patches.sh <opencode_source_dir>

set -e

SOURCE_DIR="${1:-.}"

if [ ! -d "$SOURCE_DIR/packages/opencode/src" ]; then
    echo "Error: Invalid opencode source directory: $SOURCE_DIR"
    echo "Usage: $0 <opencode_source_dir>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$(cd "$SCRIPT_DIR/../patches" && pwd)"

echo "Applying onprem patches to $SOURCE_DIR..."

# Check if source is a git repo
if [ ! -d "$SOURCE_DIR/.git" ]; then
    echo "Initializing git repository..."
    (cd "$SOURCE_DIR" && git init && git add -A && git commit -m "Initial commit")
fi

# Apply patches using git apply
echo "Applying patch: 0001-add-onprem-module-and-scripts.patch"
git -C "$SOURCE_DIR" apply "$PATCHES_DIR/0001-add-onprem-module-and-scripts.patch" || {
    echo "Error: Failed to apply 0001 patch"
    echo "This may happen if the source version differs from the expected version."
    echo "Try applying patches manually or check WORKFLOW.md for instructions."
    exit 1
}

echo "Applying patch: 0002-modify-source-files.patch"
git -C "$SOURCE_DIR" apply "$PATCHES_DIR/0002-modify-source-files.patch" || {
    echo "Error: Failed to apply 0002 patch"
    echo "Try applying patches manually or check WORKFLOW.md for instructions."
    exit 1
}

echo ""
echo "=== Patches applied successfully ==="
echo ""
echo "Modified files:"
echo "  - packages/opencode/src/onprem/index.ts (new)"
echo "  - packages/opencode/src/flag/flag.ts"
echo "  - packages/opencode/src/file/ripgrep.ts"
echo "  - packages/opencode/src/provider/models.ts"
echo "  - packages/opencode/src/server/server.ts"
echo "  - packages/opencode/src/installation/index.ts"
echo "  - packages/opencode/src/lsp/server.ts"
echo "  - script/download-onprem-deps.ts (new)"
echo "  - script/package-onprem-bundle.ts (new)"
echo ""
echo "Next steps:"
echo "  cd $SOURCE_DIR"
echo "  bun install"
echo "  bun run script/download-onprem-deps.ts"
echo "  BUNDLE_VERSION=x.x.x bun run script/package-onprem-bundle.ts"