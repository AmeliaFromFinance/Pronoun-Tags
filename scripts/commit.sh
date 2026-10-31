#!/usr/bin/env bash
# Runs the checks, then commits every change locally.
# Usage: scripts/commit.sh "Message"    (add --no-test to skip the checks)
source "$(dirname "$0")/lib.sh"
run_tests=1; message=''
for arg in "$@"; do case "$arg" in --no-test) run_tests=0 ;; *) message="$arg" ;; esac; done
[ -n "$message" ] || die 'Give a commit message: scripts/commit.sh "Fix the badge list"'
[ -n "$(git status --porcelain)" ] || die "Nothing to commit."
[ "$run_tests" = 0 ] || scripts/test.sh
git add -A
step "Changes"
git status --short
git commit -q -m "$message"
ok "Committed $(git rev-parse --short HEAD): $message"
