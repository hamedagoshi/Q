#!/usr/bin/env python3
"""Add accessible text variants, re-audit, render the brand sheet, write manifest."""
import os, json, subprocess, tempfile, hashlib, sys
from PIL import Image

HERE=os.path.dirname(os.path.abspath(__file__)); FINAL=os.path.dirname(HERE)
A=os.path.join(FINAL,"assets"); R=os.path.join(FINAL,"raster")

tokens=json.load(open(os.path.join(A,"tokens.json")))
# accessible text-safe accent variants (small text must reach 4.5:1)
tokens["color"]["dark"]["accentText"]="#E0A24B"
tokens["color"]["light"]["accentText"]="#8C5315"
tokens["color"]["light"]["accentStrongText"]="#9A5B18"
tokens["meta"]["accessibility"]={
  "standard":"WCAG 2.1 AA",
  "rule":"accent is a surface/graphic colour; accentText is the only amber approved for small text",
  "minRatioSmallText":4.5}
json.dump(tokens,open(os.path.join(A,"tokens.json"),"w"),ensure_ascii=False,indent=2)

# regenerate tokens.css from the updated json
D,L=tokens["color"]["dark"],tokens["color"]["light"]
css=["/* MONAD tokens 1.0.0 — authoritative (Phase 1.1 lock) */",":root {"]
css+= [f"  --m-{k}: {v};" for k,v in D.items()]
css+=["}","[data-theme=\"light\"] {"]
css+= [f"  --m-{k}: {v};" for k,v in L.items()]
css+=["}",":root {"]
css+= [f"  --m-text-{k}: {v}px;" for k,v in tokens["type"]["scale"].items()]
css+= [f"  --m-radius-{k}: {v}px;" for k,v in tokens["radius"].items()]
css+= [f"  --m-dur-{k}: {v}ms;" for k,v in tokens["motion"].items() if isinstance(v,int)]
css+= ["  --m-ease: cubic-bezier(.2,.8,.2,1);","  --m-font-fa: 'Vazirmatn', system-ui, sans-serif;",
       "  --m-font-en: 'Inter', system-ui, sans-serif;","  --m-tabular: tabular-nums;","}"]
open(os.path.join(A,"tokens.css"),"w").write("\n".join(css)+"\n")

# ---------- contrast re-audit ----------
def lum(h):
    h=h.lstrip("#"); rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    r,g,b=[f(c) for c in rgb]; return 0.2126*r+0.7152*g+0.0722*b
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
pairs=[("dark ink/surface",D["ink"],D["surface"]),("dark ink/bg",D["ink"],D["bg"]),
       ("dark muted/surface",D["muted"],D["surface"]),("dark muted/bg",D["muted"],D["bg"]),
       ("dark accentText/surface",D["accentText"],D["surface"]),("dark accentText/bg",D["accentText"],D["bg"]),
       ("dark accent(graphic)/bg",D["accent"],D["bg"]),
       ("light ink/surface",L["ink"],L["surface"]),("light ink/bg",L["ink"],L["bg"]),
       ("light muted/surface",L["muted"],L["surface"]),("light muted/bg",L["muted"],L["bg"]),
       ("light accentText/surface",L["accentText"],L["surface"]),("light accentText/bg",L["accentText"],L["bg"]),
       ("light accent(graphic)/bg",L["accent"],L["bg"])]
audit=[{"pair":n,"ratio":round(ratio(f,b),2),"AA_small":ratio(f,b)>=4.5} for n,f,b in pairs]
json.dump(audit,open(os.path.join(FINAL,"contrast-audit.json"),"w"),indent=1)
for a in audit: print(f"{a['pair']:28s} {a['ratio']:5.2f} {'PASS' if a['AA_small'] else 'FAIL'}")


# ---------- brand sheet (plain template, no f-string brace traps) ----------
import base64
def b64(p): return "data:image/png;base64,"+base64.b64encode(open(p,"rb").read()).decode()

