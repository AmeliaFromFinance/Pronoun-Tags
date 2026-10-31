#!/usr/bin/env bash
# Builds dist/<name>-<version>.zip for the Chrome Web Store, Firefox Add-ons and Edge Add-ons.
# Only the files the extension needs, from the working folder.
# Usage: scripts/package.sh
source "$(dirname "$0")/lib.sh"
out="dist/$NAME-$(version).zip"
mkdir -p dist
rm -f "$out"
# shellcheck disable=SC2086
if command -v zip >/dev/null 2>&1; then
  zip -r -X -q "$out" $PACKAGE_FILES
else
  # Git Bash on Windows has no zip, so use git's own. This takes the last commit, not uncommitted changes.
  [ -z "$(git status --porcelain -- $PACKAGE_FILES)" ] || die "zip isn't installed, and git can only package committed files. Commit first."
  git archive --format=zip -o "$out" HEAD -- $PACKAGE_FILES
fi
ok "$out"
