#!/usr/bin/env python3
"""Rasterize the SVG identity set with headless Chromium; build icons + favicon."""
import os, subprocess, tempfile, glob
from PIL import Image

HERE=os.path.dirname(os.path.abspath(__file__)); FINAL=os.path.dirname(HERE)
A=os.path.join(FINAL,"assets"); R=os.path.join(FINAL,"raster"); os.makedirs(R,exist_ok=True)

def shot(svg_text, out_png, w, h, bg="00000000", scale=2):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, dir="/tmp") as f:
        f.write(f'<!doctype html><html><head><meta charset="utf-8"><style>'
                f'html,body{{margin:0;padding:0;background:transparent}}'
                f'svg{{display:block}}</style></head><body>{svg_text}</body></html>')
        path=f.name
    subprocess.run(["chromium","--headless=new","--no-sandbox","--disable-gpu",
                    f"--window-size={w},{h}", f"--force-device-scale-factor={scale}",
                    f"--default-background-color={bg}", "--hide-scrollbars",
                    f"--screenshot={out_png}", f"file://{path}"],
                   capture_output=True, timeout=60)
    os.unlink(path)

def load(name): return open(os.path.join(A,name),encoding="utf-8").read()

JOBS=[("monad-lockup-horizontal-dark.svg","lockup-horizontal-dark.png",1200,320),
      ("monad-lockup-horizontal-light.svg","lockup-horizontal-light.png",1200,320),
      ("monad-lockup-compact-dark.svg","lockup-compact-dark.png",700,760),
      ("monad-wordmark-dark.svg","wordmark-dark.png",1200,260),
      ("mark-dark.svg","mark-dark@1024.png",512,512),
      ("mark-light.svg","mark-light@1024.png",512,512)]
for src,out,w,h in JOBS:
    shot(load(src), os.path.join(R,out), w, h)

# --- app icons -----------------------------------------------------------------
D_BG="#17181A"
def icon(size, pad_ratio):
    mk = load("mark-dark.svg")
    inner_w = size*pad_ratio
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#1E1F22"/><stop offset="1" stop-color="#17181A"/></linearGradient></defs>'
            f'<rect width="{size}" height="{size}" fill="url(#g)"/>'
            f'<g transform="translate({(size-inner_w)/2:.1f},{(size-inner_w)/2:.1f}) scale({inner_w/106:.4f})">'
            f'{mk.split(">",1)[1].rsplit("</svg>",1)[0]}</g></svg>')

for size,pr,suffix in ((192,0.60,""),(512,0.60,""),(192,0.46,"-maskable"),(512,0.46,"-maskable")):
    shot(icon(size,pr), os.path.join(R,f"icon-{size}{suffix}.png"), size, size, bg="17181A", scale=2)
shot(icon(180,0.60), os.path.join(R,"apple-touch-icon-180.png"), 180,180, bg="17181A", scale=2)

# --- favicon: simplified, thicker mark for 16-32px -----------------------------
fav = icon(64,0.78)
shot(fav, os.path.join(R,"favicon-64.png"), 64, 64, bg="17181A", scale=1)
im = Image.open(os.path.join(R,"favicon-64.png")).convert("RGBA")
im.save(os.path.join(A,"favicon.ico"), sizes=[(16,16),(32,32),(48,48),(64,64)])
print("favicon.ico written")
for f in sorted(glob.glob(os.path.join(R,"*.png"))):
    print("  ", os.path.basename(f), Image.open(f).size)
