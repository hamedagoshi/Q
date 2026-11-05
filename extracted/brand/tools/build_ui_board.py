#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MONAD / MONAD — UI direction boards, rendered with headless Chromium.
Design tokens come from v3/tokens.json (measured from the supplied logo).
Each screen is a real HTML page, not an image mock: what you see is the CSS.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
V3 = os.path.join(BRAND, "v3")
OUT = os.path.join(BRAND, "ui-board")
os.makedirs(OUT, exist_ok=True)

TOK = json.load(open(os.path.join(V3, "tokens.json"), encoding="utf-8"))
D = TOK["color"]["dark"]
L = TOK["color"]["light"]
FONT = os.path.join(BRAND, "fonts")

BASE_CSS = f"""
@font-face {{ font-family:'Vazirmatn'; src:url('file://{FONT}/Vazirmatn-Regular.ttf'); font-weight:400; }}
@font-face {{ font-family:'Vazirmatn'; src:url('file://{FONT}/Vazirmatn-Medium.ttf'); font-weight:500; }}
@font-face {{ font-family:'Vazirmatn'; src:url('file://{FONT}/Vazirmatn-Bold.ttf'); font-weight:700; }}
@font-face {{ font-family:'Inter'; src:url('file://{FONT}/Inter.ttf'); font-weight:100 900; }}
*{{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}}
html,body{{width:390px;height:844px;overflow:hidden}}
body{{
  background:{D['bg']}; color:{D['ink']};
  font-family:'Vazirmatn',system-ui,sans-serif; font-size:15px; line-height:1.6;
}}
[data-theme="light"] body{{background:{L['bg']};color:{L['ink']}}}
.screen{{height:100%;display:flex;flex-direction:column;padding:0 20px}}
.num{{font-family:'Inter';font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}}
.card{{background:{D['surface']};border:1px solid {D['line']};border-radius:14px;padding:16px}}
[data-theme="light"] .card{{background:{L['surface']};border-color:{L['line']}}}
.muted{{color:{D['ink_muted']}}}
[data-theme="light"] .muted{{color:{L['ink_muted']}}}
.hair{{height:1px;background:{D['line']};margin:0}}
.row{{display:flex;align-items:center;justify-content:space-between}}
"""

NAV = f"""
<nav style="margin-top:auto;padding:10px 4px 22px;display:flex;justify-content:space-between;
  border-top:1px solid {D['line']}">
  {{items}}
</nav>"""

def nav_item(label, active=False, icon=""):
    col = D["accent"] if active else D["ink_faint"]
    return f"""<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:64px">
      <div style="width:20px;height:20px;display:grid;place-items:center;color:{col};font-size:13px">{icon}</div>
      <div style="font-size:10px;color:{col};letter-spacing:.02em">{label}</div></div>"""

def screen_today(theme="dark"):
    return f"""<!doctype html><html lang="fa" dir="rtl" data-theme="{theme}"><head><meta charset="utf-8">
<style>{BASE_CSS}</style></head><body>
<div class="screen">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:26px 0 6px">
    <div style="display:flex;align-items:center;gap:10px">
      <svg width="19" height="19" viewBox="0 0 24 24"><g stroke="{D['accent']}" stroke-width="1.1" fill="none">
        <path d="M12 2.5 L2.6 21.5 L21.4 21.5 Z"/><path d="M7.3 12 L16.7 12"/><path d="M4.9 16.7 L19.1 16.7"/>
      </g></svg>
      <span style="font-family:'Inter';font-size:12px;letter-spacing:.22em;color:{D['cream'] if theme=='dark' else L['cream']}">MONADWAVE</span>
    </div>
    <div class="num" style="font-size:11px;color:{D['ink_faint']}">09:41</div>
  </header>

  <div style="padding:18px 0 22px">
    <div class="muted" style="font-size:12px;letter-spacing:.02em">پنجشنبه ۱۵ آبان</div>
    <div style="font-size:30px;font-weight:700;line-height:1.25;margin-top:6px">امروز چه دیدی؟</div>
  </div>

  <div class="card" style="padding:18px">
    <div class="row" style="margin-bottom:14px">
      <div style="font-size:13px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">ثبت صبح</div>
      <div style="font-size:11px;color:{D['accent']};letter-spacing:.02em">ناتمام</div>
    </div>
    <div class="row" style="padding:2px 0">
      <div style="font-size:12.5px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">مشاهده‌های امروز</div>
      <div class="num" style="font-size:13px">۳</div>
    </div>
    <div class="hair" style="margin:10px 0"></div>
    <div class="row" style="padding:2px 0">
      <div style="font-size:12.5px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">رویداد ثبت‌شده</div>
      <div class="num" style="font-size:13px">۱</div>
    </div>
    <div class="hair" style="margin:10px 0"></div>
    <div style="font-size:11.5px;color:{D['ink_faint'] if theme=='dark' else L['ink_faint']};line-height:1.9">
      ثبت اختیاری است؛ چیزی ارزیابی نمی‌شود.</div>
  </div>

  <div style="display:flex;gap:12px;margin-top:12px">
    <div class="card" style="flex:1;padding:14px">
      <div class="num" style="font-size:24px;font-weight:600">۰</div>
      <div class="muted" style="font-size:11px;margin-top:2px">مشاهده</div>
    </div>
    <div class="card" style="flex:1;padding:14px">
      <div class="num" style="font-size:24px;font-weight:600">۰</div>
      <div class="muted" style="font-size:11px;margin-top:2px">رویداد</div>
    </div>
    <div class="card" style="flex:1;padding:14px;border-color:{D['accent_soft'] if theme=='dark' else L['accent_soft']}">
      <div class="num" style="font-size:24px;font-weight:600;color:{D['accent']}">—</div>
      <div class="muted" style="font-size:11px;margin-top:2px">معامله</div>
    </div>
  </div>

  <div style="margin-top:20px">
    <div class="row" style="margin-bottom:10px">
      <div style="font-size:12px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">ادامه بده</div>
    </div>
    <div class="card" style="padding:14px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:14px;font-weight:500">بازتاب شب</div>
        <div class="muted" style="font-size:11px;margin-top:2px">امشب سه دقیقه وقت بگذار</div>
      </div>
      <div style="width:30px;height:30px;border-radius:999px;border:1px solid {D['line_strong']};
        display:grid;place-items:center;color:{D['accent']};font-size:14px">‹</div>
    </div>
  </div>

  {NAV.format(items=''.join([nav_item('امروز',True,'◉'),nav_item('ژورنال',False,'▤'),nav_item('معاملات',False,'◧'),nav_item('خط',False,'≡'),nav_item('تنظیمات',False,'◇')]))}
</div></body></html>"""


