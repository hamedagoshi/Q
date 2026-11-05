/* Journal — chronological list of DailyRecords with a simple range filter. */
import { JournalApi, fmtDate, todayIn } from '../api.js';

const t = (lang, fa, en) => (lang === 'en' ? en : fa);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default {
  title: 'ژورنال',
  html({ lang }) {
    return `
    <section class="section-header">
      <h1 class="section-header__title">${t(lang, 'ژورنال', 'Journal')}</h1>
      <button class="btn btn--primary btn--sm" id="new-day">+ ${t(lang, 'روز جدید', 'New day')}</button>
    </section>
    <div class="seg" role="group" id="range" aria-label="${t(lang, 'بازه', 'Range')}">
      <button data-range="30" aria-pressed="true">${t(lang, '۳۰ روز', '30 days')}</button>
      <button data-range="90" aria-pressed="false">${t(lang, '۹۰ روز', '90 days')}</button>
      <button data-range="0" aria-pressed="false">${t(lang, 'همه', 'All')}</button>
    </div>
    <div id="list" class="stack"></div>
    <div id="more-wrap" class="stack" hidden>
      <button class="btn btn--secondary" id="more">${t(lang, 'روزهای قدیمی‌تر', 'Load older days')}</button>
      <p class="t-caption" id="more-note" aria-live="polite"></p>
    </div>`;
  },

  after(root, ctx) {
    const { lang, profile } = ctx;
    const list = root.querySelector('#list');
    const moreWrap = root.querySelector('#more-wrap');
    const moreBtn = root.querySelector('#more');
    const moreNote = root.querySelector('#more-note');
    const PAGE = 30;
    let range = 30;
    let offset = 0;
    let rows = [];
    let hasMore = false;

    const dayMs = 86400000;

    const render = () => {
      if (!rows.length) {
        list.innerHTML = `<div class="card"><div class="state">
          <div class="state__icon">□</div>
          <div class="state__title">${t(lang, 'در این بازه روزی ثبت نشده', 'No days in this range')}</div>
          <div class="state__body">${t(lang, 'هر روز، یک مشاهده. با یک روز شروع کن.', 'Every day, one observation. Start with today.')}</div>
          <button class="btn btn--primary btn--sm state__action" id="start-today">${t(lang, 'ثبت امروز', 'Record today')}</button>
        </div></div>`;
        const b = root.querySelector('#start-today');
        if (b) b.onclick = () => ctx.navigate('/day/' + todayIn(profile?.timezone));
        moreWrap.hidden = true;
        return;
      }
      list.innerHTML = rows.map((r) => `
        <a class="card card--row" href="/day/${r.record_date}" data-link>
          <div>
            <div class="entry__title">${esc(r.title || fmtDate(r.record_date, lang))}</div>
            <div class="t-caption">${(r.general_note || '').slice(0, 70) || t(lang, 'بدون یادداشت', 'No note')}</div>
          </div>
          <span class="badge num">${r.record_date.slice(5)}</span>
        </a>`).join('');
      moreWrap.hidden = !hasMore;
      moreBtn.disabled = false;
      moreBtn.textContent = t(lang, 'روزهای قدیمی‌تر', 'Load older days');
      moreNote.textContent = hasMore
        ? t(lang, `${rows.length} روز بارگذاری شده است و روزهای قدیمی‌تری هم هست.`,
                 `${rows.length} days loaded. Older days are not shown yet.`)
        : t(lang, `${rows.length} روز، تمام تاریخچهٔ این بازه.`, `${rows.length} days, the whole range.`);
    };

    const rangeFrom = () => {
      if (!range) return undefined;
      return new Date(Date.now() - range * dayMs).toISOString().slice(0, 10);
    };

    async function fetchPage(reset) {
      if (reset) { offset = 0; rows = []; }
      moreBtn.disabled = true;
      moreBtn.textContent = t(lang, 'در حال بارگذاری…', 'Loading…');
      try {
        const data = await JournalApi.dayList({ limit: PAGE, offset, from: rangeFrom() });
        rows = rows.concat(data.records || []);
        hasMore = Boolean(data.has_more);
        offset = data.next_offset ?? offset + PAGE;
        render();
      } catch (e) {
        render();
        list.insertAdjacentHTML('afterbegin', `<div class="alert alert--negative">${e.code === 'unauthenticated'
          ? t(lang, 'نشست منقضی شده است.', 'Session expired.')
          : t(lang, 'بارگذاری نشد.', 'Could not load.')}</div>`);
      }
    }

    async function load() {
      list.innerHTML = `<div class="skeleton skeleton--text"></div><div class="skeleton skeleton--text" style="width:60%"></div>`;
      moreWrap.hidden = true;
      await fetchPage(true);
    }

    moreBtn.onclick = () => fetchPage(false);

    root.querySelectorAll('[data-range]').forEach((b) => {
      b.onclick = () => {
        range = Number(b.dataset.range);
        root.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        load();
      };
    });

    root.querySelector('#new-day').onclick = () => ctx.navigate('/day/' + todayIn(profile?.timezone));
    load();
  },
};
