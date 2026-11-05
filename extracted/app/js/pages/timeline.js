/* Timeline — the real merged feed, ordered by the stored timestamps. */
import { JournalApi, fmtDate, fmtTime } from '../api.js';

const t = (lang, fa, en) => (lang === 'en' ? en : fa);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LABEL = {
  day: ['روز', 'Day'], observation: ['مشاهده', 'Observation'], event: ['رویداد', 'Event'],
  session: ['جلسه', 'Session'], reflection: ['بازنگری', 'Reflection'],
};

export default {
  title: 'خط زمان',
  html({ lang }) {
    return `
    <section class="section-header"><h1 class="section-header__title">${t(lang, 'خط زمان', 'Timeline')}</h1>
      <span class="section-header__hint" id="tl-count">…</span></section>
    <div id="feed" class="stack"><div class="skeleton skeleton--text"></div></div>`;
  },

  after(root, ctx) {
    const { lang, profile } = ctx;
    const tz = profile?.timezone;
    const feed = root.querySelector('#feed');

    (async () => {
      try {
        const data = await JournalApi.timeline({ limit: 100 });
        const items = data.items || [];
        root.querySelector('#tl-count').textContent = String(items.length);
        if (!items.length) {
          feed.innerHTML = `<div class="card"><div class="state">
            <div class="state__icon">≡</div>
            <div class="state__title">${t(lang, 'خط زمان خالی است', 'The timeline is empty')}</div>
            <div class="state__body">${t(lang, 'با ثبت اولین روز، خط زمان ساخته می‌شود.', 'Recording your first day starts the timeline.')}</div>
          </div></div>`;
          return;
        }
        let lastDate = null;
        feed.innerHTML = items.map((i) => {
          const header = i.date !== lastDate
            ? `<div class="tl-date num">${fmtDate(i.date, lang)}</div>`
            : '';
          lastDate = i.date;
          const label = LABEL[i.type]?.[lang === 'en' ? 1 : 0] || i.type;
          return `${header}
          <a class="card card--row" href="/day/${i.date}" data-link>
            <div>
              <div class="entry__title">${esc(i.title || label)}</div>
              <div class="t-caption">${esc(i.excerpt || '')}</div>
            </div>
            <div style="text-align:end">
              <span class="badge">${label}</span>
              <div class="num t-caption">${fmtTime(i.at, tz, lang)}</div>
            </div>
          </a>`;
        }).join('');
      } catch (e) {
        feed.innerHTML = `<div class="alert alert--negative">${e.code === 'unauthenticated'
          ? t(lang, 'نشست منقضی شده است.', 'Session expired.')
          : t(lang, 'بارگذاری خط زمان ممکن نشد.', 'Could not load the timeline.')}</div>`;
      }
    })();
  },
};
