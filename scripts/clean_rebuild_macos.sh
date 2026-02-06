#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME_DEFAULT="OhMyCowork"
APP_NAME="${APP_NAME:-$APP_NAME_DEFAULT}"

# Clean frontend and Tauri build outputs
rm -rf dist
rm -rf src-tauri/target
rm -rf src-tauri/target/release/bundle

# Optional: remove installed app if present
if [ -d "/Applications/${APP_NAME}.app" ]; then
  rm -rf "/Applications/${APP_NAME}.app"
fi

# Rebuild
if [ -f package-lock.json ]; then
  npm run build
  npm run tauri build
elif [ -f bun.lock ] || [ -f bun.lockb ]; then
  bun run build
  bun run tauri build
else
  npm run build
  npm run tauri build
fi

# Refresh Dock/Finder icon cache
killall Dock >/dev/null 2>&1 || true
killall Finder >/dev/null 2>&1 || true

echo "Done. If the icon still looks cached, log out/in or reboot."
