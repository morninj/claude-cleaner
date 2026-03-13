#!/bin/bash
set -e

cd "$(dirname "$0")"

VERSION=$(grep '"version"' src/manifest.json | sed 's/.*: *"\(.*\)".*/\1/')
FILENAME="releases/claude-cleaner-v${VERSION}.zip"

if [ -f "$FILENAME" ]; then
  echo "Release $FILENAME already exists."
  exit 1
fi

mkdir -p releases

cd src
zip -r "../$FILENAME" manifest.json content.js icons/
cd ..

echo "Created $FILENAME"
