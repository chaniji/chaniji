#!/usr/bin/env bash
# Upscale images 4x with Real-ESRGAN (realesrgan-ncnn-vulkan).
# Usage: enhance.sh [--anime] <image>...   -> saves <name>_x4.png next to each image
set -e
model=realesrgan-x4plus
if [[ $1 == --anime ]]; then model=realesrgan-x4plus-anime; shift; fi
[[ $# -gt 0 ]] || { echo "Usage: enhance.sh [--anime] <image>..."; exit 1; }

for img in "$@"; do
  case "${img,,}" in
    *.jpg|*.jpeg|*.png|*.webp) ;;
    *) echo "Skip (only jpg/png/webp): $img"; continue ;;
  esac
  out="${img%.*}_x4.png"
  realesrgan-ncnn-vulkan -i "$img" -o "$out" -n "$model" >/dev/null 2>&1
  echo "$out"
done
