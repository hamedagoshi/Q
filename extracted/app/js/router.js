/* MONAD — history router with guards, 404 and stable URLs */
export function createRouter({ routes, notFound, onNavigate }) {
  let current = null;

  const match = (path) => routes.find((r) => r.path === path) || null;

  /* '/day/:date' style patterns */
  function matchPattern(path) {
    const segs = path.split('/').filter(Boolean);
    for (const r of routes) {
      if (!r.path.includes(':')) continue;
      const ps = r.path.split('/').filter(Boolean);
      if (ps.length !== segs.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < ps.length; i += 1) {
        if (ps[i].startsWith(':')) params[ps[i].slice(1)] = decodeURIComponent(segs[i]);
        else if (ps[i] !== segs[i]) { ok = false; break; }
      }
      if (ok) return { route: r, params };
    }
    return null;
  }

  function resolve() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const route = match(path);
    return { route, path };
  }

  async function render() {
    const { route, path } = resolve();
    current = { route, path };
    if (!route) {
      const hit = matchPattern(path);
      if (!hit) return notFound(path);
      if (hit.route.guard && (await hit.route.guard(path)) === false) return;
      hit.route.render({ path, params: hit.params, query: new URLSearchParams(location.search) });
      if (onNavigate) onNavigate(path);
      window.scrollTo(0, 0);
      return;
    }
    if (route.guard) {
      // guards are async: ownership of rendering belongs to the guard result
      const allowed = await route.guard(path);
      if (allowed === false) return;
    }
    route.render({ path, query: new URLSearchParams(location.search) });
    if (onNavigate) onNavigate(path);
    window.scrollTo(0, 0);
  }

  function navigate(path, { replace = false, keepScroll = false } = {}) {
    const url = new URL(path, location.origin);
    if (url.pathname === location.pathname && url.search === location.search) {
      return render();
    }
    if (replace) history.replaceState({ path }, '', url);
    else history.pushState({ path }, '', url);
    render();
    if (!keepScroll) window.scrollTo(0, 0);
  }

  function redirect(path, { replace = true } = {}) {
    navigate(path, { replace });
  }

  function start() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-link]');
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      e.preventDefault();
      navigate(a.getAttribute('href'));
    });
    window.addEventListener('popstate', render);
    render();
  }

  return { start, navigate, replace: redirect, render, get current() { return current; } };
}
