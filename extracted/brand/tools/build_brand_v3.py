#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MonadWave brand v3 — reconstructed from pixel analysis of the supplied logo.

Measured from the source image (640x640):
  background      #202123
  amber           #C07E24   (letters M / D, triangle wireframe)
  cream           #C9B9A2   (MonadWave wordmark)
  mark box        x 75..565  y 219..333   -> 491 x 115  (aspect 4.27)
  structure       heavy M + thin wireframe triangle with horizontal rungs + heavy D
                  + "MonadWave" set beneath the letters

No randomness. All numbers below are the parameters actually used.
"""

import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "fonts")
OUT = os.path.join(ROOT, "v3")

PARAMS = {
    "version": "3.0.0",
    "measured_from_source": {
        "size": [640, 640],
        "bg": "#202123", "amber": "#C07E24", "cream": "#C9B9A2",
        "mark_box": {"x": [75, 565], "y": [219, 333], "w": 491, "h": 115, "aspect": 4.27},
    },
    "palette": {
        "dark": {
            "bg": "#16171A", "bg_elevated": "#1D1E21", "surface": "#202123",
            "surface_alt": "#26282C", "line": "rgba(255,255,255,0.07)",
            "line_strong": "rgba(255,255,255,0.12)",
            "ink": "#EDE6D8", "ink_muted": "#9C9284", "ink_faint": "#6E6659",
            "accent": "#C8832A", "accent_hover": "#D89440", "accent_soft": "rgba(200,131,42,0.14)",
            "cream": "#C9B9A2",
            "profit": "#6E9E7B", "loss": "#C2665E", "warn": "#C8A24A",
        },
        "light": {
            "bg": "#F5F2EB", "bg_elevated": "#FFFFFF", "surface": "#FFFFFF",
            "surface_alt": "#EFEAE0", "line": "rgba(27,26,24,0.09)",
            "line_strong": "rgba(27,26,24,0.16)",
            "ink": "#1B1A18", "ink_muted": "#6B6355", "ink_faint": "#9A9080",
            "accent": "#A9661E", "accent_hover": "#8E5314", "accent_soft": "rgba(169,102,30,0.10)",
            "cream": "#7A6A4E",
            "profit": "#4F7F5C", "loss": "#A6524B", "warn": "#9A7B2C",
        },
    },
    "type": {
        "families": {"fa": "Vazirmatn", "en": "Inter"},
        "scale": {"display": 34, "title": 24, "heading": 18, "body": 15, "caption": 13, "micro": 11},
        "weights": {"regular": 400, "medium": 500, "semibold": 600, "bold": 700},
        "numbers": "tabular-nums",
    },
    "space": {"1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48},
    "radius": {"xs": 8, "sm": 10, "md": 14, "lg": 18, "xl": 24, "pill": 999},
    "elevation": {
        "flat": "none",
        "card": "0 1px 0 rgba(255,255,255,0.04) inset",
        "float": "0 8px 24px rgba(0,0,0,0.28)",
    },
    "motion": {"fast": 120, "base": 180, "slow": 240, "easing": "cubic-bezier(0.22,1,0.36,1)"},
    "mark": {
        "cap_height": 100,
        "triangle_width_ratio": 1.45,
        "stroke": 2.2,
        "rungs": 4,
        "axis": True,
        "letters_weight": 800,
        "letter_gap_ratio": 0.32,
    },
}


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- mark
def triangle_geometry(cx, cy, cap, P):
    """Upright wireframe triangle with horizontal rungs; returns line list."""
    h = cap
    w = cap * P["mark"]["triangle_width_ratio"]
    ax, ay = cx, cy - h / 2.0
    blx, bly = cx - w / 2.0, cy + h / 2.0
    brx, bry = cx + w / 2.0, cy + h / 2.0
    segs = [((ax, ay), (blx, bly)), ((ax, ay), (brx, bry)), ((blx, bly), (brx, bry))]
    # horizontal rungs (the layers)
    n = P["mark"]["rungs"]
    for i in range(1, n + 1):
        t = i / (n + 1.0)
        y = ay + (bly - ay) * t
        half = (w / 2.0) * t
        segs.append(((cx - half, y), (cx + half, y)))
    if P["mark"]["axis"]:
        segs.append(((ax, ay), (cx, bly)))
    return segs


def draw_triangle(d, cx, cy, cap, color, width, P):
    for (p, q) in triangle_geometry(cx, cy, cap, P):
        d.line([p, q], fill=color, width=max(1, int(round(width))))


def render_lockup(P, path, scale=4, bg=None, amber=None, cream=None, with_wordmark=True):
    C = P["palette"]["dark"]
    amber = amber or hex2rgb(C["accent"])
    cream = cream or hex2rgb(C["cream"])
    cap = P["mark"]["cap_height"] * scale
    weight = P["mark"]["letters_weight"]
    f_letters = ImageFont.truetype(os.path.join(FONTS, "Inter.ttf"), cap)
    try:
        f_letters.set_variation_by_axes([weight])
    except Exception:
        pass

    gap = cap * P["mark"]["letter_gap_ratio"]
    tri_w = cap * P["mark"]["triangle_width_ratio"]
    M_w = f_letters.getlength("M")
    D_w = f_letters.getlength("D")
    total_w = M_w + gap + tri_w + gap + D_w + cap * 0.3
    H = int(cap * 1.4 + (cap * 0.55 if with_wordmark else 0))
    W = int(total_w + 40 * scale)

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0) if bg is None else hex2rgb(bg) + (255,))
    d = ImageDraw.Draw(img)

    x = 20 * scale
    top = 10 * scale
    # letters baseline aligned with triangle base
    asc, desc = f_letters.getmetrics()
    d.text((x, top), "M", font=f_letters, fill=amber)
    x += M_w + gap
    cap_center_y = top + cap * 0.52
    draw_triangle(d, x + tri_w / 2.0, top + cap / 2.0, cap, amber, P["mark"]["stroke"] * scale, P)
    x += tri_w + gap
    d.text((x, top), "D", font=f_letters, fill=amber)

    if with_wordmark:
        f_sub = ImageFont.truetype(os.path.join(FONTS, "Inter.ttf"), int(cap * 0.30))
        try:
            f_sub.set_variation_by_axes([500])
        except Exception:
            pass
        sub = "MonadWave"
        track = cap * 0.03
        wsub = sum(f_sub.getlength(c) + track for c in sub) - track
        sx = 20 * scale + (total_w - wsub) / 2.0
        sy = top + cap * 1.42
        cx = sx
        for ch in sub:
            d.text((cx, sy), ch, font=f_sub, fill=cream)
            cx += f_sub.getlength(ch) + track

    img.save(path)
    return img.size


def render_mark(P, path, size, color, stroke_scale=1.0, transparent=True, bg=None):
    S = 8
    cap = size * 0.82
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    big = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    draw_triangle(d, size * S / 2.0, size * S / 2.0, cap * S, color,
                  P["mark"]["stroke"] * S * stroke_scale, P)
    img.alpha_composite(big.resize((size, size), Image.LANCZOS))
    if bg:
        plate = Image.new("RGBA", (size, size), hex2rgb(bg) + (255,))
        plate.alpha_composite(img)
        img = plate
    img.save(path)
    return img.size


def svg_triangle(P, color, size=240):
    cx, cy, cap = size / 2.0, size / 2.0, size * 0.82
    segs = triangle_geometry(cx, cy, cap, P)
    sw = P["mark"]["stroke"] * (size / 240.0) * 6
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img" aria-label="MonadWave mark">']
    for (p, q) in segs:
        parts.append(f'<line x1="{p[0]:.2f}" y1="{p[1]:.2f}" x2="{q[0]:.2f}" y2="{q[1]:.2f}" '
                     f'stroke="{color}" stroke-width="{sw:.2f}" stroke-linecap="round"/>')
    parts.append('</svg>')
    return "\n".join(parts)


def build():
    os.makedirs(OUT, exist_ok=True)
    C = PARAMS["palette"]
    amber = hex2rgb(C["dark"]["accent"])
    cream = hex2rgb(C["dark"]["cream"])

    # lockups
    render_lockup(PARAMS, os.path.join(OUT, "lockup-monadwave@4x.png"), scale=4)
    render_lockup(PARAMS, os.path.join(OUT, "lockup-on-charcoal.png"), scale=4,
                  bg=C["dark"]["bg"])
    # marks
    render_mark(PARAMS, os.path.join(OUT, "mark-amber@512.png"), 512, amber)
    render_mark(PARAMS, os.path.join(OUT, "mark-cream@512.png"), 512, cream)
    render_mark(PARAMS, os.path.join(OUT, "mark-mono@512.png"), 512, (0, 0, 0))
    render_mark(PARAMS, os.path.join(OUT, "icon-512.png"), 512, amber, 2.2, bg=C["dark"]["surface"])
    render_mark(PARAMS, os.path.join(OUT, "icon-192.png"), 192, amber, 2.2, bg=C["dark"]["surface"])

    with open(os.path.join(OUT, "mark-amber.svg"), "w", encoding="utf-8") as f:
        f.write(svg_triangle(PARAMS, C["dark"]["accent"]))

    # tokens
    tokens = {
        "meta": {"product": "MONAD", "academy": "MonadWave", "version": PARAMS["version"],
                 "source": "measured from supplied logo", "date": "2026-11-05"},
        "color": C, "type": PARAMS["type"], "space": PARAMS["space"],
        "radius": PARAMS["radius"], "elevation": PARAMS["elevation"], "motion": PARAMS["motion"],
        "mark": PARAMS["mark"],
    }
    with open(os.path.join(OUT, "tokens.json"), "w", encoding="utf-8") as f:
        json.dump(tokens, f, indent=2, ensure_ascii=False)

    def css_vars(theme):
        return "\n".join(f"  --mw-{k.replace('_','-')}: {v};" for k, v in C[theme].items())

    css = f"""/* MonadWave / MONAD — design tokens v3 (measured from the logo) */
