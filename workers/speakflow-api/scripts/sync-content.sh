#!/bin/bash
# Sync content files from the project root into the workers project tree.
# esbuild can't resolve imports from outside the workers/ root, so we copy.
#
# Usage:  bash scripts/sync-content.sh
# Hook this into prebuild in package.json or run manually before wrangler deploy.

set -euo pipefail

WORKERS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$WORKERS_DIR/../.." && pwd)"

echo "[sync-content] workers=$WORKERS_DIR"
echo "[sync-content] repo=$REPO_ROOT"

# Mirror content/ → workers/content/
mkdir -p "$WORKERS_DIR/content"
cp -r "$REPO_ROOT/content/." "$WORKERS_DIR/content/"

# Mirror frontend dictionary → workers/data/
mkdir -p "$WORKERS_DIR/data"
cp "$REPO_ROOT/frontend/src/data/garment-textile-dict.json" "$WORKERS_DIR/data/"

echo "[sync-content] done."
echo "  $(find "$WORKERS_DIR/content" -type f | wc -l) files under content/"
echo "  $(wc -c < "$WORKERS_DIR/data/garment-textile-dict.json") bytes dictionary"
