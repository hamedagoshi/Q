#!/usr/bin/env python3
"""Static server with SPA fallback so /journal, /settings … resolve to index.html.
Production must configure the same fallback (PWA/TWA requirement: stable URLs)."""
import http.server, socketserver, os, sys, posixpath

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(ROOT)          # serve from MONAD/ so ../brand and ../design-system resolve
APP_PREFIX = '/app'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SITE, **kw)

    def translate_path(self, path):
        # map "/" and app routes to /app/index.html; keep real files as-is
        clean = path.split('?', 1)[0].split('#', 1)[0]
        if clean in ('/', ''):
            return os.path.join(SITE, 'app', 'index.html')
        fs = super().translate_path(path)
        if os.path.isdir(fs):
            return fs
        if not os.path.exists(fs) and '.' not in posixpath.basename(clean):
            return os.path.join(SITE, 'app', 'index.html')
        return fs

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {SITE} on http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()
