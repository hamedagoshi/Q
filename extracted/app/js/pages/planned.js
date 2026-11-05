/* A route that is not built yet says so. No fake charts, no invented numbers. */
const t = (lang, fa, en) => (lang === 'en' ? en : fa);

export default {
  title: 'برنامه',
  html({ lang, profile }) {
    const cfg = this.config || {};
    return `
    <section class="section-header">
      <h1 class="section-header__title">${t(lang, cfg.faTitle, cfg.enTitle)}</h1>
      <span class="badge">${t(lang, 'ساخته نشده', 'not built yet')}</span>
    </section>
    <div class="card stack">
      <p class="t-body">${t(lang, cfg.faBody, cfg.enBody)}</p>
      <p class="t-caption">${t(lang, 'در این نسخه هیچ داده‌ای برای این بخش وجود ندارد و هیچ عددی نمایش داده نمی‌شود.',
        'This version holds no data for this section and shows no numbers.')}</p>
      <div class="divider"></div>
      <div class="row row--between">
        <span class="t-caption">${t(lang, 'فاز برنامه‌ریزی‌شده', 'Planned phase')}</span>
        <span class="badge num">${cfg.phase}</span>
      </div>
      <p class="t-caption">${t(lang, 'تمرکز فعلی: ژورنال روزانه، پیوند دقیق روز و زمان، و بکاپ کامل.',
        'Current focus: the daily journal, one authoritative date, and a complete backup.')}</p>
    </div>`;
  },
  after() {},
};
