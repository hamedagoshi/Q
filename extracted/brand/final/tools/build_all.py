#!/usr/bin/env python3
"""MONAD Phase 1.1 final build: identity, icons, contrast audit, brand sheet."""
import os, sys, json, subprocess, tempfile, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import numpy as np
from mark_geo import to_svg, W as MW, H as MH
from wordmark import glyph_paths

HERE=os.path.dirname(os.path.abspath(__file__)); FINAL=os.path.dirname(HERE)
A=os.path.join(FINAL,"assets"); R=os.path.join(FINAL,"raster")
os.makedirs(A,exist_ok=True); os.makedirs(R,exist_ok=True)

D={"bg":"#17181A","surface":"#1E1F22","surface2":"#26282C","ink":"#EDE4D4","muted":"#A29682",
   "accent":"#C8832A","accentStrong":"#E0A24B"}
L={"bg":"#F5F1E8","surface":"#FFFFFF","surface2":"#EDE7DA","ink":"#1A1917","muted":"#6F6656",
   "accent":"#A9661E","accentStrong":"#C8832A"}

# ---------- wordmark ----------
G,W_WORD,CAP,UPM=glyph_paths()
def word_inner(color,cap=100.0):
    s=cap/CAP
    paths="".join(f'<path d="{d}" fill="{color}"/>' for _,d,_,_ in G)
    return f'<g transform="scale({s:.6f}) translate(0,{CAP})">{paths}</g>', W_WORD*s

def svg(w,h,inner,bg=None):
    r=f'<rect width="{w:.2f}" height="{h:.2f}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
            f'width="{w:.2f}" height="{h:.2f}">{r}{inner}</svg>')

def mark_inner(color,cap=100.0,pad=0.0):
    s=cap/MH
    body=to_svg(color,pad=pad).split(">",1)[1].rsplit("</svg>",1)[0]
    return f'<g transform="scale({s:.6f})">{body}</g>', MW*s, cap

def lockup(mark_c, word_c, cap=100.0, stacked=False, bg=None, gap=0.46):
    mi, mw, mh = mark_inner(mark_c, cap)
    wi, ww = word_inner(word_c, cap)
    g = cap*gap
    if stacked:
        w=max(mw,ww); h=mh+g+cap
        inner=(f'<g transform="translate({(w-mw)/2:.2f},0)">{mi}</g>'
               f'<g transform="translate({(w-ww)/2:.2f},{mh+g:.2f})">{wi}</g>')
    else:
        w=mw+g+ww; h=max(mh,cap)
        inner=(f'<g transform="translate(0,{(h-mh)/2:.2f})">{mi}</g>'
               f'<g transform="translate({mw+g:.2f},{(h-cap)/2:.2f})">{wi}</g>')
    return svg(w,h,inner,bg), w, h

def shot(html_or_svg, out, w, h, bg="00000000", dsf=2):
    html=('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;'
          f'background:transparent}}svg{{display:block}}</style>'+html_or_svg)
    f=tempfile.NamedTemporaryFile("w",suffix=".html",delete=False); f.write(html); f.close()
    subprocess.run(["chromium","--headless=new","--no-sandbox","--disable-gpu",
                    f"--window-size={w},{h}",f"--force-device-scale-factor={dsf}",
                    f"--default-background-color={bg}","--hide-scrollbars",
                    f"--screenshot={out}",f"file://{f.name}"],capture_output=True,timeout=90)
    os.unlink(f.name)

def put(name,text):
    p=os.path.join(A,name); open(p,"w",encoding="utf-8").write(text); return p

# ---------- svg set ----------
put("mark-dark.svg",  to_svg(D["accent"]))
put("mark-light.svg", to_svg(L["accent"]))
put("mark-mono-cream.svg", to_svg(D["ink"]))
put("mark-mono-ink.svg",   to_svg(L["ink"]))

for nm,(mc,wc,bg) in {
  "monad-lockup-horizontal-dark.svg":  (D["accent"],D["ink"],None),
  "monad-lockup-horizontal-light.svg": (L["accent"],L["ink"],None),
  "monad-lockup-horizontal-mono-cream.svg": (D["ink"],D["ink"],D["bg"]),
  "monad-lockup-horizontal-mono-ink.svg":   (L["ink"],L["ink"],L["bg"]),
}.items():
    s,_,_ = lockup(mc,wc,bg=bg); put(nm,s)

