#!/usr/bin/env bash
set -euo pipefail

BUMP_TYPE="${1:-patch}"
if [[ "$BUMP_TYPE" != "major" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "patch" ]]; then
  echo "Usage: $0 [major|minor|patch]"
  echo "Default: patch"
  exit 1
fi

CURRENT_VERSION="$(node -p "require('./package.json').version")"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$BUMP_TYPE" in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
    ;;
  patch)
    NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
    ;;
esac

echo "Bumping version (${BUMP_TYPE}): ${CURRENT_VERSION} -> ${NEW_VERSION}"

node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version='${NEW_VERSION}';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"
node -e "const fs=require('fs');const p='src-tauri/tauri.conf.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version='${NEW_VERSION}';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"
sed -i '' "s/^version = \"${CURRENT_VERSION}\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml

git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "new version: ${NEW_VERSION}"
git push
git tag "${NEW_VERSION}"
git push --tags

echo "Done!"
