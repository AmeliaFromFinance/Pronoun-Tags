#!/usr/bin/env bash
# Tags the current version and creates a draft GitHub release with the store zip and source zip attached.
# Usage: scripts/release.sh [notes.md]    (without a notes file, GitHub writes notes from the commits)
source "$(dirname "$0")/lib.sh"
need gh "Get it from https://cli.github.com, then run: gh auth login"
gh auth status >/dev/null 2>&1 || die "Sign in to GitHub first: gh auth login"
on_branch
clean_tree
v="$(version)"; tag="v$v"
git fetch -q --tags "$REMOTE" "$BRANCH"
[ "$(git rev-parse HEAD)" = "$(git rev-parse "$REMOTE/$BRANCH")" ] || die "Push first, so the release matches GitHub (scripts/push.sh)."
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && die "$tag already exists. Raise the version first (scripts/bump.sh patch)."

scripts/test.sh
scripts/package.sh >/dev/null
confirm "Create tag $tag and a draft release on GitHub?"
git tag -a "$tag" -m "$TITLE $v"
scripts/bundle.sh "$tag" >/dev/null
git push -q "$REMOTE" "$tag"
ok "Pushed tag $tag"

notes=(--generate-notes); [ -z "${1:-}" ] || notes=(--notes-file "$1")
gh release create "$tag" --draft --title "$TITLE $v" "${notes[@]}" \
  "dist/$NAME-$v.zip" "dist/$NAME-$v-source.zip"
ok "Draft release $tag created. Check it on GitHub, then run scripts/publish.sh"
