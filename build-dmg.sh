#!/usr/bin/env bash
set -euo pipefail

bun run tauri build

open "$(pwd)/src-tauri/target/release/bundle/dmg/"
