#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${HOMEBREW_TAP:-}" || -z "${VERSION:-}" || -z "${ASSET_URL:-}" || -z "${SHA256:-}" ]]; then
  echo "Usage: HOMEBREW_TAP=org/tap VERSION=0.1.0 ASSET_URL=https://.../OhMyCowork.dmg SHA256=... $0"
  exit 1
fi

TAP_DIR="${TAP_DIR:-/tmp/homebrew-tap}"
APP_NAME="${APP_NAME:-ohmycowork}"
CASK_DIR="${TAP_DIR}/Casks"
CASK_FILE="${CASK_DIR}/${APP_NAME}.rb"

if [[ ! -d "${TAP_DIR}/.git" ]]; then
  rm -rf "${TAP_DIR}"
  git clone "https://github.com/${HOMEBREW_TAP}.git" "${TAP_DIR}"
fi

mkdir -p "${CASK_DIR}"

cat > "${CASK_FILE}" <<EOF
cask "${APP_NAME}" do
  version "${VERSION}"
  sha256 "${SHA256}"

  url "${ASSET_URL}"
  name "OhMyCowork"
  desc "AI-powered workspace for creative collaboration"
  homepage "https://ohmyco.work"

  app "OhMyCowork.app"
end
EOF

echo "Updated cask at ${CASK_FILE}"
echo "Next steps:"
echo "  cd ${TAP_DIR}"
echo "  git add ${CASK_FILE}"
echo "  git commit -m \"Update ${APP_NAME} to ${VERSION}\""
echo "  git push"
