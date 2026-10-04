#!/usr/bin/env bash
# Resizes a flyer a club emailed in so it loads fast and fits a phone screen in the app
# and on the website. Accepts JPG, PNG, HEIC/WebP (whatever ImageMagick reads) or a PDF
# (first page). Writes client/public/flyers/<slug>.jpg, which GitHub Pages serves at
# https://mcbridecheyenne.github.io/texas-archery-calendar/flyers/<slug>.jpg
#
#   script/prepare-flyer.sh <input file> <slug>
#
# Then set "flyer": "flyers/<slug>.jpg" on the shoot's row in data/manual-events.json.
# Needs ImageMagick (convert) and, for PDFs, poppler (pdftoppm).
set -euo pipefail

in="$1"
slug="$2"
# Writes into the repo you run it from, so it also works when run from a temp copy.
out_dir="$(git rev-parse --show-toplevel)/client/public/flyers"
out="$out_dir/$slug.jpg"
max_bytes=400000 # keeps the app quick on rural cell signal
mkdir -p "$out_dir"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
src="$in"
if [[ "$(file -b --mime-type "$in")" == "application/pdf" ]]; then
  pdftoppm -f 1 -l 1 -r 200 -png "$in" "$tmp/page"
  src="$(ls "$tmp"/page*.png | head -1)"
fi

# Fit inside 1080x1350 (a phone-width portrait card) without upscaling or cropping,
# flatten transparency onto white, drop EXIF/location data, and honor camera rotation.
for quality in 85 78 70 62 55; do
  convert "$src[0]" -auto-orient -background white -alpha remove -alpha off \
    -resize '1080x1350>' -strip -interlace JPEG -sampling-factor 4:2:0 \
    -quality "$quality" "$out"
  [[ "$(stat -c %s "$out")" -le "$max_bytes" ]] && break
done

echo "$out ($(identify -format '%wx%h' "$out"), $(( $(stat -c %s "$out") / 1024 )) KB)"
