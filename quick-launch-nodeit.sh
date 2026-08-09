#!/usr/bin/env bash

# Quick launcher for NodeIt on this machine.
# Usage:
#   1) Make executable once: chmod +x /home/max/Documents/NodeIt/quick-launch-nodeit.sh
#   2) Run anytime: /home/max/Documents/NodeIt/quick-launch-nodeit.sh
#
# Why this launcher:
# - Uses the unpacked binary so it does not depend on FUSE.
# - Adds --no-sandbox for Ubuntu setups where Electron AppImage sandboxing is blocked.

set -euo pipefail

APP_BINARY="/home/max/Documents/NodeIt/dist/linux-unpacked/nodeit"

if [[ ! -x "$APP_BINARY" ]]; then
  echo "NodeIt binary not found at: $APP_BINARY"
  echo "Build first with:"
  echo "  cd /home/max/Documents/NodeIt && npm run pack:linux"
  exit 1
fi

exec "$APP_BINARY" --no-sandbox
