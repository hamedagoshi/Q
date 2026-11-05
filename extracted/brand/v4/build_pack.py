#!/usr/bin/env python3
"""MONAD / MonadWave brand pack v4 - built from the OWNER'S ACTUAL LOGO.
Colour-separate the uploaded JPEG -> potrace vectors -> recolor per theme -> rasterize."""
import os, re, json, subprocess, shutil

V4 = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(V4, "src")
OUT = os.path.join(V4, "out")
os.makedirs(OUT, exist_ok=True)

# ---- palette (theme) -------------------------------------------------------
T = {
    "dark":  {"bg": "#17181A", "surface": "#1E1F22", "ink": "#EDE4D4", "muted": "#A29682",
              "accent": "#C8832A", "accent2": "#E0A24B", "name": "charcoal"},
    "light": {"bg": "#F5F1E8", "surface": "#FFFFFF", "ink": "#1A1917", "muted": "#6F6656",
              "accent": "#A9661E", "accent2": "#C8832A", "name": "paper"},
}

def grab(path):
    """pull the <g>...</g> body and viewBox out of a potrace svg"""
    s = open(path, encoding="utf-8").read()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    body = "".join(re.findall(r"<path[^>]*/>", s, re.S))
    return vb, body

def lockup_svg(letter_fill, word_fill, w=2160, h=880):
    _, letters = grab(os.path.join(SRC, "letters.svg"))
    _, word = grab(os.path.join(SRC, "word.svg"))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 220" width="{w}" height="{h}">
<g transform="translate(0,220) scale(0.1,-0.1)" fill="{letter_fill}">{letters}</g>
<g transform="translate(0,220) scale(0.1,-0.1)" fill="{word_fill}">{word}</g>
</svg>'''

def mark_svg(fill, w=160, h=160):
    s = open(os.path.join(SRC, "mark.svg"), encoding="utf-8").read()
    body = "".join(re.findall(r"<path[^>]*/>", s, re.S))
    # mark lives at x 211..317, y 18..125 inside the 540x220 canvas
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="205 12 118 118" width="{w}" height="{h}">
<g transform="translate(0,220) scale(0.1,-0.1)" fill="{fill}">{body}</g>
</svg>'''

def write(name, content):
    p = os.path.join(OUT, name)
    open(p, "w", encoding="utf-8").write(content)
    return p

def render(svg_content, out_png, w, h, bg=None):
    html = f'''<html><body style="margin:0;background:{bg or 'transparent'}">
{svg_content}</body></html>'''
    hp = os.path.join(OUT, "_tmp.html")
    open(hp, "w", encoding="utf-8").write(html)
    cmd = ["chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
           f"--window-size={w},{h}", "--hide-scrollbars",
           "--default-background-color=00000000",
           f"--screenshot={out_png}", "file://" + hp]
    subprocess.run(cmd, capture_output=True, timeout=120)

# ---- assets ---------------------------------------------------------------
variants = {
    "lockup-amber-cream": (T["dark"]["accent"], T["dark"]["ink"]),
    "lockup-cream":       (T["dark"]["ink"],    T["dark"]["muted"]),
    "lockup-mono-black":  ("#000000",           "#000000"),
    "lockup-light":       (T["light"]["accent"],T["light"]["ink"]),
}
made = []
for name, (lf, wf) in variants.items():
    svg = lockup_svg(lf, wf)
    write(name + ".svg", svg)
    render(svg, os.path.join(OUT, name + "@2x.png"), 2160, 880)
    made.append(name)

for name, fill in (("mark-amber", T["dark"]["accent"]), ("mark-cream", T["dark"]["ink"]),
                   ("mark-light", T["light"]["accent"]), ("mark-black", "#000000")):
    svg = mark_svg(fill)
    write(name + ".svg", svg)
    render(svg, os.path.join(OUT, name + "@512.png"), 512, 512)
    made.append(name)

# ---- app icons: amber mark on charcoal plate ------------------------------
for size in (192, 512):
    svg = mark_svg(T["dark"]["accent"], size, size)
    render(svg, os.path.join(OUT, f"icon-{size}.png"), size, size, bg=T["dark"]["bg"])
    inner = int(size * 0.62)
    svg_m = mark_svg(T["dark"]["accent"], inner, inner)
    html = f'''<html><body style="margin:0;background:{T["dark"]["bg"]};display:flex;align-items:center;justify-content:center;width:{size}px;height:{size}px">{svg_m}</body></html>'''
    hp = os.path.join(OUT, f"_icon{size}.html")
    open(hp, "w", encoding="utf-8").write(html)
    subprocess.run(["chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
                    f"--window-size={size},{size}", "--hide-scrollbars",
                    f"--screenshot={os.path.join(OUT, f'icon-{size}-maskable.png')}",
                    "file://" + hp], capture_output=True, timeout=120)

json.dump({"palette": T, "variants": made}, open(os.path.join(OUT, "pack.json"), "w"), indent=1)
print("pack built:", sorted(os.listdir(OUT)))
