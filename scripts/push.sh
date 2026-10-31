#!/usr/bin/env bash
# Checks for merge conflicts with GitHub, catches up if behind, runs the checks and pushes.
# Usage: scripts/push.sh
source "$(dirname "$0")/lib.sh"
git merge-tree --write-tree HEAD HEAD >/dev/null 2>&1 || die "Update Git to 2.38 or newer to check for conflicts."
on_branch
clean_tree
step "Fetching $REMOTE/$BRANCH"
git fetch -q "$REMOTE" "$BRANCH"
remote="$REMOTE/$BRANCH"
behind=$(git rev-list --count "HEAD..$remote")
ahead=$(git rev-list --count "$remote..HEAD")

if [ "$behind" -gt 0 ]; then
  step "GitHub has $behind commit(s) you don't. Checking for conflicts"
  if ! git merge-tree --write-tree --name-only HEAD "$remote" >/tmp/merge-check 2>&1; then
    printf '%sThese files conflict:%s\n' "$RED" "$RESET"
    tail -n +2 /tmp/merge-check | sed '/^$/,$d'
    die "Fix them by hand: git pull --rebase, resolve, then run this again."
  fi
  ok "No conflicts"
  git rebase -q "$remote"
  ok "Caught up with GitHub"
fi

[ "$ahead" -gt 0 ] || { ok "Nothing new to push."; exit 0; }
scripts/test.sh
step "Pushing $ahead commit(s) to $remote"
git push -q "$REMOTE" "HEAD:$BRANCH"
ok "Pushed"
