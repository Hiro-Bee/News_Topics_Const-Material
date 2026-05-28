#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/hiro-mba/Documents/Codex/2026-05-24/github-news-topics-const-material-index"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR"

NODE_BIN="/Applications/Codex.app/Contents/Resources/node"
if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi

"$NODE_BIN" scripts/generate-daily.mjs
