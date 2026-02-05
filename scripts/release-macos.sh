#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WITH_DMG=0
WITH_NOTARIZE=0
PUBLISH_RELEASE=0
ALLOW_ADHOC=0
TARGET=""
NOTARY_PROFILE="${NOTARYTOOL_PROFILE:-${NOTARY_PROFILE:-}}"
RELEASE_REPO="${RELEASE_REPO:-}"
TAG_PREFIX="${TAG_PREFIX:-v}"
CASK_FILE_PATH="${CASK_FILE_PATH:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/release-macos.sh [options]

Options:
  --target <triple>       Build target (default: auto-detect host)
  --with-dmg              Build dmg in addition to zip
  --with-notarize         Notarize + staple app (and dmg if built)
  --notary-profile <name> notarytool keychain profile name
  --publish               Create/upload GitHub release assets (requires gh)
  --repo <owner/repo>     GitHub repo for release (default: origin remote)
  --tag-prefix <prefix>   Release tag prefix (default: v)
  --cask-file <path>      Write Homebrew cask file with current artifact
  --allow-adhoc           Allow adhoc-signed app (not for public release)
  -h, --help              Show this help

Examples:
  ./scripts/release-macos.sh --with-notarize --notary-profile OMC_NOTARY
  ./scripts/release-macos.sh --with-dmg --with-notarize --publish
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --with-dmg)
      WITH_DMG=1
      shift
      ;;
    --with-notarize)
      WITH_NOTARIZE=1
      shift
      ;;
    --notary-profile)
      NOTARY_PROFILE="${2:-}"
      shift 2
      ;;
    --publish)
      PUBLISH_RELEASE=1
      shift
      ;;
    --repo)
      RELEASE_REPO="${2:-}"
      shift 2
      ;;
    --tag-prefix)
      TAG_PREFIX="${2:-}"
      shift 2
      ;;
    --cask-file)
      CASK_FILE_PATH="${2:-}"
      shift 2
      ;;
    --allow-adhoc)
      ALLOW_ADHOC=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

need_cmd bun
need_cmd node
need_cmd codesign
need_cmd xcrun
need_cmd ditto
need_cmd shasum

if [[ -z "$TARGET" ]]; then
  case "$(uname -m)" in
    arm64) TARGET="aarch64-apple-darwin" ;;
    x86_64) TARGET="x86_64-apple-darwin" ;;
    *)
      echo "Unsupported host arch: $(uname -m). Please pass --target."
      exit 1
      ;;
  esac
fi

case "$TARGET" in
  aarch64-apple-darwin) ARCH_LABEL="aarch64" ;;
  x86_64-apple-darwin) ARCH_LABEL="x64" ;;
  universal-apple-darwin) ARCH_LABEL="universal" ;;
  *)
    echo "Unsupported target: $TARGET"
    exit 1
    ;;
esac

PRODUCT_NAME="$(node -p "require('./src-tauri/tauri.conf.json').productName")"
APP_VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
PKG_NAME="$(node -p "require('./package.json').name")"

TARGET_DIR="src-tauri/target/${TARGET}/release/bundle"
FALLBACK_DIR="src-tauri/target/release/bundle"
APP_PATH="${TARGET_DIR}/macos/${PRODUCT_NAME}.app"
if [[ ! -d "$APP_PATH" ]]; then
  APP_PATH="${FALLBACK_DIR}/macos/${PRODUCT_NAME}.app"
fi

OUT_DIR="release/macos/${APP_VERSION}"
mkdir -p "$OUT_DIR"

build_tauri_bundle() {
  local bundle_type="$1"
  echo "==> Building bundle: ${bundle_type} (${TARGET})"
  bun run tauri build --target "$TARGET" --bundles "$bundle_type"
}

extract_signature() {
  codesign -dv --verbose=4 "$1" 2>&1 | sed -n 's/^Signature=//p' | head -n 1
}

require_signed_app() {
  local sig
  sig="$(extract_signature "$APP_PATH")"
  if [[ "$sig" == "adhoc" && "$ALLOW_ADHOC" -ne 1 ]]; then
    cat <<EOF
App is only adhoc signed.
For distribution, use a Developer ID certificate first.
If this is only a local smoke release, re-run with --allow-adhoc.
EOF
    exit 1
  fi
}

notarize_and_staple() {
  local artifact="$1"
  if [[ -z "$NOTARY_PROFILE" ]]; then
    echo "--with-notarize requires --notary-profile (or NOTARYTOOL_PROFILE env)."
    exit 1
  fi
  echo "==> Notarizing: $artifact"
  xcrun notarytool submit "$artifact" --keychain-profile "$NOTARY_PROFILE" --wait
  echo "==> Stapling: $artifact"
  xcrun stapler staple "$artifact"
  xcrun stapler validate "$artifact"
}