CSS = """<style>
*{box-sizing:border-box} body{margin:0;background:__BG__;color:__INK__;
font-family:Inter,system-ui,sans-serif;width:1500px}
.wrap{padding:64px 72px}
h1{font-size:15px;letter-spacing:.34em;font-weight:600;color:__ACC__;margin:0 0 10px}
.h{font-size:56px;font-weight:650;letter-spacing:.02em;margin:0 0 10px}
.sub{color:__MUT__;font-size:16px;letter-spacing:.04em}
section{margin-top:56px}
.lab{font-size:11px;letter-spacing:.24em;color:__MUT__;margin-bottom:18px;text-transform:uppercase}
.row{display:flex;gap:20px;flex-wrap:wrap}
.card{background:__SURF__;border:1px solid rgba(237,228,212,.08);border-radius:18px;padding:34px;flex:1;min-width:0}
.card.light{background:__LBG__;border-color:rgba(26,25,23,.08)}
.card.mono{background:__BG__;border:1px solid rgba(237,228,212,.14)}
img{max-width:100%;display:block}
.sw{display:flex;gap:12px;flex-wrap:wrap}
.chip{width:150px;border-radius:14px;overflow:hidden;border:1px solid rgba(237,228,212,.10)}
.chip .c{height:70px}
.chip .n{padding:9px 11px;font-size:10.5px;color:__MUT__;letter-spacing:.06em}
.type{font-size:15px;line-height:2.05}
.aa{font-size:12.5px;color:__MUT__;line-height:1.9}
</style>"""

body = []
body.append('<h1>MONAD</h1><div class="h">Observe. Record. Understand.</div>')
body.append('<div class="sub">Phase 1.1 - final identity lock | tokens 1.0.0</div>')

body.append('<section><div class="lab">01 - primary identity, dark &amp; light</div>')
body.append('<div class="row"><div class="card"><img src="%s"></div></div>' % b64(os.path.join(R,"lockup-horizontal-dark.png")))
body.append('<div class="row" style="margin-top:20px"><div class="card light"><img src="%s"></div></div></section>'
            % b64(os.path.join(R,"lockup-horizontal-light.png")))

body.append('<section><div class="lab">02 - mark, compact lockup, wordmark</div><div class="row">')
body.append('<div class="card mono" style="max-width:250px"><img src="%s"></div>' % b64(os.path.join(R,"mark-dark@512.png")))
body.append('<div class="card" style="max-width:250px"><img src="%s"></div>' % b64(os.path.join(R,"lockup-compact-dark.png")))
body.append('<div class="card" style="flex:1"><img src="%s" style="filter:brightness(0) invert(1) opacity(.92)"></div>'
            % b64(os.path.join(R,"wordmark-dark.png")))
body.append('</div></section>')

chips = "".join('<div class="chip"><div class="c" style="background:%s"></div><div class="n">%s<br>%s</div></div>'
                % (c, n.upper(), c) for n,c in [("bg",D["bg"]),("surface",D["surface"]),("ink",D["ink"]),
                                                ("muted",D["muted"]),("accent",D["accent"]),("accent text",D["accentText"])])
body.append('<section><div class="lab">03 - app icon &amp; palette</div><div class="row">')
body.append('<div style="width:150px"><img src="%s" style="border-radius:34px"></div>' % b64(os.path.join(R,"icon-192.png")))
body.append('<div class="sw" style="flex:1">%s</div></div></section>' % chips)

body.append('<section><div class="lab">04 - type &amp; accessibility</div><div class="row">')
body.append('<div class="card" style="flex:1.2"><div class="type">'
            '<div style="font-size:28px;font-weight:650">Display 28</div>'
            '<div style="font-size:20px;font-weight:600">Title 20</div>'
            '<div>Body 14 - Vazirmatn for Persian, Inter for Latin.</div>'
            '<div style="font-variant-numeric:tabular-nums;color:%s">1,240.50 | +2.14%% | -0.42R</div>'
            '</div></div>' % D["accentText"])
rows = "<br>".join("%s - %.2f:1 %s" % (a["pair"], a["ratio"], "PASS" if a["AA_small"] else "FAIL") for a in audit)
body.append('<div class="card" style="flex:1"><div class="aa">Contrast (WCAG 2.1 AA)<br>%s</div></div>' % rows)
body.append('</div></section>')

css = (CSS.replace("__BG__",D["bg"]).replace("__INK__",D["ink"]).replace("__ACC__",D["accentText"])
          .replace("__MUT__",D["muted"]).replace("__SURF__",D["surface"]).replace("__LBG__",L["bg"]))
html = "<!doctype html><meta charset='utf-8'>" + css + '<div class="wrap">' + "".join(body) + "</div>"
open("/tmp/sheet.html","w",encoding="utf-8").write(html)
subprocess.run(["chromium","--headless=new","--no-sandbox","--hide-scrollbars",
                "--window-size=1500,2150","--screenshot="+os.path.join(FINAL,"MONAD-brand-sheet.png"),
                "file:///tmp/sheet.html"],capture_output=True,timeout=120)
print("sheet bytes:", os.path.getsize(os.path.join(FINAL,"MONAD-brand-sheet.png")))
