#!/usr/bin/env python3
"""MONAD Phase 1.1 — final identity build. Deterministic, no invented geometry.

Sources
  mark   : potrace trace of the owner's supplied logo (v4/src/mark.svg)
  word   : Inter variable font outlines (weight 620, tracking .055em)
"""
import os, re, json, subprocess, hashlib
from PIL import Image

HERE  = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.dirname(HERE)
V4    = os.path.join(os.path.dirname(FINAL), "v4")
FONTS = os.path.join(os.path.dirname(FINAL), "fonts")
OUT   = os.path.join(FINAL, "assets")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- palette (spec)
PAL = {
    "dark": {
        "bg": "#17181A", "surface": "#1E1F22", "surface2": "#26282C",
        "ink": "#EDE4D4", "muted": "#A29682",
        "accent": "#C8832A", "accentStrong": "#E0A24B",
        "line": "rgba(237,228,212,0.10)",
        "positive": "#7FA87F", "negative": "#C4705F", "warning": "#C9A227",
    },
    "light": {
        "bg": "#F5F1E8", "surface": "#FFFFFF", "surface2": "#EDE7DA",
        "ink": "#1A1917", "muted": "#6F6656",
        "accent": "#A9661E", "accentStrong": "#C8832A",
        "line": "rgba(26,25,23,0.10)",
        "positive": "#4F7A52", "negative": "#A14A3C", "warning": "#8A6D12",
    },
}

# ---------------------------------------------------------------- mark geometry
def mark_group(kind="optical"):
    """kind=optical -> optical-size trace (heavier stroke, legible at 16-192px)
       kind=precise -> literal trace of the supplied artwork (large format only)"""
    fname = "_mark-optical.svg" if kind == "optical" else "_mark-precise.svg"
    svg = open(os.path.join(OUT, fname), encoding="utf-8").read()
    g = re.search(r'<g transform=.*?</g>', svg, re.S).group(0)
    return g

MK = dict(x=0, y=0, w=113, h=114)

def svg_wrap(inner, w, h, bg=None):
    bgrect = f'<rect x="0" y="0" width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" '
            f'width="{w:.1f}" height="{h:.1f}">{bgrect}{inner}</svg>')

def mark_svg(color, pad=0):
    g = mark_group().replace('fill="#000000"', f'fill="{color}"')
    return svg_wrap(f'<g transform="translate({-MK["x"]+pad},{ -MK["y"]+pad})">{g}</g>',
                    MK["w"]+2*pad, MK["h"]+2*pad)

# ---------------------------------------------------------------- wordmark
from wordmark import glyph_paths
GLYPHS, W_WORD, CAP, UPM = glyph_paths()
SCALE = 100.0 / CAP                    # normalize cap height to 100 units

def wordmark_svg(color, cap=100.0):
    s = cap / CAP
    paths = "".join(f'<path d="{d}" fill="{color}"/>' for _, d, _, _ in GLYPHS)
    return svg_wrap(f'<g transform="scale({s:.6f}) translate(0,{CAP})">{paths}</g>',
                    W_WORD * s, cap)

def wordmark_inner(color, cap=100.0):
    s = cap / CAP
    paths = "".join(f'<path d="{d}" fill="{color}"/>' for _, d, _, _ in GLYPHS)
    return f'<g transform="scale({s:.6f}) translate(0,{CAP})">{paths}</g>', W_WORD * s

# ---------------------------------------------------------------- lockups
def lockup(mark_color, word_color, cap=100.0, gap_ratio=0.52, stacked=False, bg=None):
    mh = cap * (MK["h"] / CAP) * (CAP / CAP)      # mark drawn at cap height
    mark_h = cap
    mark_w = mark_h * MK["w"] / MK["h"]
    g = mark_group().replace('fill="#000000"', f'fill="{mark_color}"')
    mscale = mark_h / MK["h"]
    minner = (f'<g transform="translate({-MK["x"]*mscale:.3f},{-MK["y"]*mscale:.3f}) '
              f'scale({mscale:.6f})">{g}</g>')
    winner, ww = wordmark_inner(word_color, cap)
    gap = cap * gap_ratio
    if stacked:
        W = max(mark_w, ww)
        H = mark_h + gap + cap
        inner = (f'<g transform="translate({(W-mark_w)/2:.2f},0)">{minner}</g>'
                 f'<g transform="translate({(W-ww)/2:.2f},{mark_h+gap:.2f})">{winner}</g>')
    else:
        W = mark_w + gap + ww
        H = max(mark_h, cap)
        inner = (f'<g transform="translate(0,{(H-mark_h)/2:.2f})">{minner}</g>'
                 f'<g transform="translate({mark_w+gap:.2f},{(H-cap)/2:.2f})">{winner}</g>')
    return svg_wrap(inner, W, H, bg), W, H

