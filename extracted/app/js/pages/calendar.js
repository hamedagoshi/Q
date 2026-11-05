/* Calendar — real months, real marked days; empty days stay selectable. */
import { JournalApi, fmtDate } from '../api.js';

const t = (lang, fa, en) => (lang === 'en' ? en : fa);

function monthMeta(year, month, lang) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = first.getUTCDay(); // 0=Sunday
  const name = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(first);
  return { daysInMonth, startWeekday, name };
}

const pad = (n) => String(n).padStart(2, '0');

export default {
  title: 'تقویم',
  html({ lang, profile }) {
    const now = new Date();
    const y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: profile?.timezone || 'UTC', year: 'numeric' }).format(now));
    const m = Number(new Intl.DateTimeFormat('en-CA', { timeZone: profile?.timezone || 'UTC', month: 'numeric' }).format(now)) - 1;
    return `
    <section class="section-header"><h1 class="section-header__title">${t(lang, 'تقویم', 'Calendar')}</h1>
      <div class="row" style="gap:8px">
        <button class="btn btn--ghost btn--sm" id="prev" aria-label="${t(lang, 'ماه قبل', 'Previous month')}">‹</button>
        <button class="btn btn--ghost btn--sm" id="next" aria-label="${t(lang, 'ماه بعد', 'Next month')}">›</button>
      </div>
    </section>
    <div class="card">
      <div class="cal__title" id="cal-title"></div>
      <div class="cal__grid" id="cal-grid" data-y="${y}" data-m="${m}"></div>
    </div>
    <section class="section-header"><h2 class="section-header__title" id="sel-date">—</h2>
      <a href="#" class="t-caption" id="open-day"></a></section>
    <div class="stack" id="sel-list"></div>`;
  },

  after(root, ctx) {
    const { lang } = ctx;
    const grid = root.querySelector('#cal-grid');
    const title = root.querySelector('#cal-title');
    let y = Number(grid.dataset.y);
    let m = Number(grid.dataset.m);
    let marks = {};

    async function load() {
      const { daysInMonth, startWeekday, name } = monthMeta(y, m, lang);
      title.textContent = name;
      const from = `${y}-${pad(m + 1)}-01`;
      const to = `${y}-${pad(m + 1)}-${pad(daysInMonth)}`;
      try {
        const data = await JournalApi.calendar(from, to);
        marks = Object.fromEntries((data.days || []).map((d) => [d.date, d]));
      } catch (_) { marks = {}; }

      const cells = [];
      for (let i = 0; i < startWeekday; i += 1) cells.push('<span class="cal__cell cal__cell--void"></span>');
      for (let d = 1; d <= daysInMonth; d += 1) {
        const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
        const mark = marks[iso];
        const count = mark ? Object.values(mark.counts).reduce((a, b) => a + b, 0) : 0;
        cells.push(`<button class="cal__cell${mark ? ' is-marked' : ''}" data-date="${iso}"
          aria-label="${iso}${mark ? ' · ' + count : ''}">
          <span class="num">${lang === 'en' ? d : new Intl.NumberFormat('fa-IR').format(d)}</span>
          ${mark ? `<i class="cal__dot" title="${count}"></i>` : ''}
        </button>`);
      }
      grid.innerHTML = cells.join('');
      grid.querySelectorAll('[data-date]').forEach((b) => { b.onclick = () => select(b.dataset.date); });
    }

    async function select(iso) {
      root.querySelector('#sel-date').textContent = fmtDate(iso, lang);
      const link = root.querySelector('#open-day');
      link.textContent = t(lang, 'باز کردن روز ›', 'Open day ›');
      link.setAttribute('href', '/day/' + iso);
      link.setAttribute('data-link', '');
      const list = root.querySelector('#sel-list');
      const mark = marks[iso];
      if (!mark) {
        list.innerHTML = `<div class="card"><p class="t-caption">${t(lang, 'این روز خالی است.', 'This day is empty.')}
          <a href="/day/${iso}" data-link>${t(lang, 'ثبت تجربه', 'Record it')}</a></p></div>`;
        return;
      }
      const c = mark.counts;
      list.innerHTML = `<div class="card stack">
        <div class="row t-caption">
          <span class="num">${c.observations} ${t(lang, 'مشاهده', 'obs')}</span>
          <span class="num">${c.events} ${t(lang, 'رویداد', 'events')}</span>
          <span class="num">${c.sessions} ${t(lang, 'جلسه', 'sessions')}</span>
          <span class="num">${c.reflections} ${t(lang, 'بازنگری', 'reflect')}</span>
        </div>
        <a class="btn btn--primary btn--sm" href="/day/${iso}" data-link>${t(lang, 'مشاهده روز', 'View day')}</a>
      </div>`;
    }

    root.querySelector('#prev').onclick = () => { m -= 1; if (m < 0) { m = 11; y -= 1; } load(); };
    root.querySelector('#next').onclick = () => { m += 1; if (m > 11) { m = 0; y += 1; } load(); };
    load();
  },
};
