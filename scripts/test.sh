#!/usr/bin/env bash
# Checks the extension: syntax, JSON, manifest files, text keys and versions.
# Usage: scripts/test.sh
source "$(dirname "$0")/lib.sh"
need node "Get it from https://nodejs.org"
step "Running checks"
node scripts/check.js
