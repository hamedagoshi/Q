#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MONAD / MonadWave — brand sheet v2 (evidence artefact).
Deterministic. Run: python3 tools/compose_sheet_v2.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_brand_v2 import PARAMS, BRAND, render_mark_png, gradient_plate, hex2rgb
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1500, 2000
FONTS = os.path.join(BRAND, "fonts")
C = PARAMS["colors"]


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def tracked(d, xy, text, f, fill, tracking=0.16):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + f.size * tracking
    return x - xy[0]


def card(d, box, fill, radius=20, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def main():
    ink, dim = C["dark"]["ink"], C["dark"]["dim"]
    surf, surf2 = C["dark"]["surface"], C["dark"]["surface2"]
    prim, sec = C["dark"]["primary"], C["dark"]["secondary"]
    bgc = C["dark"]["bg"]

    img = Image.new("RGB", (W, H), hex2rgb(bgc))
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.46, -H * 0.16, W * 1.0, H * 0.20], fill=hex2rgb(prim))
    glow = glow.filter(ImageFilter.GaussianBlur(240))
    img = Image.blend(img, glow, 0.13)
    d = ImageDraw.Draw(img)

    # ---------------- header:  M [triangle] D   +  MonadWave
    mark = render_mark_png(PARAMS, 150, hex2rgb(prim), 0.62, hex2rgb(ink))
    img.paste(mark, (104, 70), mark)

    f_mad = font("Inter.ttf", 84)
    x = 288
    d.text((x, 84), "M", font=f_mad, fill=hex2rgb(prim)); x += d.textlength("M", font=f_mad) + 6
    img.paste(mark, (int(x - 16), 78), mark)
    x += 134
    d.text((x, 84), "D", font=f_mad, fill=hex2rgb(prim))

    f_wave = font("Inter.ttf", 34)
    tracked(d, (292, 196), "MonadWave", f_wave, hex2rgb(ink), 0.06)

    f_fa = font("Vazirmatn-Regular.ttf", 24)
    d.text((292, 246), PARAMS["identity"]["tagline_fa"], font=f_fa, fill=hex2rgb(sec),
           direction="rtl", language="fa")
    d.text((292, 284), "academy · " + PARAMS["identity"]["tagline_en"], font=font("Inter.ttf", 16),
           fill=hex2rgb(dim))

    d.line([(104, 344), (W - 104, 344)], fill=(52, 46, 40), width=1)

    # ---------------- 01 mark
    d.text((104, 372), "01  MARK", font=font("Inter.ttf", 17), fill=hex2rgb(dim))
    d.text((222, 370), "upright triangle · three facets · one axis", font=font("Inter.ttf", 15),
           fill=(140, 128, 114))

    variants = [
        ("on charcoal", surf, prim, ink, None),
        ("inverse", surf2, ink, prim, None),
        ("monochrome", surf2, "#FFFFFF", "#FFFFFF", None),
        ("on cream", "#F7F3EA", C["light"]["primary"], C["light"]["ink"], None),
    ]
    x = 104
    for label, bg, fg, core, _ in variants:
        card(d, [x, 410, x + 300, 706], hex2rgb(bg), 22, (58, 52, 46))
        m = render_mark_png(PARAMS, 196, hex2rgb(fg), 0.80, hex2rgb(core))
        img.paste(m, (x + 52, 446), m)
        d.text((x + 22, 662), label, font=font("Inter.ttf", 14),
               fill=hex2rgb(dim if bg != "#F7F3EA" else "#6B6154"))
        x += 330

    # ---------------- 02 icons
    d.text((104, 748), "02  APP ICON", font=font("Inter.ttf", 17), fill=hex2rgb(dim))
    d.text((286, 746), "192 / 512 · maskable safe zone 80%", font=font("Inter.ttf", 15),
           fill=(140, 128, 114))
    for i, (path, label) in enumerate([
        ("icons/icon-192.png", "192"), ("icons/icon-192-maskable.png", "192 maskable"),
        ("icons/icon-512.png", "512"), ("icons/icon-512-maskable.png", "512 maskable")]):
        ic = Image.open(os.path.join(BRAND, path)).convert("RGB").resize((150, 150), Image.LANCZOS)
        px = 104 + i * 330
        img.paste(ic, (px, 786))
        d.text((px, 948), label, font=font("Inter.ttf", 14), fill=hex2rgb(dim))

    # ---------------- 03 palette
    d.text((104, 1010), "03  PALETTE", font=font("Inter.ttf", 17), fill=hex2rgb(dim))
    d.text((232, 1008), "charcoal · ember orange · cream", font=font("Inter.ttf", 15),
           fill=(140, 128, 114))

    def row(y, theme, note):
        d.text((104, y - 24), note, font=font("Inter.ttf", 13), fill=(140, 128, 114))
        x = 104
        for name, val in C[theme].items():
            if val.startswith("rgba"):
                fillc = hex2rgb(C[theme]["surface2"])
            else:
                fillc = hex2rgb(val)
            card(d, [x, y, x + 150, y + 88], fillc, 12, (58, 52, 46))
            lum = 0.2126 * fillc[0] + 0.7152 * fillc[1] + 0.0722 * fillc[2]
            lab = (235, 230, 220) if lum < 130 else (26, 22, 19)
            d.text((x + 10, y + 48), name, font=font("Inter.ttf", 12), fill=lab)
            d.text((x + 10, y + 66), val.replace("rgba(", "").replace(")", "")[:16],
                   font=font("Inter.ttf", 10), fill=lab)
            x += 162

    row(1058, "dark", "dark  (default)")
    row(1206, "light", "light")

    # ---------------- 04 typography
    d.text((104, 1330), "04  TYPOGRAPHY", font=font("Inter.ttf", 17), fill=hex2rgb(dim))
    d.text((104, 1364), "Vazirmatn — فارسی", font=font("Inter.ttf", 13), fill=(140, 128, 114))
    d.text((104, 1388), "امروز چه چیزی را مشاهده کردی؟", font=font("Vazirmatn-Bold.ttf", 34),
           fill=hex2rgb(ink), direction="rtl", language="fa")
    d.text((104, 1440), "خواب ۶ ساعت · انرژی ۳ از ۵ · تمرکز ۴ از ۵", font=f_fa,
           fill=hex2rgb(dim), direction="rtl", language="fa")

    d.text((760, 1364), "Inter — English", font=font("Inter.ttf", 13), fill=(140, 128, 114))
    d.text((760, 1388), "What did you observe today?", font=font("Inter.ttf", 31), fill=hex2rgb(ink))
    d.text((760, 1440), "Sleep 6h  ·  Energy 3/5  ·  Focus 4/5", font=font("Inter.ttf", 21),
           fill=hex2rgb(dim))
    d.text((104, 1490), "scale  " + "   ".join(f"{s}px" for s in PARAMS["type"]["scale"]) +
           "   ·   line-height 1.6 (1.8 fa long-form)", font=font("Inter.ttf", 13), fill=(140, 128, 114))

    # ---------------- 05 symbolism
    d.text((104, 1546), "05  SYMBOLISM", font=font("Inter.ttf", 17), fill=hex2rgb(dim))
    sym = [
        ("triangle", "three layers of existence — body · mind · self"),
        ("inner triangle", "the layers interlock; none stands alone"),
        ("vertical axis", "apex as source, base as market — one continuous line"),
        ("single node at apex", "every layer converges to one point of decision"),
    ]
    y = 1586
    for k, v in sym:
        d.text((104, y), k, font=font("Inter.ttf", 15), fill=hex2rgb(sec))
        d.text((330, y), v, font=font("Inter.ttf", 15), fill=hex2rgb(ink))
        y += 36

    # ---------------- tokens footer
    d.line([(104, y + 18), (W - 104, y + 18)], fill=(52, 46, 40), width=1)
    d.text((104, y + 36), "radius  control 12 · card 16 · sheet 20 · modal 28",
           font=font("Inter.ttf", 14), fill=hex2rgb(dim))
    d.text((104, y + 62), "glass  blur 18–24px · saturate 140% · border 1px · max 2 stacked surfaces",
           font=font("Inter.ttf", 14), fill=hex2rgb(dim))
    d.text((104, y + 88), "motion  160 / 220 / 280 ms · cubic-bezier(.2,.8,.2,1) · reduced-motion honoured",
           font=font("Inter.ttf", 14), fill=hex2rgb(dim))
    d.text((104, y + 122), "MONAD / MonadWave · brand build v2 · deterministic · no randomised parameters",
           font=font("Inter.ttf", 13), fill=(112, 102, 92))

    out = os.path.join(BRAND, "preview", "monadwave-brand-sheet-v2.png")
    img.save(out, quality=95)
    print("sheet:", out, img.size)


if __name__ == "__main__":
    main()
