#!/usr/bin/env bash
# Zips the whole project as it is on GitHub: every tracked file, nothing from .gitignore.
# Usage: scripts/bundle.sh [ref]     (ref defaults to HEAD, e.g. a tag like v1.2.0)
source "$(dirname "$0")/lib.sh"
ref="${1:-HEAD}"
git rev-parse --verify -q "$ref^{commit}" >/dev/null || die "Unknown commit or tag: $ref"
[ "$ref" != HEAD ] || [ -z "$(git status --porcelain)" ] || printf '%sNote: uncommitted changes are left out.%s\n' "$DIM" "$RESET"
label="$(version)"; [ "$ref" = HEAD ] || label="${ref#v}"
out="dist/$NAME-$label-source.zip"
mkdir -p dist
git archive --format=zip --prefix="$NAME/" -o "$out" "$ref"
ok "$out"