def screen_checkin(theme="dark"):
    seg = "".join(f"""<div style="flex:1;height:38px;border-radius:9px;display:grid;place-items:center;
      background:{'' if i!=2 else (D['accent'] if theme=='dark' else L['accent'])};
      color:{D['ink_muted'] if theme=='dark' else L['ink_muted'] if i!=2 else '#16171A'};
      font-family:'Inter';font-size:14px;font-weight:600;
      border:1px solid {D['line'] if i!=2 else 'transparent'}">{i+1}</div>""" for i in range(5))
    chips = "".join(f"""<div style="padding:7px 13px;border-radius:999px;font-size:12px;
      border:1px solid {D['line']};color:{D['ink_muted'] if theme=='dark' else L['ink_muted']};
      {'background:'+D['accent_soft']+';color:'+D['accent']+';border-color:transparent' if c=='آرام' else ''}">{c}</div>"""
      for c in ["آرام","مضطرب","خسته","متمرکز","بی‌تفاوت"])
    types = ''.join(
      f'<span style="padding:7px 13px;border-radius:999px;border:1px solid {D["line_strong"] if theme=="dark" else L["line_strong"]};'
      f'font-size:12px;color:{D["ink"] if theme=="dark" else L["ink"]}">{t}</span>'
      for t in ["خواب","حال","رویداد","بازار","یادداشت"])
    return f"""<!doctype html><html lang="fa" dir="rtl" data-theme="{theme}"><head><meta charset="utf-8">
<style>{BASE_CSS}</style></head><body>
<div class="screen">
  <header style="display:flex;align-items:center;gap:12px;padding:26px 0 10px">
    <div style="font-size:20px;color:{D['ink_faint']}">‹</div>
    <div style="font-size:13px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">ژورنال</div>
    <div style="margin-right:auto" class="num">۱۵ آبان</div>
  </header>

  <div style="font-size:26px;font-weight:700;margin:10px 0 4px">ثبت صبح</div>
  <div class="muted" style="font-size:12px;margin-bottom:22px">۶۰ ثانیه — هرچه خواستی خالی بگذار</div>

  <div class="card" style="padding:18px">
    <div style="font-size:13px;margin-bottom:10px">چه چیزی ثبت می‌کنی؟</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">{types}</div>

    <div style="height:1px;background:{D['line']};margin:18px 0"></div>

    <div style="font-size:13px;margin-bottom:10px">حال</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">{chips}</div>
  </div>

  <div class="card" style="margin-top:12px;padding:16px">
    <div style="font-size:13px;margin-bottom:8px">یک خط برای خودت</div>
    <div style="min-height:64px;font-size:13.5px;color:{D['ink_faint'] if theme=='dark' else L['ink_faint']};line-height:1.9">
      خواب خوبی داشتم، بازار را با آرامش نگاه کردم…</div>
    <div class="hair" style="margin:10px 0 0"></div>
    <div class="row" style="margin-top:10px">
      <div style="font-size:11px;color:{D['ink_faint']}">خواب</div>
      <div class="num" style="font-size:12px;color:{D['ink_muted']}">۶ ساعت</div>
    </div>
  </div>

  <div style="margin-top:auto;padding:16px 0 24px;display:flex;gap:10px">
    <button style="flex:1;height:50px;border-radius:13px;border:1px solid {D['line_strong']};
      background:transparent;color:{D['ink'] if theme=='dark' else L['ink']};font-family:'Vazirmatn';font-size:14px">ذخیره‌ی پیش‌نویس</button>
    <button style="flex:1;height:50px;border-radius:13px;border:none;
      background:{D['accent'] if theme=='dark' else L['accent']};color:#16171A;font-family:'Vazirmatn';font-size:14px;font-weight:600">ثبت</button>
  </div>
</div></body></html>"""


