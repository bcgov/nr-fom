#!/usr/bin/env bash
# Enforce public map init/layout contract — see public/src/app/applications/utils/leaflet-host.ts
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/public/src/app/applications"
VIOLATIONS=0

fail() {
  echo "Map contract violated: $1"
  VIOLATIONS=1
}

while IFS= read -r f; do
  base="$(basename "$f")"
  if [ "$base" = "leaflet-host.ts" ]; then
    continue
  fi
  if grep -qE 'L\.map\(' "$f"; then
    echo "$f: raw L.map() — use initMap() from leaflet-host.ts"
    VIOLATIONS=1
  fi
done < <(find "$DIR" -name '*.ts' -print)

if grep -rE 'id=("|\x27)map\1' "$DIR" --include='*.html' 2>/dev/null; then
  fail 'use class="map-host" instead of id="map"'
fi

if grep -rE '#map([^a-zA-Z_-]|$)' "$DIR" --include='*.scss' 2>/dev/null; then
  fail 'use .map-host in SCSS instead of #map'
fi

if [ "$VIOLATIONS" -ne 0 ]; then
  exit 1
fi

echo "Map contract OK"
