#!/usr/bin/env bash
# Downloads a Meshy export by its signed asset URL (base64, as the in-page helper returns it) and installs it.
#   scripts/meshy-fetch.sh <file.glb under public/models> <urlBase64> [targetTriangles=30000] [maxTexture=1024]
set -euo pipefail
cd "$(dirname "$0")/.."
file="$1"; url="$(printf '%s' "$2" | base64 -d)"; tris="${3:-30000}"; tex="${4:-1024}"
raw="/private/tmp/claude-501/-Users-artemprokhorov-Desktop-Git-Projects-Ginseng-Impact/aeb8ae64-5cf2-488d-8ec2-74605793b057/scratchpad/meshy/raw-${file}"
mkdir -p "$(dirname "$raw")"
curl -sSL --max-time 300 -o "$raw" "$url"
node scripts/model-tools.mjs optimize "$raw" "public/models/$file" "$tex" "$tris" | tail -2
node scripts/model-tools.mjs info "public/models/$file" | head -2
