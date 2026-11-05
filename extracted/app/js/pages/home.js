/* Today — the current day, its status, and the latest entries. No scoring, no streaks. */
import { JournalApi, fmtDate, fmtTime, todayIn } from '../api.js';

const t = (lang, fa, en) => (lang === 'en' ? en : fa);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default {
  title: 'امروز',
  html({ lang, profile }) {
    const day = todayIn(profile?.timezone);
    return `
    <section class="section-header">
      <div>
        <h1 class="section-header__title">${t(lang, 'امروز', 'Today')}</h1>
        <span class="t-caption num">${fmtDate(day, lang)}</span>
      </div>
      <span class="badge" id="today-state">…</span>
    </section>
    <div class="card stack" id="today-card">
      <div class="skeleton skeleton--text"></div>
    </div>
    <section class="section-header"><h2 class="section-header__title">${t(lang, 'آخرین ثبت‌ها', 'Latest entries')}</h2>
      <a href="/timeline" data-link class="t-caption">${t(lang, 'خط زمان', 'Timeline')}</a></section>
    <div class="stack" id="recent"></div>`;
  },

  after(root, ctx) {
    const { lang, profile } = ctx;
    const tz = profile?.timezone;
    const day = todayIn(tz);
    const card = root.querySelector('#today-card');
    const badge = root.querySelector('#today-state');
    const recent = root.querySelector('#recent');

    async function load() {
      try {
        const d = await JournalApi.dayGet(day);
        const r = d.record;
        badge.textContent = r ? t(lang, 'ثبت‌شده', 'recorded') : t(lang, 'ثبت نشده', 'not yet');
        const counts = {
          o: (d.observations || []).length,
          e: (d.events || []).length,
          s: (d.sessions || []).length,
          r: (d.reflections || []).length,
        };
        card.innerHTML = r
          ? `<p class="entry__body">${esc((r.general_note || '').slice(0, 240)) || t(lang, 'یادداشت خالی است.', 'The note is empty.')}</p>
             <div class="row t-caption">
               <span class="num">${counts.o} ${t(lang, 'مشاهده', 'obs')}</span>
               <span class="num">${counts.e} ${t(lang, 'رویداد', 'events')}</span>
               <span class="num">${counts.s} ${t(lang, 'جلسه', 'sessions')}</span>
               <span class="num">${counts.r} ${t(lang, 'بازنگری', 'reflect')}</span>
             </div>
             <a class="btn btn--primary btn--sm" href="/day/${day}" data-link>${t(lang, 'ادامه امروز', 'Continue today')}</a>`
          : `<p class="t-caption">${t(lang, 'امروز هنوز چیزی ثبت نشده.', 'Nothing recorded today yet.')}</p>
             <a class="btn btn--primary btn--sm" href="/day/${day}" data-link>${t(lang, 'ثبت تجربه امروز', 'Record today')}</a>`;
      } catch (e) {
        badge.textContent = '!';
        card.innerHTML = `<div class="alert alert--negative">${e.code === 'unauthenticated'
          ? t(lang, 'نشست منقضی شده است.', 'Session expired.')
          : t(lang, 'امروز بارگذاری نشد.', 'Could not load today.')}</div>`;
      }

      try {
        const tl = await JournalApi.timeline({ limit: 6 });
        recent.innerHTML = (tl.items || []).length
          ? tl.items.map((i) => `
            <a class="card card--row" href="/day/${i.date}" data-link>
              <div>
                <div class="entry__title">${esc(i.title || i.type)}</div>
                <div class="t-caption">${esc((i.excerpt || '').slice(0, 60))}</div>
              </div>
              <span class="num t-caption">${fmtTime(i.at, tz, lang)}</span>
            </a>`).join('')
          : `<div class="card"><p class="t-caption">${t(lang, 'خط زمان خالی است.', 'The timeline is empty.')}</p></div>`;
      } catch (_) {
        recent.innerHTML = '';
      }
    }

    load();
  },
};
