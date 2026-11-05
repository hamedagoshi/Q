/* shared shell for routes whose feature belongs to a later phase */
export function placeholder({ title, body, phase }) {
  return `
  <section class="section-header"><h1 class="section-header__title">${title}</h1>
    <span class="section-header__hint">${phase}</span></section>
  <div class="card">
    <div class="state">
      <div class="state__icon">□</div>
      <div class="state__title">آماده‌سازی نشده</div>
      <div class="state__body">${body}</div>
    </div>
  </div>`;
}
