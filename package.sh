#!/bin/sh
# Builds dist/<name>-<version>.zip for the Chrome Web Store, Firefox Add-ons and Edge Add-ons:
# just the files the extension needs, without the store images, Markdown or anything else in the repository.
set -e
cd "$(dirname "$0")"
name=pronoun-tags
version=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
mkdir -p dist
rm -f "dist/$name-$version.zip"
zip -r -X -q "dist/$name-$version.zip" manifest.json ./*.js ./*.css ./*.html _locales icons
echo "dist/$name-$version.zip"
