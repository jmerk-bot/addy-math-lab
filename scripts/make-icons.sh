#!/usr/bin/env bash
# Renders the PNG app icons from icons/icon.svg and icons/icon-maskable.svg
# using headless Google Chrome. Run from anywhere: scripts/make-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

render() { # <svg> <size> <out.png>
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --default-background-color=00000000 \
    --window-size="$2,$2" --screenshot="$ROOT/icons/$3" \
    "file://$ROOT/icons/$1" >/dev/null 2>&1
  echo "icons/$3 ($(sips -g pixelWidth "$ROOT/icons/$3" | awk '/pixelWidth/ {print $2}')px)"
}

render icon.svg 192 icon-192.png
render icon.svg 512 icon-512.png
render icon-maskable.svg 512 icon-maskable-512.png
render icon-maskable.svg 180 apple-touch-icon.png
