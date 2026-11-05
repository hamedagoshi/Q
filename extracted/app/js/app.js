import { createRouter } from './router.js';
import { createAuth } from './auth.js';
import { ProfileApi } from './api.js';
import home from './pages/home.js';
import journal from './pages/journal.js';
import trading from './pages/trading.js';
import tradeDetail from './pages/trade.js';
import timeline from './pages/timeline.js';
import calendar from './pages/calendar.js';
import insights from './pages/insights.js';
import settings from './pages/settings.js';
import day from './pages/day.js';
import notfound from './pages/notfound.js';
import { authPage } from './pages/auth.js';

const trace = [];
const T = (m) => { trace.push(m); window.__monadTrace = trace; };
const auth = createAuth();
const state = { session: null, profile: null, lang: 'fa', loading: true };
const view = () => document.getElementById('view');

/* ---------- shell ---------- */
const NAV = [
  { path: '/', fa: 'امروز', en: 'Today', icon: 'M12 5a7 7 0 100 14 7 7 0 000-14z' },
  { path: '/journal', fa: 'ژورنال', en: 'Journal', icon: 'M6 4h11a2 2 0 012 2v14H6z' },
  { path: '/timeline', fa: 'خط', en: 'Timeline', icon: 'M4 8h16M4 16h16' },
  { path: '/settings', fa: 'تنظیمات', en: 'Settings', icon: 'M12 9a3 3 0 100 6 3 3 0 000-6z' },
];

function shellHtml() {
  const t = (fa, en) => (state.lang === 'en' ? en : fa);
  return `
  <a class="skip" href="#view">${t('پرش به محتوا', 'Skip to content')}</a>
  <header class="topbar app-topbar">
    <a href="/" data-link class="app-brand" aria-label="MONAD">
      <img id="app-lockup" src="/brand/final/raster/lockup-horizontal-dark.png" alt="MONAD" height="26">
    </a>
    <span class="topbar__spacer"></span>
    <span class="badge num" id="app-state">…</span>
  </header>
  <main id="view" class="page-container" tabindex="-1"></main>
  <nav class="bottom-nav" id="app-nav" aria-label="${t('ناوبری اصلی', 'Primary')}">
    ${NAV.map((n) => `<a class="nav-item" href="${n.path}" data-link data-nav="${n.path}">
      <svg class="icon" viewBox="0 0 24 24"><path d="${n.icon}"/></svg>${t(n.fa, n.en)}</a>`).join('')}
  </nav>`;
}

function paintNav(path) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const target = a.getAttribute('data-nav');
    const active = target === '/' ? path === '/' : path.startsWith(target);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function applyLang() {
  if (state.profile?.language) state.langOverride = null;
  if (!state.langOverride) {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q === 'fa' || q === 'en') state.langOverride = q;
    } catch (_) { /* noop */ }
  }
  const lang = state.profile?.language || state.langOverride || 'fa';
  state.lang = lang;
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
}

function paintChrome() {
  paintNav(location.pathname.replace(/\/+$/, '') || '/');
  const el = document.getElementById('app-state');
  if (el) el.textContent = state.session ? (state.profile?.theme || 'system') : (state.lang === 'en' ? 'signed out' : 'خارج از حساب');
  const img = document.getElementById('app-lockup');
  if (img) {
    const light = document.documentElement.dataset.theme === 'light';
    img.src = `/brand/final/raster/lockup-horizontal-${light ? 'light' : 'dark'}.png`;
  }
  const nav = document.getElementById('app-nav');
  if (nav) nav.hidden = !state.session;
}

/* ---------- routes ---------- */
const requireAuth = async (path) => {
  const s = await auth.getSession();
  if (!s?.user) { router.replace(`/login?next=${encodeURIComponent(path)}`); return false; }
  state.session = s;
  return true;
};
const guestOnly = async () => {
  const s = await auth.getSession();
  if (s?.user) { router.replace('/'); return false; }
  return true;
};

function pageCtx(extra = {}) {
  return { profile: state.profile, lang: state.lang, auth, navigate: router.navigate,
           onProfile: (p) => { state.profile = p; ctxLang(p); }, ...extra };
}
function ctxLang(p) {
  if (p?.language) { state.lang = p.language; applyLang(); }
  if (p?.theme && window.MonadTheme) window.MonadTheme.set(p.theme);
}

const routes = [
  { path: '/login', guard: guestOnly, render: ({ query }) => mount(authPage('login', { auth, navigate: router.navigate, lang: state.lang, next: query.get('next') || '/' })) },
  { path: '/signup', guard: guestOnly, render: ({ query }) => mount(authPage('signup', { auth, navigate: router.navigate, lang: state.lang, next: query.get('next') || '/' })) },
  { path: '/', guard: requireAuth, render: () => mount(home) },
  { path: '/journal', guard: requireAuth, render: () => mount(journal) },
  { path: '/day/:date', guard: requireAuth, render: ({ params }) => mount({
      title: 'Day',
      html: (c) => day.html({ ...c, params }),
      after: (root, c) => day.after(root, { ...c, params }),
    }) },
  { path: '/trading', guard: requireAuth, render: () => mount(trading) },
  { path: '/trading/:id', guard: requireAuth, render: ({ params }) => mount({
      title: 'Trade',
      html: (c) => tradeDetail.html({ ...c, params }),
      after: (root, c) => tradeDetail.after(root, { ...c, params }),
    }) },
  { path: '/timeline', guard: requireAuth, render: () => mount(timeline) },
  { path: '/calendar', guard: requireAuth, render: () => mount(calendar) },
  { path: '/insights', guard: requireAuth, render: () => mount(insights) },
  { path: '/settings', guard: requireAuth, render: () => mount(settings) },
];

/* ---------- mount ---------- */
let activePage = null;
function mount(page) {
  activePage = page;
  const el = view();
  el.innerHTML = page.html(pageCtx());
  if (page.after) page.after(el, pageCtx());
  paintChrome();
  document.title = `${page.title || 'MONAD'} · MONAD`;
}

const router = createRouter({
  routes,
  notFound: (path) => { mount({ ...notfound, html: () => notfound.html({ path }) }); },
  onNavigate: (path) => paintNav(path),
});

/* ---------- boot ---------- */
async function boot() {
  T('boot:start');
  const el = view();
  el.innerHTML = `<div class="stack"><div class="skeleton skeleton--title"></div>
    <div class="skeleton skeleton--text"></div><div class="skeleton skeleton--text" style="width:70%"></div></div>`;

  state.session = await auth.getSession({ force: true });
  T('session:' + (state.session ? 'yes' : 'no'));
  if (state.session?.user) {
    try {
      const { profile } = await ProfileApi.bootstrap();
      state.profile = profile;
      ctxLang(profile);
    } catch (e) {
      if (e.code === 'unauthenticated') { state.session = null; await auth.signOut(); }
      else console.warn('[monad] profile bootstrap failed:', e.code);
    }
  }
  window.MonadTheme?.set(state.profile?.theme || localStorage.getItem('monad-theme') || 'system');
  applyLang();
  paintChrome();
  T('start');
  await router.start();
  T('started:' + location.pathname);
}

window.addEventListener('error', (e) => T('error:' + e.message));
window.addEventListener('unhandledrejection', (e) => T('reject:' + (e.reason && e.reason.message)));

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', shellHtml());
  boot();
});