def screen_insights(theme="dark"):
    bars = [(0.42,1),(0.58,2),(0.36,3),(0.72,4),(0.51,5),(0.64,6),(0.83,7),(0.47,8),(0.60,9),(0.70,10),(0.55,11),(0.77,12)]
    w, gap = 12, 6
    total = len(bars)*(w+gap)
    rects = "".join(f"""<rect x="{i*(w+gap)}" y="{100-h*100:.1f}" width="{w}" height="{h*100:.1f}" rx="3"
      fill="{D['accent'] if h>=0.6 else (D['surface_alt'] if theme=='dark' else L['surface_alt'])}"
      opacity="{1 if h>=0.6 else 1}"/>""" for i,(h,_) in enumerate(bars))
    return f"""<!doctype html><html lang="fa" dir="rtl" data-theme="{theme}"><head><meta charset="utf-8">
<style>{BASE_CSS}</style></head><body>
<div class="screen">
  <header style="padding:26px 0 4px" class="row">
    <div style="font-size:13px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">بینش</div>
    <div class="num" style="font-size:11px;color:{D['ink_faint']}">۳۰ روز</div>
  </header>

  <div style="font-size:26px;font-weight:700;margin:8px 0 16px">الگوها، نه قضاوت</div>

  <div class="card" style="padding:16px 14px 10px">
    <div class="row" style="margin-bottom:14px">
      <div style="font-size:12px">روزهای ثبت‌شده</div>
      <div class="num" style="font-size:12px;color:{D['accent'] if theme=='dark' else L['accent']}">۱۲</div>
    </div>
    <svg viewBox="0 0 {total} 100" width="100%" height="92" preserveAspectRatio="none">{rects}</svg>
    <div class="hair" style="margin-top:6px"></div>
    <div class="row" style="margin-top:8px">
      <div style="font-size:10px;color:{D['ink_faint']}">۱ آبان</div>
      <div style="font-size:10px;color:{D['ink_faint']}">۳۰ آبان</div>
    </div>
  </div>

  <div style="margin-top:12px" class="card">
    <div class="row" style="padding:6px 0">
      <div style="font-size:13px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">مشاهده‌های ثبت‌شده</div>
      <div class="num" style="font-size:15px;font-weight:600">۳۸</div>
    </div>
    <div class="hair"></div>
    <div class="row" style="padding:6px 0">
      <div style="font-size:13px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">رویدادهای ثبت‌شده</div>
      <div class="num" style="font-size:15px;font-weight:600">۹</div>
    </div>
    <div class="hair"></div>
    <div class="row" style="padding:6px 0">
      <div style="font-size:13px;color:{D['ink_muted'] if theme=='dark' else L['ink_muted']}">روزهای با ثبت</div>
      <div class="num" style="font-size:15px;font-weight:600">۱۲</div>
    </div>
  </div>

  <div style="margin-top:14px;padding:12px 14px;border-radius:12px;border:1px dashed {D['line_strong']}">
    <div style="font-size:11.5px;color:{D['ink_faint']};line-height:1.9">
      این اعداد فقط توصیف‌اند. هیچ رابطه‌ی علّی از ردیف‌های زمانی استخراج نمی‌شود.</div>
  </div>

  {NAV.format(items=''.join([nav_item('امروز',False,'◉'),nav_item('ژورنال',False,'▤'),nav_item('معاملات',False,'◧'),nav_item('خط',False,'≡'),nav_item('تنظیمات',False,'◇')]))}
</div></body></html>"""


def render(name, html, theme):
    path = os.path.join(OUT, f"{name}-{theme}.html")
    open(path, "w", encoding="utf-8").write(html)
    png = os.path.join(OUT, f"{name}-{theme}.png")
    subprocess.run(["chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
                    f"--screenshot={png}", "--window-size=390,844",
                    "--force-device-scale-factor=2", "--hide-scrollbars",
                    "--default-background-color=00000000",
                    f"file://{path}"], capture_output=True, timeout=120)
    return png if os.path.exists(png) else None


if __name__ == "__main__":
    made = []
    for theme in ("dark", "light"):
        made.append(render("today", screen_today(theme), theme))
        made.append(render("checkin", screen_checkin(theme), theme))
        made.append(render("insights", screen_insights(theme), theme))
    print("\n".join(str(m) for m in made if m))
