"""PNG frames from stage.py -> public/seq/{l,s}/fNNN.webp, through a lens pass.

The lens pass gives the clean render what a camera adds: a soft bloom off the highlights,
a touch of lateral chromatic aberration toward the edges, a vignette and fine film grain
(seeded per frame so it lives instead of sitting still).

    python3 blender/to-webp.py <png dir> [--out <dir>] [--only fNNN]
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
src = args[0]
out = args[args.index("--out") + 1] if "--out" in args else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "seq")
only = args[args.index("--only") + 1] if "--only" in args else None
SIZES = (("l", 1600, 82), ("s", 960, 78))


def lens(im: Image.Image, seed: int) -> Image.Image:
    a = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    h, w, _ = a.shape
    # bloom: only what is near white spills, blurred wide, screened back in
    hi = np.clip((a - 0.78) / 0.22, 0, 1) * a
    glow = np.asarray(Image.fromarray((hi * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w / 70))).astype(np.float32) / 255.0
    a = 1 - (1 - a) * (1 - glow * 0.45)
    # lateral chromatic aberration: red out, blue in, growing toward the corners
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    r, g, b = img.split()
    k = 0.0016
    r = r.resize((round(w * (1 + k)), round(h * (1 + k))), Image.BICUBIC).crop((0, 0, w, h)).transform((w, h), Image.AFFINE, (1, 0, w * k / 2, 0, 1, h * k / 2))
    b = b.resize((round(w * (1 - k)), round(h * (1 - k))), Image.BICUBIC)
    bb = Image.new("L", (w, h)); bb.paste(g); bb.paste(b, (round(w * k / 2), round(h * k / 2)))
    a = np.dstack([np.asarray(x).astype(np.float32) / 255.0 for x in (r, g, bb)])
    # vignette, soft and wide
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 * 0.8 + ((yy - h / 2) / (h / 2)) ** 2)
    a *= (1 - 0.22 * np.clip(d - 0.45, 0, 1) ** 1.6)[..., None]
    # grain: luminance-weighted, strongest in the mid tones
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (h, w)).astype(np.float32)
    n = np.asarray(Image.fromarray(((n * 0.25 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255.0 - 0.5
    lum = a.mean(axis=2, keepdims=True)
    a += n[..., None] * 0.055 * (1 - np.abs(lum - 0.5) * 1.2)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


for sub, _, _ in SIZES:
    os.makedirs(os.path.join(out, sub), exist_ok=True)
files = sorted(x for x in os.listdir(src) if x.endswith(".png") and (not only or x.startswith(only)))
for f in files:
    seed = int(f[1:4]) if f[1:4].isdigit() else 0
    im = lens(Image.open(os.path.join(src, f)), seed)
    for sub, width, q in SIZES:
        r = im if im.width == width else im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        r.save(os.path.join(out, sub, f.replace(".png", ".webp")), "WEBP", quality=q, method=6)
    print(f, flush=True)