for nm,(mc,wc,bg) in {
  "monad-lockup-compact-dark.svg": (D["accent"],D["ink"],None),
  "monad-lockup-compact-light.svg":(L["accent"],L["ink"],None),
}.items():
    s,_,_ = lockup(mc,wc,stacked=True,bg=bg); put(nm,s)

put("monad-wordmark-dark.svg",  svg(*[f(x) for x in (0,0)][:2] if False else (0,0),"") ) if False else None
wi,ww=word_inner(D["ink"]); put("monad-wordmark-dark.svg", svg(ww,100,wi))
wi,ww=word_inner(L["ink"]); put("monad-wordmark-light.svg", svg(ww,100,wi))

# ---------- raster ----------
JOBS=[("monad-lockup-horizontal-dark.svg","lockup-horizontal-dark.png",760,120,None),
      ("monad-lockup-horizontal-light.svg","lockup-horizontal-light.png",760,120,None),
      ("monad-lockup-compact-dark.svg","lockup-compact-dark.png",260,300,None),
      ("monad-wordmark-dark.svg","wordmark-dark.png",600,110,None)]
for src,out,w,h,_ in JOBS:
    s=open(os.path.join(A,src),encoding="utf-8").read()
    shot(s.replace("<svg ",f"<svg style='width:{w}px;height:{h}px' ",1),
         os.path.join(R,out), w, h)

# mark raster (square)
mk_svg=open(os.path.join(A,"mark-dark.svg"),encoding="utf-8").read()
shot(mk_svg.replace("<svg ",f"<svg style='width:512px;height:438px' ",1),
     os.path.join(R,"mark-dark@512.png"),512,438)
mk=Image.open(os.path.join(R,"mark-dark@512.png")).convert("RGBA")
arr=np.asarray(mk); ys,xs=np.where(arr[:,:,3]>40)
mk=mk.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)); mk.save("/tmp/mark_final.png")

def plate(size):
    top,bot=np.array([30,31,34]),np.array([23,24,26])
    col=np.array([(top*(1-y/(size-1))+bot*(y/(size-1))) for y in range(size)]).astype(np.uint8)
    return Image.fromarray(col.reshape(size,1,3)).resize((size,size)).convert("RGBA")
def icon(size,ratio,out):
    base=plate(size); w=int(size*ratio); h=int(w*mk.height/mk.width)
    base.alpha_composite(mk.resize((w,h),Image.LANCZOS),((size-w)//2,(size-h)//2))
    base.convert("RGB").save(out); return out
for s,r_ ,sfx in ((512,0.74,""),(192,0.74,""),(512,0.54,"-maskable"),(192,0.54,"-maskable")):
    icon(s,r_,os.path.join(R,f"icon-{s}{sfx}.png"))
icon(180,0.74,os.path.join(R,"apple-touch-icon-180.png"))
icon(128,0.82,"/tmp/fav128.png")
Image.open("/tmp/fav128.png").convert("RGBA").save(os.path.join(A,"favicon.ico"),
        sizes=[(16,16),(32,32),(48,48),(64,64)])

# ---------- contrast audit (WCAG 2.1) ----------
def lum(h):
    h=h.lstrip("#"); rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    r,g,b=[f(c) for c in rgb]; return 0.2126*r+0.7152*g+0.0722*b
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)

PAIRS=[("dark ink/surface","#EDE4D4","#1E1F22"),("dark ink/bg","#EDE4D4","#17181A"),
       ("dark muted/surface","#A29682","#1E1F22"),("dark muted/bg","#A29682","#17181A"),
       ("dark accent/bg","#C8832A","#17181A"),("dark accent/surface","#C8832A","#1E1F22"),
       ("dark accentStrong/bg","#E0A24B","#17181A"),
       ("light ink/surface","#1A1917","#FFFFFF"),("light ink/bg","#1A1917","#F5F1E8"),
       ("light muted/surface","#6F6656","#FFFFFF"),("light muted/bg","#6F6656","#F5F1E8"),
       ("light accent/surface","#A9661E","#FFFFFF"),("light accent/bg","#A9661E","#F5F1E8"),
       ("light accentStrong/surface","#C8832A","#FFFFFF")]
audit=[]
for name,fg,bg in PAIRS:
    r=ratio(fg,bg)
    audit.append({"pair":name,"ratio":round(r,2),
                  "AA_small": r>=4.5, "AA_large": r>=3.0, "AAA_small": r>=7.0})
    print(f"{name:28s} {r:5.2f}  AA-small {'PASS' if r>=4.5 else 'FAIL'}")
json.dump(audit,open(os.path.join(FINAL,"contrast-audit.json"),"w"),indent=1)
print("build_all done")
