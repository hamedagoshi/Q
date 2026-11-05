#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MONAD — Phase 1.1 brand asset builder (deterministic).

Reproduce exactly:
    python3 tools/build_brand.py
All geometry, colours and type sizes come from PARAMS below and are written to
build/brand_params.json so any later run can be diffed for bit-identical output.
No randomness is used anywhere.
"""

import json, os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = ROOT
FONTS = os.path.join(BRAND, "fonts")

PARAMS = {
    "version": "1.0.0",
    "canvas": 240,
    "center": [120, 120],
    "core_radius": 8,
    "arcs": [
        {"radius": 32, "stroke": 8, "span_deg": 316, "start_deg": -70},
        {"radius": 56, "stroke": 8, "span_deg": 316, "start_deg": -70},
        {"radius": 80, "stroke": 8, "span_deg": 316, "start_deg": -70},
    ],

    "supersample": 4,
    "colors": {
        "dark": {"bg": "#070A10", "surface": "#0E131B", "surface2": "#141B26",
                 "glass": "rgba(255,255,255,0.06)", "glass_border": "rgba(255,255,255,0.12)",
                 "ink": "#E8EEF7", "dim": "#8B97A8",
                 "primary": "#7C5CFF", "secondary": "#4FD1C5",
                 "success": "#35D07F", "danger": "#FF5C7A", "warn": "#FFC24B"},
        "light": {"bg": "#F4F6FB", "surface": "#FFFFFF", "surface2": "#EDF1F8",
                  "glass": "rgba(255,255,255,0.65)", "glass_border": "rgba(15,23,42,0.08)",
                  "ink": "#0B1220", "dim": "#5A6678",
                  "primary": "#7254EB", "secondary": "#49C1B6",
                  "success": "#31BF75", "danger": "#EB5570", "warn": "#EBB344"},
    },
    "type": {"families": {"fa": "Vazirmatn", "en": "Inter"},
             "scale": [12, 14, 16, 20, 28],
             "line_height": {"body": 1.6, "fa_long": 1.8}},
    "spacing": [4, 8, 12, 16, 24, 32, 48],
    "radius": {"control": 12, "card": 16, "sheet": 20, "modal": 28},
    "glass": {"blur_px": [18, 24], "saturate_pct": 140, "border_px": 1,
              "max_stacked_surfaces": 2},
    "motion": {"durations_ms": {"micro": 160, "transition": 220, "sheet": 280},
               "easing": "cubic-bezier(.2,.8,.2,1)"},
    "wordmark": {"text": "MONAD", "tracking": 0.18, "weight": "Medium"},
    "icons": {"sizes": [192, 512, 180], "maskable_content_scale": 0.62},
}


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def mark_points(P, scale=1.0, cx=None, cy=None):
    """Return (core, [arc boxes]) in pixel space for a given scale."""
    c = P["center"]
    cx = c[0] if cx is None else cx
    cy = c[1] if cy is None else cy
    core = P["core_radius"] * scale
    arcs = []
    for a in P["arcs"]:
        r = a["radius"] * scale
        arcs.append({
            "box": [cx - r, cy - r, cx + r, cy + r],
            "start": a["start_deg"],
            "end": a["start_deg"] + a["span_deg"],
            "width": max(1, int(round(a["stroke"] * scale))),
            "r": r,
        })
    return core, arcs, cx, cy


def draw_mark(draw, P, scale, color, cx=None, cy=None, core_color=None):
    core, arcs, cx, cy = mark_points(P, scale, cx, cy)
    for arc in arcs:
        draw.arc(arc["box"], arc["start"], arc["end"], fill=color, width=arc["width"])
        # round caps
        for ang in (arc["start"], arc["end"]):
            ex = cx + arc["r"] * math.cos(math.radians(ang))
            ey = cy + arc["r"] * math.sin(math.radians(ang))
            rr = arc["width"] / 2.0
            draw.ellipse([ex - rr, ey - rr, ex + rr, ey + rr], fill=color)
    draw.ellipse([cx - core, cy - core, cx + core, cy + core],
                 fill=(core_color or color))


def render_mark_png(P, size, fg, bg=None, scale=1.0, core_color=None):
    ss = P["supersample"]
    canvas = P["canvas"]
    big = Image.new("RGBA", (canvas * ss, canvas * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    c = P["center"]
    draw_mark(d, P, ss * scale, fg, c[0] * ss, c[1] * ss, core_color)
    out = big.resize((size, size), Image.LANCZOS)
    if bg:
        plate = Image.new("RGBA", (size, size), bg)
        plate.alpha_composite(out)
        return plate
    return out


def gradient_plate(size, c1, c2, glow=None):
    """Linear diagonal gradient with optional radial glow. Deterministic."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    a, b = hex2rgb(c1), hex2rgb(c2)
    for y in range(size):
        for x in range(size):
            t = (x / max(1, size - 1) * 0.6 + y / max(1, size - 1) * 0.4)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    if glow:
        g = Image.new("RGB", (size, size), (0, 0, 0))
        gd = ImageDraw.Draw(g)
        gr = int(size * 0.55)
        gd.ellipse([size * 0.5 - gr, size * 0.30 - gr, size * 0.5 + gr, size * 0.30 + gr],
                   fill=hex2rgb(glow))
        g = g.filter(ImageFilter.GaussianBlur(size * 0.18))
        img = Image.blend(img, Image.blend(img, g, 0.55), 0.35)
    return img


