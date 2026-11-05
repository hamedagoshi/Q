#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MONAD — brand sheet composer (Phase 1.1 evidence artefact).
Deterministic: same inputs -> same PNG. No randomness.
Run: python3 tools/compose_sheet.py
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_brand import PARAMS, ROOT, BRAND, render_mark_png, gradient_plate, hex2rgb, draw_mark
from PIL import Image, ImageDraw, ImageFont

W, H = 1500, 1980
FONTS = os.path.join(BRAND, "fonts")
C = PARAMS["colors"]

def font(path, size):
    return ImageFont.truetype(os.path.join(FONTS, path), size)

def tracked(draw, xy, text, f, fill, tracking=0.18):
    """Draw letter-spaced text; returns total width."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + f.size * tracking
    return x - xy[0]

def card(draw, box, fill, radius=20, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def main():
    img = Image.new("RGB", (W, H), hex2rgb(C["dark"]["bg"]))
    d = ImageDraw.Draw(img)

    ink, dim = C["dark"]["ink"], C["dark"]["dim"]
    surf, surf2 = C["dark"]["surface"], C["dark"]["surface2"]
    prim, sec = C["dark"]["primary"], C["dark"]["secondary"]

    # soft background glow
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W*0.42, -H*0.18, W*0.98, H*0.22], fill=hex2rgb(prim))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img = Image.blend(img, glow, 0.10)
    d = ImageDraw.Draw(img)

    # ---------------- header
    mark = render_mark_png(PARAMS, 132, hex2rgb(ink), None, 0.55, hex2rgb(sec))
    img.paste(mark, (110, 92), mark)

    f_wm = font("Inter.ttf", 76)
    tracked(d, (268, 108), "MONAD", f_wm, ink, 0.20)

    f_fa = font("Vazirmatn.ttf" if os.path.exists(os.path.join(FONTS, "Vazirmatn.ttf")) else "Vazirmatn-Regular.ttf", 26)
    d.text((272, 190), "هر روز، یک مشاهده", font=f_fa, fill=sec, direction="rtl", language="fa")
    f_small = font("Inter.ttf", 19)
    d.text((272, 232), "Observe.  Record.  Understand.", font=f_small, fill=dim)

    d.line([(110, 320), (W-110, 320)], fill=(38, 48, 62), width=1)

    # ---------------- section 1: mark variants
    d.text((110, 352), "01  MARK", font=font("Inter.ttf", 17), fill=dim)
    d.text((232, 350), "one point · three concentric arcs", font=font("Inter.ttf", 15), fill=(110, 124, 142))

    cards = [
        ("Dark", surf, ink, sec),
        ("Light", "#F4F6FB", "#0B1220", "#4FD1C5"),
        ("Monochrome", surf2, "#FFFFFF", "#FFFFFF"),
    ]
    x = 110
    for label, bg, fg, core in cards:
        box = [x, 392, x + 300, 692]
        card(d, box, hex2rgb(bg), 24, (46, 58, 74))
        m = render_mark_png(PARAMS, 190, hex2rgb(fg), None, 0.79, hex2rgb(core))
        img.paste(m, (x + 55, 432), m)
        d.text((x + 24, 646), label, font=font("Inter.ttf", 15), fill=hex2rgb(dim if bg != "#F4F6FB" else "#5A6678"))
        x += 330

    # ---------------- section 2: app icons
    d.text((110, 736), "02  APP ICON", font=font("Inter.ttf", 17), fill=dim)
    d.text((296, 734), "192 / 512 · maskable safe zone 80%", font=font("Inter.ttf", 15), fill=(110, 124, 142))

    for i, (path, size, label) in enumerate([
        ("icons/icon-192.png", 150, "192"),
        ("icons/icon-192-maskable.png", 150, "192 maskable"),
        ("icons/icon-512.png", 150, "512"),
        ("icons/icon-512-maskable.png", 150, "512 maskable"),
    ]):
        ic = Image.open(os.path.join(BRAND, path)).convert("RGB").resize((size, size), Image.LANCZOS)
        px = 110 + i * 330
        img.paste(ic, (px, 776))
        d.text((px, 938), label, font=font("Inter.ttf", 14), fill=dim)
    d.text((110, 972), "maskable preview — outer 10% may be cropped by the launcher", font=font("Inter.ttf", 13), fill=(96, 108, 126))

    # ---------------- section 3: palette
    d.text((110, 1032), "03  PALETTE", font=font("Inter.ttf", 17), fill=dim)

    def swatch_row(y, theme, note):
        d.text((110, y - 26), note, font=font("Inter.ttf", 14), fill=(110, 124, 142))
        x = 110
        for name, val in C[theme].items():
            if val.startswith("rgba"):
                rgb = val
                fillc = (28, 34, 44) if theme == "dark" else (240, 243, 249)
            else:
                fillc = hex2rgb(val)
                rgb = val
            card(d, [x, y, x + 148, y + 92], fillc, 14, (52, 64, 80))
            d.text((x + 10, y + 52), name, font=font("Inter.ttf", 12), fill=hex2rgb(C[theme]["ink"]) if sum(fillc) < 380 else (20, 26, 36))
            d.text((x + 10, y + 70), rgb.replace("rgba(", "").replace(")", "")[:18], font=font("Inter.ttf", 10),
                   fill=(150, 160, 175) if sum(fillc) < 380 else (70, 80, 95))
            x += 158

    swatch_row(1080, "dark", "dark  (default)")
    swatch_row(1268, "light", "light")

    # ---------------- section 4: type
    d.text((110, 1436), "04  TYPOGRAPHY", font=font("Inter.ttf", 17), fill=dim)
    d.text((110, 1470), "Vazirmatn — فارسی", font=font("Inter.ttf", 14), fill=(110, 124, 142))
    d.text((110, 1494), "امروز چه چیزی را مشاهده کردی؟", font=font("Vazirmatn-Bold.ttf", 34), fill=ink,
           direction="rtl", language="fa")
    d.text((110, 1548), "خواب ۶ ساعت · انرژی ۳ از ۵ · تمرکز ۴ از ۵", font=f_fa, fill=dim,
           direction="rtl", language="fa")

    d.text((760, 1470), "Inter — English", font=font("Inter.ttf", 14), fill=(110, 124, 142))
    d.text((760, 1494), "What did you observe today?", font=font("Inter.ttf", 31), fill=ink)
    d.text((760, 1546), "Sleep 6h  ·  Energy 3/5  ·  Focus 4/5", font=font("Inter.ttf", 21), fill=dim)

    scale = "   ".join(f"{s}px" for s in PARAMS["type"]["scale"])
    d.text((110, 1606), f"scale  {scale}   ·   line-height 1.6 (1.8 fa long-form)", font=font("Inter.ttf", 14), fill=(110, 124, 142))

    # ---------------- section 5: system tokens
    d.text((110, 1662), "05  SYSTEM TOKENS", font=font("Inter.ttf", 17), fill=dim)

    rows = [
        ("spacing", "  ".join(f"{v}" for v in PARAMS["spacing"]) + "  px"),
        ("radius", f"control {PARAMS['radius']['control']} · card {PARAMS['radius']['card']} · sheet {PARAMS['radius']['sheet']} · modal {PARAMS['radius']['modal']}"),
        ("glass", f"blur {PARAMS['glass']['blur_px'][0]}–{PARAMS['glass']['blur_px'][1]}px · saturate {PARAMS['glass']['saturate_pct']}% · border {PARAMS['glass']['border_px']}px · max {PARAMS['glass']['max_stacked_surfaces']} layers"),
        ("motion", f"{PARAMS['motion']['durations_ms']['micro']} / {PARAMS['motion']['durations_ms']['transition']} / {PARAMS['motion']['durations_ms']['sheet']} ms · {PARAMS['motion']['easing']}"),
    ]
    y = 1700
    for k, v in rows:
        d.text((110, y), k, font=font("Inter.ttf", 15), fill=sec)
        d.text((250, y), v, font=font("Inter.ttf", 15), fill=ink)
        y += 34

    d.line([(110, y + 22), (W-110, y + 22)], fill=(38, 48, 62), width=1)
    d.text((110, y + 40), "MONAD · Phase 1.1 · deterministic brand build · no randomised parameters",
           font=font("Inter.ttf", 13), fill=(96, 108, 126))

    out = os.path.join(BRAND, "preview", "monad-brand-sheet.png")
    img.save(out, quality=95)
    print("sheet:", out, img.size)

if __name__ == "__main__":
    from PIL import ImageFilter
    main()
