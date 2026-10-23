#!/usr/bin/env bash
# Turn a video (e.g. a Google Flow intro clip) into a scroll-scrubbed frame sequence for the landing hero.
#
#   scripts/flow-to-frames.sh <video.mp4> [frames=120] [width=1600] [quality=70]
#
# Writes web/public/hero/frames/frame_001.webp … frame_NNN.webp plus manifest.json. When manifest.json
# exists, the landing page uses the frames as the hero background instead of the real-time 3D scene.
# Remove the folder (rm -rf web/public/hero/frames) to go back to the 3D scene. Needs ffmpeg + ffprobe.
set -euo pipefail

if [[ $# -lt 1 || ! -f "$1" ]]; then
  echo "usage: $0 <video.mp4> [frames=120] [width=1600] [quality=70]" >&2
  exit 1
fi

VIDEO="$1"
COUNT="${2:-120}"
WIDTH="${3:-1600}"
QUALITY="${4:-70}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/web/public/hero/frames"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }
ffprobe -version >/dev/null 2>&1 || { echo "ffmpeg/ffprobe is installed but won't start (often a library mismatch after brew upgrade): brew reinstall ffmpeg" >&2; exit 1; }

DURATION="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO")"
# Sample evenly so that ~COUNT frames span the whole clip
FPS="$(awk -v n="$COUNT" -v d="$DURATION" 'BEGIN { printf "%.6f", n / d }')"

rm -rf "$OUT"
mkdir -p "$OUT"
FILTER="fps=${FPS},scale=${WIDTH}:-2:flags=lanczos"
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libwebp; then
  ffmpeg -hide_banner -loglevel error -i "$VIDEO" -vf "$FILTER" -frames:v "$COUNT" \
    -c:v libwebp -quality "$QUALITY" -compression_level 6 -an "$OUT/frame_%03d.webp"
else
  # Some ffmpeg builds ship without libwebp: extract PNGs, then encode with cwebp (brew install webp)
  command -v cwebp >/dev/null || { echo "ffmpeg has no libwebp encoder and cwebp is missing (brew install webp)" >&2; exit 1; }
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  ffmpeg -hide_banner -loglevel error -i "$VIDEO" -vf "$FILTER" -frames:v "$COUNT" -an "$TMP/frame_%03d.png"
  for f in "$TMP"/frame_*.png; do
    cwebp -quiet -q "$QUALITY" -m 6 "$f" -o "$OUT/$(basename "${f%.png}").webp"
  done
fi

N="$(find "$OUT" -name 'frame_*.webp' | wc -l | tr -d ' ')"
if [[ "$N" -eq 0 ]]; then
  echo "no frames were written" >&2
  exit 1
fi
read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$VIDEO" |
  awk -F, -v w="$WIDTH" '{ h = int(w * $2 / $1 / 2 + 0.5) * 2; print w, h }')

cat >"$OUT/manifest.json" <<JSON
{
  "count": $N,
  "width": $W,
  "height": $H,
  "pattern": "/hero/frames/frame_%03d.webp",
  "start": 1,
  "source": "$(basename "$VIDEO")",
  "generated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

SIZE="$(du -sh "$OUT" | cut -f1)"
echo "wrote $N frames (${W}x${H}, $SIZE) to web/public/hero/frames — the hero now scrubs this clip"