# ---------------------------------------------------------------- SVG output
def svg_mark(P, color, core_color=None, size=240):
    c = P["center"]
    core_r = P["core_radius"]
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="{size}" height="{size}" role="img" aria-label="MONAD mark">']
    for a in P["arcs"]:
        r = a["radius"]
        x1, y1 = c[0] - r, c[1] - r
        x2, y2 = c[0] + r, c[1] + r
        # SVG arcs: convert PIL-style start/end into start + sweep
        sweep = a["span_deg"]
        large = 1 if sweep > 180 else 0
        sx = c[0] + r * math.cos(math.radians(a["start_deg"]))
        sy = c[1] + r * math.sin(math.radians(a["start_deg"]))
        ex = c[0] + r * math.cos(math.radians(a["start_deg"] + sweep))
        ey = c[1] + r * math.sin(math.radians(a["start_deg"] + sweep))
        parts.append(
            f'<path d="M {sx:.2f} {sy:.2f} A {r} {r} 0 {large} 1 {ex:.2f} {ey:.2f}" '
            f'fill="none" stroke="{color}" stroke-width="{a["stroke"]}" stroke-linecap="round"/>')
    parts.append(f'<circle cx="{c[0]}" cy="{c[1]}" r="{core_r}" fill="{core_color or color}"/>')
    parts.append('</svg>')
    return "\n".join(parts)


def svg_wordmark(text="MONAD", color="#E8EEF7", tracking=0.18, size=64):
    # letter-spaced wordmark; width estimated from glyph count (deterministic)
    adv = size * 0.78
    total = len(text) * adv + (len(text) - 1) * size * tracking
    glyphs = "".join(
        f'<text x="{i * (adv + size * tracking):.2f}" y="{size * 0.86:.0f}" '
        f'font-family="Inter, Helvetica, Arial, sans-serif" font-weight="500" '
        f'font-size="{size}" fill="{color}">{ch}</text>'
        for i, ch in enumerate(text))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total:.0f} {size}" '
            f'width="{total:.0f}" height="{size}" role="img" aria-label="MONAD">{glyphs}</svg>')


def svg_lockup(P, color, mode="horizontal", size=80):
    m = svg_mark(P, color).split(">", 1)[1].rsplit("</svg>", 1)[0]
    wm = svg_wordmark(color=color).split(">", 1)[1].rsplit("</svg>", 1)[0]
    if mode == "horizontal":
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 240" width="720" height="240">'
                f'<g transform="translate(0,0)">{m}</g>'
                f'<g transform="translate(268,58) scale(1.55)">{wm}</g></svg>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 420" width="240" height="420">'
            f'<g>{m}</g><g transform="translate(6,272) scale(1.02)">{wm}</g></svg>')


