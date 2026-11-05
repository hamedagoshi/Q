#!/usr/bin/env python3
"""Trim, derive favicons, write tokens, compose the brand sheet, zip the pack."""
import os, json, glob, zipfile
from PIL import Image, ImageDraw, ImageFont
import numpy as np

V4 = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(V4, "out")
T = json.load(open(os.path.join(OUT, "pack.json")))["palette"]

def trim(p, pad=0.04):
    im = Image.open(p).convert("RGBA")
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > 25)
    if len(xs) == 0: return im
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    m = int((x1 - x0) * pad)
    return im.crop((max(0, x0 - m), max(0, y0 - m), min(im.width, x1 + m), min(im.height, y1 + m)))

for f in glob.glob(os.path.join(OUT, "lockup-*@2x.png")):
    t = trim(f); t.save(f.replace("@2x", "-tight"))
for f in glob.glob(os.path.join(OUT, "mark-*@512.png")):
    trim(f, 0.06).save(f)

# favicons from the amber mark on charcoal
icon = Image.open(os.path.join(OUT, "icon-192.png")).convert("RGB")
icon.save(os.path.join(OUT, "favicon.ico"), sizes=[(16,16),(32,32),(48,48),(64,64)])

# tokens
tokens = {
  "meta": {"name": "MONAD", "academy": "MonadWave", "version": "4.0.0", "date": "2026-11-05"},
  "color": {
    "dark": {"bg": T["dark"]["bg"], "surface": T["dark"]["surface"], "surface2": "#26282C",
             "line": "rgba(255,255,255,0.07)", "ink": T["dark"]["ink"], "muted": T["dark"]["muted"],
             "accent": T["dark"]["accent"], "accent_strong": T["dark"]["accent2"],
             "positive": "#7FA97C", "negative": "#C57B6B", "warn": "#D8A65B"},
    "light": {"bg": T["light"]["bg"], "surface": T["light"]["surface"], "surface2": "#EDE7DA",
              "line": "rgba(26,25,23,0.09)", "ink": T["light"]["ink"], "muted": T["light"]["muted"],
              "accent": T["light"]["accent"], "accent_strong": T["light"]["accent2"],
              "positive": "#4F7F5A", "negative": "#A8513F", "warn": "#9A6F1E"},
  },
  "type": {"fa": "Vazirmatn", "latin": "Inter", "scale": [12,13,15,17,21,28,36],
           "line_height": {"body": 1.75, "ui": 1.35}, "numeric": "tabular-nums"},
  "space": [4,8,12,16,20,24,32,48],
  "radius": {"chip": 999, "control": 12, "card": 16, "sheet": 20, "modal": 24},
  "motion": {"micro": 140, "enter": 220, "sheet": 300, "easing": "cubic-bezier(.22,.61,.36,1)"},
}
json.dump(tokens, open(os.path.join(OUT, "tokens.json"), "w"), indent=1, ensure_ascii=False)
css = [":root{"]
for k, v in tokens["color"]["dark"].items(): css.append(f"  --monad-{k}: {v};")
css.append("  --monad-radius-control:12px; --monad-radius-card:16px; --monad-radius-sheet:20px;")
css.append("  --monad-space-1:4px; --monad-space-2:8px; --monad-space-3:12px; --monad-space-4:16px; --monad-space-5:24px;")
css.append("  --monad-dur-micro:140ms; --monad-dur-enter:220ms; --monad-ease:cubic-bezier(.22,.61,.36,1);")
css.append("}")
css.append('[data-theme="light"]{')
for k, v in tokens["color"]["light"].items(): css.append(f"  --monad-{k}: {v};")
css.append("}")
open(os.path.join(OUT, "tokens.css"), "w").write("\n".join(css))

# ---- brand sheet ----------------------------------------------------------
F = os.path.join(V4, "..", "fonts")
def fi(sz, w="Bold"): return ImageFont.truetype(os.path.join(F, "Inter.ttf"), sz)
def fv(sz, w="Regular"): return ImageFont.truetype(os.path.join(F, f"Vazirmatn-{w}.ttf"), sz)