:root {{
{css_vars('dark')}
  --mw-radius-xs: 8px; --mw-radius-sm: 10px; --mw-radius-md: 14px;
  --mw-radius-lg: 18px; --mw-radius-xl: 24px; --mw-radius-pill: 999px;
  --mw-space-1: 4px; --mw-space-2: 8px; --mw-space-3: 12px; --mw-space-4: 16px;
  --mw-space-5: 20px; --mw-space-6: 24px; --mw-space-8: 32px; --mw-space-10: 40px;
  --mw-fs-display: 34px; --mw-fs-title: 24px; --mw-fs-heading: 18px;
  --mw-fs-body: 15px; --mw-fs-caption: 13px; --mw-fs-micro: 11px;
  --mw-font-fa: 'Vazirmatn', system-ui, sans-serif;
  --mw-font-en: 'Inter', system-ui, sans-serif;
  --mw-ease: cubic-bezier(0.22,1,0.36,1);
  --mw-dur-fast: 120ms; --mw-dur-base: 180ms; --mw-dur-slow: 240ms;
}}
[data-theme="light"] {{
{css_vars('light')}
}}
@media (prefers-reduced-motion: reduce) {{
  :root {{ --mw-dur-fast: 1ms; --mw-dur-base: 1ms; --mw-dur-slow: 1ms; }}
}}
"""
    with open(os.path.join(OUT, "tokens.css"), "w", encoding="utf-8") as f:
        f.write(css)

    with open(os.path.join(OUT, "brand_params.json"), "w", encoding="utf-8") as f:
        json.dump(PARAMS, f, indent=2, ensure_ascii=False)

    print("v3 built:", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    build()
