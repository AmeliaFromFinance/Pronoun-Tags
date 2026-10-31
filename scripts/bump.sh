#!/usr/bin/env bash
# Raises the version everywhere it's written down.
# Usage: scripts/bump.sh patch|minor|major|1.2.3
source "$(dirname "$0")/lib.sh"
current="$(version)"
IFS=. read -r major minor patch <<<"$current"
case "${1:-}" in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) next="$1" ;;
  *) die "Usage: scripts/bump.sh patch|minor|major|1.2.3" ;;
esac
sed -i.bak "s/\"version\": \"$current\"/\"version\": \"$next\"/" manifest.json && rm -f manifest.json.bak
for file in $EXTRA_VERSION_FILES; do
  sed -i.bak "s/VERSION = '$current'/VERSION = '$next'/" "$file" && rm -f "$file.bak"
done
ok "$current → $next"
printf '%sNext: scripts/commit.sh "Version %s"%s\n' "$DIM" "$next" "$RESET"
