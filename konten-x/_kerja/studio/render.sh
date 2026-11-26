#!/usr/bin/env bash
# Renders the QUIREN X package into konten-x/.   bash render.sh [capture|audio|stills|gifs|demo|all]
# capture records the live site (quirenrh.com) frame by frame; it takes a few minutes and needs Chrome.
set -euo pipefail
cd "$(dirname "$0")"
K="$(cd ../.. && pwd)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
R="npx remotion"; FF="npx remotion ffmpeg -v error -y"
what="${1:-all}"
mkdir -p "$K/1-PROFIL-X" "$K/2-VIDEO" "$K/3-GIF" "$K/4-FOTO" "$K/5-COIN"
bundle() { $R bundle src/index.ts --out-dir=build --log=error >/dev/null 2>&1; }
still() { $R still build "$1" "$2" --scale="${3:-2}" --timeout=180000 --log=error >/dev/null 2>&1; }

if [ "$what" = capture ]; then
  node scripts/capture.mjs plate; SECS=26 node scripts/capture.mjs tour
  VW=1080 VH=1080 SPAN=0.1 NAME=sq node scripts/capture.mjs plate
  VW=1500 VH=500 DPR=2 NAME=banner-plate node scripts/capture.mjs still
  VW=1080 VH=1350 NAME=poster-plate node scripts/capture.mjs still
  VW=1080 VH=1350 AT=0.05 NAME=poster-plate-b node scripts/capture.mjs still
  node scripts/capture-try.mjs; exit 0
fi

if [ "$what" = audio ] || [ "$what" = all ]; then python3 scripts/score.py; fi

if [ "$what" = stills ] || [ "$what" = all ]; then
  bundle
  still Profile "$TMP/profile.png"; still Banner "$TMP/banner.png"; still CoinFace "$TMP/coin.png"
  for f in F01 F02 F03; do still $f "$TMP/$f.png" 1; done
  python3 - "$TMP" "$K" <<'PY'
import sys
from PIL import Image, ImageDraw
t, K = sys.argv[1:]
p = Image.open(f"{t}/profile.png").convert("RGB")
for n in (1000, 400): p.resize((n, n), Image.LANCZOS).save(f"{K}/1-PROFIL-X/quiren-profile-{n}.png", optimize=True)
b = Image.open(f"{t}/banner.png").convert("RGB")
b.save(f"{K}/1-PROFIL-X/quiren-banner-3000x1000.png", optimize=True)
b.resize((1500, 500), Image.LANCZOS).save(f"{K}/1-PROFIL-X/quiren-banner-1500x500.png", optimize=True)
im = Image.open(f"{t}/coin.png").convert("RGBA"); W = im.width; r = 0.48 * W; ss = 4
m = Image.new("L", (W * ss, W * ss), 0); ImageDraw.Draw(m).ellipse([(W / 2 - r) * ss, (W / 2 - r) * ss, (W / 2 + r) * ss, (W / 2 + r) * ss], fill=255)
im.putalpha(m.resize((W, W), Image.LANCZOS)); coin = im.crop((int(W / 2 - r), int(W / 2 - r), int(W / 2 + r), int(W / 2 + r)))
for n in (2000, 1000, 512): coin.resize((n, n), Image.LANCZOS).save(f"{K}/5-COIN/quiren-coin-{n}.png", optimize=True)
Image.open(f"{t}/coin.png").convert("RGB").resize((1000, 1000), Image.LANCZOS).save(f"{K}/5-COIN/quiren-coin-on-dark-1000.png", optimize=True)
coin.resize((900, 900), Image.LANCZOS).save("public/img/coin-face.png")
for i, f in enumerate(("F01", "F02", "F03"), 1):
    name = {1: "memory-clear-as-ice", 2: "no-key-nothing-billed", 3: "plain-files-you-own"}[i]
    Image.open(f"{t}/{f}.png").convert("RGB").save(f"{K}/4-FOTO/0{i}-{name}.jpg", quality=95, optimize=True)
print("stills ok")
PY
fi

if [ "$what" = gifs ] || [ "$what" = all ]; then
  bundle
  for pair in IceLoop:ice MarkLoop:mark RecallLoop:recall CoinSpin:coin; do
    id=${pair%%:*}; bed=${pair##*:}
    $R render build "$id" "$TMP/$id.mp4" --codec=h264 --crf=8 --x264-preset=veryfast --concurrency=4 --timeout=180000 --props='{"gif":true}' --log=error >/dev/null 2>&1
    # MP4 for X: the loop played to the length of its bed, with sound
    $FF -stream_loop -1 -i "$TMP/$id.mp4" -i "public/audio/bed-$bed.wav" -map 0:v -map 1:a -shortest -c:v libx264 -preset slow -crf 16 -maxrate 20M -bufsize 40M \
      -profile:v high -pix_fmt yuv420p -g 60 -c:a aac -b:a 256k -af loudnorm=I=-16:TP=-1.5:LRA=11 -movflags +faststart "$K/3-GIF/quiren-$bed.mp4"
    # GIF: one loop, 720 px, palette made per file (X limit 15 MB)
    $FF -i "$TMP/$id.mp4" -r 25 -vf "scale=720:720:flags=lanczos,split[a][b];[a]palettegen=max_colors=220:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 "$K/3-GIF/quiren-$bed.gif"
  done
  # the stage has too many colours for 720 px: 480 px, 12 fps keeps it under 15 MB
  $FF -i "$K/3-GIF/quiren-ice.mp4" -t 12 -r 12 -vf "scale=480:480:flags=lanczos,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 "$K/3-GIF/quiren-ice.gif"
  cp "$K/3-GIF/quiren-coin.gif" "$K/5-COIN/quiren-coin-spin.gif"; cp "$K/3-GIF/quiren-coin.mp4" "$K/5-COIN/quiren-coin-spin.mp4"
fi

if [ "$what" = demo ] || [ "$what" = all ]; then
  bundle
  $R render build Demo "$TMP/demo.mp4" --codec=h264 --crf=8 --x264-preset=veryfast --concurrency=4 --audio-codec=aac --audio-bitrate=320k --timeout=180000 --log=error >/dev/null 2>&1
  $FF -i "$TMP/demo.mp4" -c:v libx264 -preset slow -crf 16 -maxrate 20M -bufsize 40M -profile:v high -pix_fmt yuv420p -g 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$K/2-VIDEO/quiren-demo-1080p.mp4"
  $FF -i public/audio/demo.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 "$K/2-VIDEO/quiren-backsound-thaw.wav"
  $FF -i "$K/2-VIDEO/quiren-backsound-thaw.wav" -c:a libmp3lame -b:a 320k "$K/2-VIDEO/quiren-backsound-thaw.mp3"
fi
echo "done: $what"