W, H = 1600, 1500
sheet = Image.new("RGB", (W, H), T["dark"]["bg"])
d = ImageDraw.Draw(sheet)
d.text((80, 70), "MONAD", font=fi(64), fill=T["dark"]["ink"])
d.text((82, 150), "product of MonadWave academy", font=fi(24), fill=T["dark"]["muted"])

# original photo
src = Image.open(os.path.join(V4, "src", "source_lockup.png")).convert("RGB")
src = src.resize((620, int(src.height * 620 / src.width)), Image.LANCZOS)
sheet.paste(src, (80, 230)); d.text((80, 230 + src.height + 12), "01  ORIGINAL (uploaded)", font=fi(20), fill=T["dark"]["muted"])

# traced, dark + light
tl = Image.open(os.path.join(OUT, "lockup-amber-cream-tight.png")).convert("RGBA")
tl = tl.resize((620, int(tl.height * 620 / tl.width)), Image.LANCZOS)
sheet.paste(tl, (760, 240), tl)
d.text((760, 240 + tl.height + 12), "02  VECTOR TRACE - dark theme", font=fi(20), fill=T["dark"]["muted"])

lt = Image.open(os.path.join(OUT, "lockup-light-tight.png")).convert("RGBA")
lt2 = lt.resize((620, int(lt.height * 620 / lt.width)), Image.LANCZOS)
card = Image.new("RGB", (660, lt2.height + 40), T["light"]["bg"])
card.paste(lt2, (20, 20), lt2)
sheet.paste(card, (80, 640))
d.text((80, 640 + card.height + 12), "03  SAME VECTOR - paper theme", font=fi(20), fill=T["dark"]["muted"])

mono = Image.open(os.path.join(OUT, "lockup-cream-tight.png")).convert("RGBA")
mono = mono.resize((620, int(mono.height * 620 / mono.width)), Image.LANCZOS)
sheet.paste(mono, (760, 660), mono)
d.text((760, 660 + mono.height + 12), "04  CREAM / mono", font=fi(20), fill=T["dark"]["muted"])

# palette
sw = [(T["dark"]["bg"],"bg"),(T["dark"]["surface"],"surface"),(T["dark"]["accent"],"accent"),
      (T["dark"]["accent2"],"accent-strong"),(T["dark"]["ink"],"ink"),(T["dark"]["muted"],"muted")]
x = 80
for hexv, name in sw:
    d.rounded_rectangle([x, 1080, x+180, 1180], 14, fill=hexv, outline="#3A3B3F")
    d.text((x, 1192), hexv.upper(), font=fi(20), fill=T["dark"]["ink"])
    d.text((x, 1218), name, font=fi(18), fill=T["dark"]["muted"])
    x += 200

d.text((80, 1290), "۰۱  امروز", font=fv(34, "Bold"), fill=T["dark"]["ink"])
d.text((80, 1345), "هر روز یک مشاهده. ثبت کن، ببین، بفهم.", font=fv(26), fill=T["dark"]["muted"])
d.text((80, 1400), "Vazirmatn / Inter  ·  tabular numerals  ·  RTL native", font=fi(20), fill=T["dark"]["muted"])

sheet.save(os.path.join(V4, "monad-brand-v4.png"))

# icons strip
strip = Image.new("RGB", (900, 300), T["dark"]["bg"])
xx = 40
for f in ("icon-192.png", "icon-512-maskable.png", "favicon.ico"):
    im = Image.open(os.path.join(OUT, f)).convert("RGB")
    im.thumbnail((220, 220), Image.LANCZOS)
    strip.paste(im, (xx, 40)); xx += 280
strip.save(os.path.join(V4, "monad-icons-v4.png"))

# zip
zp = os.path.join(V4, "..", "..", "MONAD_Brand_v4.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(os.path.join(V4, "..")):
        for f in files:
            if f.endswith((".png", ".svg", ".json", ".css", ".md", ".py", ".pgm")):
                p = os.path.join(root, f)
                z.write(p, os.path.relpath(p, os.path.join(V4, "..")))
print("finalized:", zp, os.path.getsize(zp)//1024, "KB")