# ---------------------------------------------------------------- write assets
made = []
def put(name, text):
    p = os.path.join(OUT, name)
    open(p, "w", encoding="utf-8").write(text)
    made.append(p)
    return p

D, L = PAL["dark"], PAL["light"]

put("mark-dark.svg",  mark_svg(D["accent"]))
put("mark-light.svg", mark_svg(L["accent"]))
put("mark-mono-cream.svg", mark_svg(D["ink"]))
put("mark-mono-ink.svg",   mark_svg(L["ink"]))

put("monad-lockup-horizontal-dark.svg",
    lockup(D["accent"], D["ink"])[0])
put("monad-lockup-horizontal-light.svg",
    lockup(L["accent"], L["ink"])[0])
put("monad-lockup-horizontal-mono-cream.svg", lockup(D["ink"], D["ink"], bg=D["bg"])[0])
put("monad-lockup-horizontal-mono-ink.svg",   lockup(L["ink"], L["ink"], bg=L["bg"])[0])
put("monad-lockup-compact-dark.svg",  lockup(D["accent"], D["ink"], stacked=True)[0])
put("monad-lockup-compact-light.svg", lockup(L["accent"], L["ink"], stacked=True)[0])
put("monad-wordmark-dark.svg",  wordmark_svg(D["ink"]))
put("monad-wordmark-light.svg", wordmark_svg(L["ink"]))
put("monad-mark-dark-bg.svg",  mark_svg(D["accent"], pad=8))

# ---------------------------------------------------------------- tokens
tokens = {
    "meta": {"product": "MONAD", "scope": "standalone product identity", "phase": "1.1",
             "version": "1.0.0", "locked": "2026-11-05",
             "source": "brand v4 traced mark + Inter outlines", "colourSpace": "sRGB"},
    "color": {"dark": D, "light": L},
    "type": {
        "family": {"fa": "Vazirmatn", "en": "Inter"},
        "scale": {"caption": 12, "body": 14, "lead": 16, "title": 20, "display": 28},
        "weight": {"regular": 400, "medium": 500, "semibold": 600, "bold": 700},
        "numeral": "tabular-nums", "lineHeight": {"tight": 1.25, "base": 1.6, "loose": 1.8},
    },
    "space": [4, 8, 12, 16, 24, 32, 48, 64],
    "radius": {"control": 12, "card": 16, "sheet": 20, "modal": 24, "pill": 999},
    "motion": {"micro": 160, "transition": 220, "sheet": 280,
               "easing": "cubic-bezier(.2,.8,.2,1)", "respectReducedMotion": True},
    "elevation": {"none": "none", "hairline": "0 0 0 1px rgba(237,228,212,.10)"},
}
put("tokens.json", json.dumps(tokens, ensure_ascii=False, indent=2))

css = ["/* MONAD tokens 1.0.0 — authoritative */", ":root {"]
for k, v in D.items():
    css.append(f"  --m-{k}: {v};")
css += ["}", '[data-theme="light"] {']
for k, v in L.items():
    css.append(f"  --m-{k}: {v};")
css += ["}", ":root {",
        "  --m-font-fa: 'Vazirmatn', system-ui, sans-serif;",
        "  --m-font-en: 'Inter', system-ui, sans-serif;",
        "  --m-tabular: tabular-nums;"]
for name, val in tokens["type"]["scale"].items():
    css.append(f"  --m-text-{name}: {val}px;")
for name, val in tokens["radius"].items():
    css.append(f"  --m-radius-{name}: {val}px;")
for name, val in tokens["motion"].items():
    if isinstance(val, int):
        css.append(f"  --m-dur-{name}: {val}ms;")
css.append(f"  --m-ease: {tokens['motion']['easing']};")
css.append("}")
put("tokens.css", "\n".join(css) + "\n")

print("assets written:", len(made))
for m in made:
    print("  ", os.path.basename(m), os.path.getsize(m), "B")
