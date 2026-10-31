#!/usr/bin/env bash
# Lists the scripts and what they do.
source "$(dirname "$0")/lib.sh"
cat <<TEXT
${BOLD}$TITLE scripts${RESET}

  scripts/test.sh               Check syntax, JSON, manifest, text and versions
  scripts/package.sh            Build the store zip in dist/
  scripts/bundle.sh [tag]       Zip the project as on GitHub (no .gitignore files)
  scripts/commit.sh "Message"   Run checks, then commit every change
  scripts/push.sh               Check for conflicts, catch up, run checks, push to $BRANCH
  scripts/bump.sh patch         Raise the version (patch, minor, major or 1.2.3)
  scripts/release.sh [notes]    Tag the version and make a draft GitHub release
  scripts/publish.sh [tag]      Publish the draft release

  Set YES=1 to skip questions, e.g. YES=1 scripts/publish.sh
TEXT
