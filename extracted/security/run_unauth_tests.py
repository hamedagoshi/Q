#!/usr/bin/env python3
"""Phase 1.4 — unauthenticated / invalid-session security tests against the deployed function.
Every test records HTTP status and the returned body. No credentials are stored."""
import json, subprocess, time, os

URL = "https://monad-6c675961.base44.app/functions/monadProfile"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results-unauthenticated.json")

def call(name, method="POST", body=None, headers=None):
    cmd = ["curl", "-s", "-o", "/tmp/body.json", "-w", "%{http_code}", "-X", method, URL,
           "-H", "Content-Type: application/json"]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    t0 = time.time()
    status = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout.strip()
    ms = int((time.time() - t0) * 1000)
    try:
        payload = json.load(open("/tmp/body.json"))
    except Exception:
        payload = open("/tmp/body.json").read()[:200]
    return {"test": name, "http": int(status or 0), "ms": ms, "body": payload}

# an "expired" JWT: valid shape, exp far in the past, signature garbage
EXPIRED = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
           "eyJzdWIiOiJub2JvZHkiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0."
           "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")

tests = [
    call("unauthenticated profile read", body={"action": "get"}),
    call("unauthenticated profile update", body={"action": "update", "patch": {"display_name": "x"}}),
    call("unauthenticated profile delete", body={"action": "delete"}),
    call("invalid session (garbage bearer)", body={"action": "get"}, headers={"Authorization": "Bearer not-a-token"}),
    call("expired session (exp in the past)", body={"action": "get"}, headers={"Authorization": f"Bearer {EXPIRED}"}),
    call("forged bearer with foreign subject", body={"action": "bootstrap"}, headers={"Authorization": f"Bearer {EXPIRED}"}),
    call("wrong method GET", method="GET"),
    call("CORS preflight OPTIONS", method="OPTIONS"),
]

json.dump({"target": URL, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tests": tests},
          open(OUT, "w"), indent=1)

for t in tests:
    print(f'{t["http"]:>3}  {t["test"]:<38} {json.dumps(t["body"])[:90]}')
print("\nsaved:", OUT)