to_https_repo_url() {
  local remote="$1"
  if [[ "$remote" =~ ^git@github\.com:(.+)\.git$ ]]; then
    echo "https://github.com/${BASH_REMATCH[1]}"
  elif [[ "$remote" =~ ^https://github\.com/(.+)\.git$ ]]; then
    echo "https://github.com/${BASH_REMATCH[1]}"
  elif [[ "$remote" =~ ^https://github\.com/.+/.+$ ]]; then
    echo "$remote"
  else
    echo ""
  fi
}

repo_from_origin() {
  local remote
  remote="$(git config --get remote.origin.url || true)"
  if [[ "$remote" =~ ^git@github\.com:(.+)\.git$ ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ "$remote" =~ ^https://github\.com/(.+)\.git$ ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ "$remote" =~ ^https://github\.com/(.+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

build_tauri_bundle app

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH"
  exit 1
fi

echo "==> Verifying app signature"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
require_signed_app

if [[ "$WITH_NOTARIZE" -eq 1 ]]; then
  notarize_and_staple "$APP_PATH"
fi

ZIP_FILE="${PRODUCT_NAME}_${APP_VERSION}_${ARCH_LABEL}.zip"
ZIP_PATH="${OUT_DIR}/${ZIP_FILE}"
rm -f "$ZIP_PATH"
echo "==> Creating zip: $ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"
ZIP_SHA256="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"

DMG_PATH=""
DMG_SHA256=""
if [[ "$WITH_DMG" -eq 1 ]]; then
  build_tauri_bundle dmg
  DMG_CANDIDATE="$(find "${TARGET_DIR}/dmg" "${FALLBACK_DIR}/dmg" -maxdepth 1 -type f -name '*.dmg' 2>/dev/null | head -n 1 || true)"
  if [[ -z "$DMG_CANDIDATE" ]]; then
    echo "DMG build requested but no dmg file found."
    exit 1
  fi
  DMG_FILE="${PRODUCT_NAME}_${APP_VERSION}_${ARCH_LABEL}.dmg"
  DMG_PATH="${OUT_DIR}/${DMG_FILE}"
  cp "$DMG_CANDIDATE" "$DMG_PATH"
  if [[ "$WITH_NOTARIZE" -eq 1 ]]; then
    notarize_and_staple "$DMG_PATH"
  fi
  DMG_SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
fi

if [[ -n "$CASK_FILE_PATH" ]]; then
  if [[ -z "$RELEASE_REPO" ]]; then
    RELEASE_REPO="$(repo_from_origin)"
  fi
  if [[ -z "$RELEASE_REPO" ]]; then
    echo "Cannot write cask without --repo (or GitHub origin remote)."
    exit 1
  fi

  HOMEPAGE_URL="$(to_https_repo_url "https://github.com/${RELEASE_REPO}")"
  TAG="${TAG_PREFIX}${APP_VERSION}"
  CASK_TOKEN="${PKG_NAME//_/-}"
  URL_FILE="$ZIP_FILE"

  mkdir -p "$(dirname "$CASK_FILE_PATH")"
  cat > "$CASK_FILE_PATH" <<EOF
cask "${CASK_TOKEN}" do
  version "${APP_VERSION}"
  sha256 "${ZIP_SHA256}"

  url "https://github.com/${RELEASE_REPO}/releases/download/${TAG}/${URL_FILE}"
  name "${PRODUCT_NAME}"
  desc "Local-first AI coworker desktop app"
  homepage "${HOMEPAGE_URL}"

  app "${PRODUCT_NAME}.app"
end
EOF
  echo "==> Wrote cask file: $CASK_FILE_PATH"
fi

if [[ "$PUBLISH_RELEASE" -eq 1 ]]; then
  need_cmd gh
  if [[ -z "$RELEASE_REPO" ]]; then
    RELEASE_REPO="$(repo_from_origin)"
  fi
  if [[ -z "$RELEASE_REPO" ]]; then
    echo "Cannot publish release: pass --repo <owner/repo>."
    exit 1
  fi

  TAG="${TAG_PREFIX}${APP_VERSION}"
  RELEASE_FILES=("$ZIP_PATH")
  if [[ -n "$DMG_PATH" ]]; then
    RELEASE_FILES+=("$DMG_PATH")
  fi

  if gh release view "$TAG" --repo "$RELEASE_REPO" >/dev/null 2>&1; then
    echo "==> Uploading assets to existing release: ${TAG}"
    gh release upload "$TAG" "${RELEASE_FILES[@]}" --clobber --repo "$RELEASE_REPO"
  else
    echo "==> Creating release: ${TAG}"
    gh release create "$TAG" "${RELEASE_FILES[@]}" \
      --title "$TAG" \
      --notes "macOS release ${APP_VERSION}" \
      --repo "$RELEASE_REPO"
  fi
fi

echo
echo "Release artifacts:"
echo "  ZIP: $ZIP_PATH"
echo "  ZIP sha256: $ZIP_SHA256"
if [[ -n "$DMG_PATH" ]]; then
  echo "  DMG: $DMG_PATH"
  echo "  DMG sha256: $DMG_SHA256"
fi
