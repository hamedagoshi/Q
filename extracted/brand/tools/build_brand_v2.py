#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MONAD / MonadWave — brand build v2 (deterministic).

Identity source: the supplied MonadWave academy logo — an upright triangular
lattice (crystal / pyramid facets) in orange on charcoal, with a cream wordmark.

Symbolism encoded in geometry:
  triangle        = the three layers of existence (body / mind / self)
  3 mid-segment   = how the layers interlock (each pair shares one facet)
  vertical median = the axis from apex (source) to base (market)
  lattice level 2 = hierarchy of knowledge, not decoration

No randomness. Every number lives in PARAMS and is written to
build/brand_params.json so the build is exactly reproducible.
"""

import json, math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = ROOT
FONTS = os.path.join(BRAND, "fonts")

PARAMS = {
    "version": "2.0.0",
    "identity": {
        "academy": "MonadWave",
        "product": "MONAD",
        "tagline_fa": "هر روز، یک مشاهده",
        "tagline_en": "Observe. Record. Understand.",
    },
    "canvas": 240,
    # upright equilateral triangle, apex up
    "triangle": {"apex": [120, 26], "base_left": [24, 202], "base_right": [216, 202]},
    "lattice": {"levels": 1, "inner_scale": 0.5, "median": True},
    "stroke": {"outer": 13, "inner": 7},
    "supersample": 4,
    "colors": {
        "dark": {
            "bg": "#121316", "surface": "#1A1C20", "surface2": "#22252A",
            "glass": "rgba(255,255,255,0.06)", "glass_border": "rgba(255,255,255,0.12)",
            "ink": "#F2E9D8", "dim": "#A79E8E",
            "primary": "#F26722", "primary_light": "#FF8A3D", "primary_deep": "#C24E12",
            "secondary": "#F2B33D", "success": "#57B87A", "danger": "#E5484D", "warn": "#F2B33D",
        },
        "light": {
            "bg": "#F7F3EA", "surface": "#FFFDF8", "surface2": "#F0E9DC",
            "glass": "rgba(255,255,255,0.65)", "glass_border": "rgba(38,30,20,0.10)",
            "ink": "#1A1613", "dim": "#6B6154",
            "primary": "#D9560F", "primary_light": "#F26722", "primary_deep": "#A8420B",
            "secondary": "#C98A1E", "success": "#3F9A61", "danger": "#C93B40", "warn": "#C98A1E",
        },
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
    "icons": {"sizes": [192, 512, 180], "mark_scale": 0.86, "maskable_mark_scale": 0.70},
}


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def tri_points(P, scale=1.0, dx=0.0, dy=0.0):
    t = P["triangle"]
    return (
        (t["apex"][0] * scale + dx, t["apex"][1] * scale + dy),
        (t["base_left"][0] * scale + dx, t["base_left"][1] * scale + dy),
        (t["base_right"][0] * scale + dx, t["base_right"][1] * scale + dy),
    )


def mid(a, b):
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def lattice_lines(P, levels=2):
    """Crystal lattice: outer triangle, medial triangle, axis, and a medial
    triangle inside each of the three corner facets (Sierpinski depth 2)."""
    a, bl, br = tri_points(P)
    segs = []

    # 1. the three outer edges (the frame of the pyramid)
    for p, q in ((a, bl), (bl, br), (br, a)):
        segs.append((p, q, "outer"))

    # 2. the medial (inverted) triangle — how the three layers interlock
    m1, m2, m3 = mid(a, bl), mid(bl, br), mid(br, a)
    for p, q in ((m1, m2), (m2, m3), (m3, m1)):
        segs.append((p, q, "inner"))

    # 3. the three medians — the axes where the layers meet at one centre
    if P["lattice"]["median"]:
        segs.append((a, mid(bl, br), "inner"))

    # 4. depth 2 — a medial triangle inside each corner facet
    if levels >= 2:
        facets = [(a, m3, m1), (bl, m1, m2), (br, m2, m3)]
        for (v1, v2, v3) in facets:
            p, q, r = mid(v1, v2), mid(v2, v3), mid(v3, v1)
            for x, y in ((p, q), (q, r), (r, p)):
                segs.append((x, y, "inner"))
    return segs


def draw_mark(draw, P, scale, color, dx=0.0, dy=0.0, core=None):
    segs = lattice_lines(P, P["lattice"]["levels"])
    for (p, q, kind) in segs:
        w = int(round(P["stroke"][kind] * scale))
        draw.line([(p[0] * scale + dx, p[1] * scale + dy), (q[0] * scale + dx, q[1] * scale + dy)],
                  fill=color, width=w, joint="curve")
    # apex node — the single point all layers converge to
    a = tri_points(P)[0]
    r = 9 * scale
    cx, cy = a[0] * scale + dx, a[1] * scale + dy
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(core or color))


def render_mark_png(P, size, fg, scale=1.0, core=None, bg=None):
    ss = P["supersample"]
    c = P["canvas"]
    big = Image.new("RGBA", (c * ss, c * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    draw_mark(d, P, ss * scale, fg, 0, 0, core)
    out = big.resize((size, size), Image.LANCZOS)
    if bg:
        plate = Image.new("RGBA", (size, size), bg)
        plate.alpha_composite(out)
        return plate
    return out


def gradient_plate(size, c1, c2, glow=None):
    img = Image.new("RGB", (size, size))
    px = img.load()
    a, b = hex2rgb(c1), hex2rgb(c2)
    for y in range(size):
        for x in range(size):
            t = (x / max(1, size - 1) * 0.55 + y / max(1, size - 1) * 0.45)
            px[x, y] = lerp(a, b, t)
    if glow:
        g = Image.new("RGB", (size, size), (0, 0, 0))
        gd = ImageDraw.Draw(g)
        gr = int(size * 0.52)
        gd.ellipse([size * 0.5 - gr, size * 0.42 - gr, size * 0.5 + gr, size * 0.42 + gr],
                   fill=hex2rgb(glow))
        g = g.filter(ImageFilter.GaussianBlur(size * 0.20))
        img = Image.blend(img, g, 0.22)
    return img


# ------------------------------------------------------------------ SVG
def svg_mark(P, color, core=None):
    segs = lattice_lines(P, P["lattice"]["levels"])
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" '
             'width="240" height="240" role="img" aria-label="MonadWave mark">']
    for (p, q, kind) in segs:
        w = P["stroke"][kind]
        cap = "round"
        parts.append(f'<line x1="{p[0]:.2f}" y1="{p[1]:.2f}" x2="{q[0]:.2f}" y2="{q[1]:.2f}" '
                     f'stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"/>')
    a = P["triangle"]["apex"]
    parts.append(f'<circle cx="{a[0]}" cy="{a[1]}" r="9" fill="{core or color}"/>')
    parts.append('</svg>')
    return "\n".join(parts)


def text_path_svg(text, color, size=64, tracking=0.18, family="Inter, Helvetica, Arial, sans-serif", weight=500):
    adv = size * 0.78
    total = len(text) * adv + (len(text) - 1) * size * tracking
    glyphs = "".join(
        f'<text x="{i * (adv + size * tracking):.2f}" y="{size * 0.86:.0f}" font-family="{family}" '
        f'font-weight="{weight}" font-size="{size}" fill="{color}">{ch}</text>'
        for i, ch in enumerate(text))
    return total, glyphs


def svg_wordmark(text, color, size=64):
    total, glyphs = text_path_svg(text, color, size)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total:.0f} {size + 8}" '
            f'width="{total:.0f}" height="{size + 8}" role="img" aria-label="{text}">{glyphs}</svg>')


def svg_lockup(P, accent, ink, horizontal=True):
    m = svg_mark(P, accent, ink).split(">", 1)[1].rsplit("</svg>", 1)[0]
    if horizontal:
        total, glyphs = text_path_svg("MAD", accent, 96, 0.14)
        _, sub = text_path_svg("MonadWave", ink, 34, 0.06, weight=400)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" width="760" height="300">'
                f'<g transform="translate(10,30) scale(1.0)">{m}</g>'
                f'<g transform="translate(286,86) scale(0.95)">{glyphs}</g>'
                f'<g transform="translate(292,214) scale(1.0)">{sub}</g></svg>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="300" height="420">'
            f'<g transform="translate(30,0)">{m}</g></svg>')


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def build():
    C = PARAMS["colors"]
    for sub in ("svg", "icons", "tokens", "preview", "build"):
        os.makedirs(os.path.join(BRAND, sub), exist_ok=True)

    # ---- marks
    orange = hex2rgb(C["dark"]["primary"])
    cream = hex2rgb(C["dark"]["ink"])
    write(f"{BRAND}/svg/monadwave-mark-orange.svg", svg_mark(PARAMS, C["dark"]["primary"], C["dark"]["ink"]))
    write(f"{BRAND}/svg/monadwave-mark-cream.svg", svg_mark(PARAMS, C["dark"]["ink"], C["dark"]["primary"]))
    write(f"{BRAND}/svg/monadwave-mark-mono.svg", svg_mark(PARAMS, "#000000", "#000000"))
    write(f"{BRAND}/svg/monadwave-mark-light.svg", svg_mark(PARAMS, C["light"]["primary"], C["light"]["primary_deep"]))

    render_mark_png(PARAMS, 1024, orange, 1.0, cream).save(f"{BRAND}/svg/mark-orange@1024.png")
    render_mark_png(PARAMS, 1024, cream, 1.0, orange).save(f"{BRAND}/svg/mark-cream@1024.png")
    render_mark_png(PARAMS, 1024, (0, 0, 0), 1.0, (0, 0, 0)).save(f"{BRAND}/svg/mark-mono@1024.png")

    # ---- wordmarks
    write(f"{BRAND}/svg/monadwave-wordmark-cream.svg", svg_wordmark("MonadWave", C["dark"]["ink"], 56))
    write(f"{BRAND}/svg/monadwave-wordmark-orange.svg", svg_wordmark("MonadWave", C["dark"]["primary"], 56))
    write(f"{BRAND}/svg/monad-wordmark-cream.svg", svg_wordmark("MONAD", C["dark"]["ink"], 64))
    write(f"{BRAND}/svg/monadwave-lockup-horizontal.svg", svg_lockup(PARAMS, C["dark"]["primary"], C["dark"]["ink"]))
    write(f"{BRAND}/svg/monadwave-lockup-horizontal-light.svg", svg_lockup(PARAMS, C["light"]["primary"], C["light"]["ink"]))

    # ---- icons
    for size in PARAMS["icons"]["sizes"]:
        plate = gradient_plate(size, C["dark"]["surface2"], C["dark"]["bg"], C["dark"]["primary"]).convert("RGBA")
        m = render_mark_png(PARAMS, size, orange, PARAMS["icons"]["mark_scale"], cream)
        plate.alpha_composite(m)
        plate.convert("RGB").save(f"{BRAND}/icons/icon-{size}.png", quality=95)

    for size in (192, 512):
        plate = gradient_plate(size, C["dark"]["surface2"], C["dark"]["bg"], C["dark"]["primary"]).convert("RGBA")
        m = render_mark_png(PARAMS, size, orange, PARAMS["icons"]["maskable_mark_scale"], cream)
        plate.alpha_composite(m)
        plate.convert("RGB").save(f"{BRAND}/icons/icon-{size}-maskable.png", quality=95)

    compact = dict(PARAMS)
    compact["stroke"] = {"outer": 26, "inner": 0}
    compact["lattice"] = {"levels": 0, "inner_scale": 0.5, "median": False}
    fav = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    fav.alpha_composite(render_mark_png(compact, 64, orange, 0.30, cream))
    fav.save(f"{BRAND}/icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    write(f"{BRAND}/icons/favicon.svg", svg_mark(PARAMS, C["dark"]["primary"], C["dark"]["ink"]))

    # ---- tokens
    tokens = {
        "meta": {"product": "MONAD", "academy": "MonadWave", "version": PARAMS["version"],
                 "generated": "2026-11-05",
                 "markets": ["academy", "product"],
                 "symbolism": {
                     "triangle": "three layers of existence: body, mind, self",
                     "medial_lines": "interlock between layers",
                     "median": "axis from source (apex) to market (base)",
                     "lattice": "hierarchy of knowledge, not decoration"}},
        "color": C, "type": PARAMS["type"], "spacing": PARAMS["spacing"],
        "radius": PARAMS["radius"], "glass": PARAMS["glass"], "motion": PARAMS["motion"],
        "icon": {"sizes": [192, 512], "maskable_safe_zone": "80% centered"},
    }
    write(f"{BRAND}/tokens/tokens.json", json.dumps(tokens, indent=2, ensure_ascii=False))

    def block(theme):
        return "\n".join(f"  --monad-{k.replace('_', '-')}: {v};" for k, v in C[theme].items())

    css = f"""/* MONAD / MonadWave — design tokens v2 (single source of truth) */
:root {{
{block('dark')}
  --monad-radius-control: {PARAMS['radius']['control']}px;
  --monad-radius-card: {PARAMS['radius']['card']}px;
  --monad-radius-sheet: {PARAMS['radius']['sheet']}px;
  --monad-radius-modal: {PARAMS['radius']['modal']}px;
  --monad-space: {' '.join(str(v) + 'px' for v in PARAMS['spacing'])};
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
{block('light')}
}}

@media (prefers-reduced-motion: reduce) {{
  :root {{ --monad-dur-micro: 1ms; --monad-dur-transition: 1ms; --monad-dur-sheet: 1ms; }}
}}
"""
    write(f"{BRAND}/tokens/tokens.css", css)
    write(f"{BRAND}/build/brand_params.json", json.dumps(PARAMS, indent=2))
    print("brand v2 built")


if __name__ == "__main__":
    build()
