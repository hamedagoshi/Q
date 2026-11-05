/* MONAD — behaviour for interactive components (no dependencies) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* direction switch */
  function setDir(dir, lang) {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    $$('[data-dir-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dirBtn === dir)));
    document.dispatchEvent(new CustomEvent('monad:dir', { detail: { dir, lang } }));
  }

  /* toast */
  function toast(message, tone = 'neutral') {
    let stack = $('#toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.id = 'toast-stack'; stack.className = 'toast-stack'; document.body.appendChild(stack); }
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="badge ${tone === 'error' ? 'badge--negative' : 'badge--accent'}">${tone}</span><span>${message}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, 2600);
  }

  /* modal + sheet */
  function openLayer(id) {
    const layer = document.getElementById(id);
    if (!layer) return;
    layer.dataset.open = 'true';
    layer.setAttribute('aria-hidden', 'false');
    const focusable = layer.querySelector('button, [href], input, select, textarea');
    if (focusable) focusable.focus();
    document.addEventListener('keydown', escClose);
  }
  function closeLayer(id) {
    const layer = document.getElementById(id);
    if (!layer) return;
    layer.dataset.open = 'false';
    layer.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', escClose);
  }
  function escClose(e) { if (e.key === 'Escape') $$('[data-open="true"]').forEach(l => closeLayer(l.id)); }

  /* loading demo */
  function toggleLoading(btn) {
    btn.dataset.loading = btn.dataset.loading === 'true' ? 'false' : 'true';
    btn.setAttribute('aria-busy', btn.dataset.loading);
    const label = btn.querySelector('.btn__label');
    if (btn.dataset.loading === 'true') {
      btn.disabled = true;
      if (label) label.dataset.text = label.textContent, label.textContent = 'در حال ذخیره…';
      const sp = document.createElement('span'); sp.className = 'btn__spinner'; btn.prepend(sp);
      setTimeout(() => {
        btn.dataset.loading = 'false'; btn.disabled = false; btn.setAttribute('aria-busy', 'false');
        sp.remove(); if (label) label.textContent = label.dataset.text;
      }, 1400);
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-layer]');
    if (t) { openLayer(t.dataset.openLayer); return; }
    const c = e.target.closest('[data-close-layer]');
    if (c) { closeLayer(c.dataset.closeLayer); return; }
    const d = e.target.closest('[data-dir-btn]');
    if (d) { setDir(d.dataset.dirBtn, d.dataset.lang); return; }
    const l = e.target.closest('[data-loading-demo]');
    if (l) { toggleLoading(l); return; }
    const tt = e.target.closest('[data-toast]');
    if (tt) { toast(tt.dataset.toast, tt.dataset.tone || 'info'); return; }
    if (e.target.matches('[data-close-backdrop]')) closeLayer(e.target.id);
  });

  document.addEventListener('DOMContentLoaded', () => {
    setDir(document.documentElement.getAttribute('dir') || 'rtl',
           document.documentElement.getAttribute('lang') || 'fa');
  });
  window.MonadUI = { toast, openLayer, closeLayer, setDir };
})();
