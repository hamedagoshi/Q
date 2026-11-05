#!/usr/bin/env python3
"""Serve the design system, run browser acceptance tests, capture screenshots."""
import subprocess, time, os, re, json, socket, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DS   = os.path.dirname(HERE)
PORT = 8099
CH   = "chromium"

def up():
    s = socket.socket(); s.settimeout(0.4)
    try: s.connect(("127.0.0.1", PORT)); return True
    except OSError: return False
    finally: s.close()

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                       cwd=DS, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    if up(): break
    time.sleep(0.1)

def dump(path, w, h):
    r = subprocess.run([CH, "--headless=new", "--no-sandbox", "--disable-gpu",
                        f"--window-size={w},{h}", "--force-device-scale-factor=1", "--virtual-time-budget=2500",
                        "--hide-scrollbars", "--dump-dom",
                        f"http://127.0.0.1:{PORT}/{path}"],
                       capture_output=True, text=True, timeout=90)
    return r.stdout

def shot(path, out, w, h, dsf=2):
    subprocess.run([CH, "--headless=new", "--no-sandbox", "--disable-gpu",
                    f"--window-size={w},{h}", f"--force-device-scale-factor={dsf}",
                    "--virtual-time-budget=2500", "--hide-scrollbars",
                    f"--screenshot={out}", f"http://127.0.0.1:{PORT}/{path}"],
                   capture_output=True, timeout=90)

WIDTHS = [(360, 640), (390, 844), (412, 915), (768, 1024), (1280, 900)]
results = {}
for w, h in WIDTHS:
    dom = dump("tests.html", w, h)
    m = re.search(r'TOTAL (\d+)/(\d+)', dom)
    fails = re.findall(r'FAIL  ([^<\n]+)', dom)
    name = f"{w}x{h}"
    results[name] = {"passed": int(m.group(1)) if m else 0,
                     "total": int(m.group(2)) if m else 0, "fails": fails}
    print(f"{name}: {results[name]['passed']}/{results[name]['total']}  {('FAILS: ' + '; '.join(fails)) if fails else ''}")

os.makedirs(os.path.join(DS, "preview"), exist_ok=True)
shots = [("index.html?theme=dark&dir=rtl",  "lab-dark-rtl-mobile.png",  390, 1600),
         ("index.html?theme=light&dir=rtl", "lab-light-rtl-mobile.png", 390, 1600),
         ("index.html?theme=dark&dir=ltr",  "lab-dark-ltr-desktop.png", 1280, 1500),
         ("index.html?theme=light&dir=ltr", "lab-light-ltr-desktop.png",1280, 1500)]
for path, out, w, h in shots:
    shot(path, os.path.join(DS, "preview", out), w, h, dsf=2 if w < 600 else 1)
    print("shot:", out)

json.dump(results, open(os.path.join(DS, "test-results.json"), "w"), indent=1)
srv.terminate()
