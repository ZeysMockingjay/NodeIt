#!/usr/bin/env bash

# Quick launcher for NodeIt from this repository.
# Usage:
#   1) Build once: npm run pack:linux
#   2) Make executable once: chmod +x ./quick-launch-nodeit.sh
#   3) Run anytime: ./quick-launch-nodeit.sh
#
# Why this launcher:
# - Uses the unpacked binary so it does not depend on FUSE.
# - Adds --no-sandbox for Ubuntu setups where Electron AppImage sandboxing is blocked.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_BINARY="${SCRIPT_DIR}/dist/linux-unpacked/nodeit"

if [[ ! -x "$APP_BINARY" ]]; then
  echo "NodeIt binary not found at: $APP_BINARY"
  echo "Build first with:"
  echo "  npm run pack:linux"
  exit 1
fi

exec "$APP_BINARY" --no-sandbox
