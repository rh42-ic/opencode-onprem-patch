#!/bin/bash

# apply-patches.sh: Apply onprem patches to OpenCode source.
# Usage: ./apply-patches.sh <opencode-source-dir>

SOURCE_DIR=$1
PATCH_DIR=$(cd "$(dirname "$0")/../patches" && pwd)
SRC_TEMPLATE_DIR=$(cd "$(dirname "$0")/../src" && pwd)
SCRIPTS_TEMPLATE_DIR=$(cd "$(dirname "$0")" && pwd)

if [ -z "$SOURCE_DIR" ]; then
    echo "Usage: $0 <opencode-source-dir>"
    exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Directory $SOURCE_DIR does not exist."
    exit 1
fi

cd "$SOURCE_DIR" || exit 1

# 1. Copy new files (additive changes)
echo "Copying onprem modules and scripts..."
mkdir -p packages/opencode/src/onprem
cp "$SRC_TEMPLATE_DIR/onprem/index.ts" packages/opencode/src/onprem/
cp "$SRC_TEMPLATE_DIR/onprem-plugins.json" script/
cp "$SRC_TEMPLATE_DIR/onprem-plugins.schema.json" script/
cp "$SCRIPTS_TEMPLATE_DIR/download-onprem-deps.ts" script/
cp "$SCRIPTS_TEMPLATE_DIR/package-onprem-bundle.ts" script/

# 2. Apply patches (modifications)
echo "Applying patches..."
for patch in "$PATCH_DIR"/*.patch; do
    echo "Applying $(basename "$patch")..."
    git apply "$patch"
    if [ $? -ne 0 ]; then
        echo "Warning: Failed to apply $(basename "$patch"). Attempting manual resolution may be required."
    fi
done

echo "Done."
