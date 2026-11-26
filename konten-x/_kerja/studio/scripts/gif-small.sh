#!/usr/bin/env bash
# Re-encodes one loop of an MP4 to a GIF under X's 15 MB limit.   bash scripts/gif-small.sh in.mp4 out.gif size fps colors
set -euo pipefail
npx remotion ffmpeg -v error -y -t 8 -i "$1" -r "$4" -vf "scale=${3}:${3}:flags=lanczos,split[a][b];[a]palettegen=max_colors=${5}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 "$2" 2>/dev/null
ls -la "$2" | awk '{print $5}'
