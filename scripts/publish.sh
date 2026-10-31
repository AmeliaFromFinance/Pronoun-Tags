#!/usr/bin/env bash
# Publishes the draft release for the current version (or the one given).
# Usage: scripts/publish.sh [v1.2.3]
source "$(dirname "$0")/lib.sh"
need gh "Get it from https://cli.github.com, then run: gh auth login"
tag="${1:-v$(version)}"
[ "$(gh release view "$tag" --json isDraft -q .isDraft 2>/dev/null)" = true ] || die "No draft release called $tag."
confirm "Publish $tag?"
gh release edit "$tag" --draft=false --latest >/dev/null
ok "Published $(gh release view "$tag" --json url -q .url)"
