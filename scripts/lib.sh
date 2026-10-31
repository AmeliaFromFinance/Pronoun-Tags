#!/usr/bin/env bash
# Shared helpers. Sourced by the other scripts, not run on its own.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
source "$ROOT/scripts/config.sh"

BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"

if [ -t 1 ]; then BOLD=$'\e[1m'; PINK=$'\e[38;5;218m'; RED=$'\e[31m'; GREEN=$'\e[32m'; DIM=$'\e[2m'; RESET=$'\e[0m'
else BOLD=''; PINK=''; RED=''; GREEN=''; DIM=''; RESET=''; fi

step() { printf '%s›%s %s\n' "$PINK" "$RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 isn't installed. $2"; }

version() { sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1; }

# Asks before doing something that can't easily be undone. YES=1 skips it.
confirm() {
  [ "${YES:-0}" = 1 ] && return 0
  printf '%s [y/N] ' "$1"; read -r answer
  case "$answer" in y|Y|yes) return 0 ;; *) die "Stopped." ;; esac
}

on_branch() {
  [ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || die "Switch to $BRANCH first (git switch $BRANCH)."
}

clean_tree() {
  [ -z "$(git status --porcelain)" ] || die "You have uncommitted changes. Commit them first (scripts/commit.sh)."
}