# ---------------------------------------------------------------- writers
def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def build():
    C = PARAMS["colors"]
    os.makedirs(os.path.join(BRAND, "svg"), exist_ok=True)
    os.makedirs(os.path.join(BRAND, "icons"), exist_ok=True)
    os.makedirs(os.path.join(BRAND, "tokens"), exist_ok=True)
    os.makedirs(os.path.join(BRAND, "preview"), exist_ok=True)
    os.makedirs(os.path.join(BRAND, "build"), exist_ok=True)

    # --- SVG marks
    write(f"{BRAND}/svg/monad-mark-dark.svg", svg_mark(PARAMS, C["dark"]["ink"], C["dark"]["secondary"]))
    write(f"{BRAND}/svg/monad-mark-light.svg", svg_mark(PARAMS, C["light"]["ink"], C["dark"]["secondary"]))
    write(f"{BRAND}/svg/monad-mark-mono.svg", svg_mark(PARAMS, "#000000", "#000000"))
    write(f"{BRAND}/svg/monad-mark-accent.svg", svg_mark(PARAMS, C["dark"]["primary"], C["dark"]["secondary"]))
    write(f"{BRAND}/svg/monad-wordmark-dark.svg", svg_wordmark(color=C["dark"]["ink"]))
    write(f"{BRAND}/svg/monad-wordmark-light.svg", svg_wordmark(color=C["light"]["ink"]))
    write(f"{BRAND}/svg/monad-lockup-horizontal-dark.svg", svg_lockup(PARAMS, C["dark"]["ink"]))
    write(f"{BRAND}/svg/monad-lockup-horizontal-light.svg", svg_lockup(PARAMS, C["light"]["ink"]))
    write(f"{BRAND}/svg/monad-lockup-vertical-dark.svg", svg_lockup(PARAMS, C["dark"]["ink"], "vertical"))

    # --- PNG marks (transparent)
    for name, color, core in [("mark-dark", hex2rgb(C["dark"]["ink"]), hex2rgb(C["dark"]["secondary"])),
                              ("mark-light", hex2rgb(C["light"]["ink"]), hex2rgb(C["dark"]["secondary"])),
                              ("mark-mono", (0, 0, 0), (0, 0, 0))]:
        render_mark_png(PARAMS, 1024, color, None, 1.0, core).save(f"{BRAND}/svg/{name}@1024.png")

    # --- App icons
    # mark content radius is 84 units on a 240 canvas -> 0.70 of the frame at scale 1.0
    for size in PARAMS["icons"]["sizes"]:
        plate = gradient_plate(size, C["dark"]["surface2"], C["dark"]["bg"], C["dark"]["primary"]).convert("RGBA")
        mark = render_mark_png(PARAMS, size, hex2rgb(C["dark"]["ink"]), None, 0.88,
                               hex2rgb(C["dark"]["secondary"]))
        plate.alpha_composite(mark)
        plate.convert("RGB").save(f"{BRAND}/icons/icon-{size}.png", quality=95)

    for size in (192, 512):
        plate = gradient_plate(size, C["dark"]["surface2"], C["dark"]["bg"], C["dark"]["primary"]).convert("RGBA")
        mark = render_mark_png(PARAMS, size, hex2rgb(C["dark"]["ink"]), None, 0.72,
                               hex2rgb(C["dark"]["secondary"]))
        plate.alpha_composite(mark)
        plate.convert("RGB").save(f"{BRAND}/icons/icon-{size}-maskable.png", quality=95)

    # favicon
    compact = dict(PARAMS)
    compact["arcs"] = [
        {"radius": 34, "stroke": 16, "span_deg": 300, "start_deg": -60},
        {"radius": 82, "stroke": 16, "span_deg": 300, "start_deg": -60},
    ]
    compact["core_radius"] = 14
    fav = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    fg = render_mark_png(compact, 64, hex2rgb(C["dark"]["ink"]), None, 0.28, hex2rgb(C["dark"]["secondary"]))
    fav.alpha_composite(fg)
    fav.save(f"{BRAND}/icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    write(f"{BRAND}/icons/favicon.svg", svg_mark(PARAMS, C["dark"]["ink"], C["dark"]["secondary"]))

    # --- tokens
    tokens = {
        "meta": {"product": "MONAD", "version": PARAMS["version"], "generated": "2026-11-05",
                 "source": "MONAD brand build (deterministic, no randomness)"},
        "color": C,
        "type": PARAMS["type"],
        "spacing": PARAMS["spacing"],
        "radius": PARAMS["radius"],
        "glass": PARAMS["glass"],
        "motion": PARAMS["motion"],
        "icon": {"sizes": [192, 512], "maskable_safe_zone": "80% centered"},
    }
    write(f"{BRAND}/tokens/tokens.json", json.dumps(tokens, indent=2, ensure_ascii=False))

    css_dark = "\n".join(f"  --monad-{k.replace('_','-')}: {v};" for k, v in C["dark"].items())
    css_light = "\n".join(f"  --monad-{k.replace('_','-')}: {v};" for k, v in C["light"].items())
    sp = " ".join(f"{v}px" for v in PARAMS["spacing"])
    css = f"""/* MONAD design tokens — single source of truth (Phase 1.1) */
:root {{
{css_dark}
  --monad-radius-control: {PARAMS['radius']['control']}px;
  --monad-radius-card: {PARAMS['radius']['card']}px;
  --monad-radius-sheet: {PARAMS['radius']['sheet']}px;
  --monad-radius-modal: {PARAMS['radius']['modal']}px;
  --monad-space: {sp};
  --monad-blur: {PARAMS['glass']['blur_px'][0]}px;
  --monad-blur-lg: {PARAMS['glass']['blur_px'][1]}px;
  --monad-saturate: {PARAMS['glass']['saturate_pct']}%;
  --monad-dur-micro: {PARAMS['motion']['durations_ms']['micro']}ms;
  --monad-dur-transition: {PARAMS['motion']['durations_ms']['transition']}ms;
  --monad-dur-sheet: {PARAMS['motion']['durations_ms']['sheet']}ms;
  --monad-ease: {PARAMS['motion']['easing']};
  --monad-font-fa: 'Vazirmatn', system-ui, sans-serif;
  --monad-font-en: 'Inter', system-ui, sans-serif;
  --monad-fs-12: 12px; --monad-fs-14: 14px; --monad-fs-16: 16px;
  --monad-fs-20: 20px; --monad-fs-28: 28px;
}}

[data-theme="light"] {{
{css_light}
}}

@media (prefers-reduced-motion: reduce) {{
  :root {{ --monad-dur-micro: 1ms; --monad-dur-transition: 1ms; --monad-dur-sheet: 1ms; }}
}}
"""
    write(f"{BRAND}/tokens/tokens.css", css)
    write(f"{BRAND}/build/brand_params.json", json.dumps(PARAMS, indent=2))

    print("brand build complete")
    return tokens


if __name__ == "__main__":
    build()
