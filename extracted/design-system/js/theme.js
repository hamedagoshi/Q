/* MONAD — theme controller: dark | light | system (system follows the OS) */
(function () {
  const KEY = 'monad-theme';
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  let mode = localStorage.getItem(KEY) || 'system';

  function resolve(m) {
    if (m === 'system') return mq.matches ? 'light' : 'dark';
    return m;
  }
  function apply() {
    const resolved = resolve(mode);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.style.colorScheme = resolved;
    document.querySelectorAll('[data-theme-mode-btn]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.themeModeBtn === mode));
    });
    document.dispatchEvent(new CustomEvent('monad:theme', { detail: { mode, resolved } }));
  }
  function set(m) { mode = m; localStorage.setItem(KEY, m); apply(); }

  // live OS changes (only matters in system mode)
  const onChange = () => { if (mode === 'system') apply(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);

  window.MonadTheme = { set, get mode() { return mode; }, get resolved() { return resolve(mode); } };
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-mode-btn]').forEach(b =>
      b.addEventListener('click', () => set(b.dataset.themeModeBtn)));
  });
  window.MonadThemeEmulate = { mq, onChange };
})();
