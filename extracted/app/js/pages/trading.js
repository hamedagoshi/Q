/* Trading — connected accounts, a real PD_DATA import, and the trade history.
   Every number on this page comes from an imported trade row; nothing is derived. */
import { TradeApi, fmtDate, fmtTime } from '../api.js';

const t = (lang, fa, en) => (lang === 'en' ? en : fa);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n, cur) => `${Number(n || 0).toFixed(2)} ${cur || ''}`.trim();

export default {
  title: 'معاملات',
  html({ lang }) {
    return `
    <section class="section-header">
      <h1 class="section-header__title">${t(lang, 'معاملات', 'Trades')}</h1>
      <label class="btn btn--primary btn--sm" for="file">${t(lang, 'ورود فایل PD_DATA', 'Import PD_DATA')}</label>
      <input id="file" type="file" accept=".js,.json,application/json,text/javascript" hidden>
    </section>
    <div id="import-note" class="stack" aria-live="polite"></div>
    <div id="accounts" class="stack"></div>
    <div class="card stack">
      <div class="row row--between"><span class="t-caption">${t(lang, 'صافی معاملات', 'Trade filters')}</span></div>
      <div class="grid grid--2">
        <label class="field"><span class="field__label">${t(lang, 'حساب', 'Account')}</span>
          <select class="input" id="f-account"><option value="">${t(lang, 'همه', 'All')}</option></select></label>
        <label class="field"><span class="field__label">${t(lang, 'نماد', 'Symbol')}</span>
          <input class="input" id="f-symbol" placeholder="XAUUSD" autocomplete="off"></label>
        <label class="field"><span class="field__label">${t(lang, 'از تاریخ', 'From')}</span>
          <input class="input num" id="f-from" type="date"></label>
        <label class="field"><span class="field__label">${t(lang, 'تا تاریخ', 'To')}</span>
          <input class="input num" id="f-to" type="date"></label>
      </div>
      <div class="seg" role="group" id="f-status" aria-label="${t(lang, 'وضعیت', 'Status')}">
        <button data-status="" aria-pressed="true">${t(lang, 'همه', 'All')}</button>
        <button data-status="closed" aria-pressed="false">${t(lang, 'بسته', 'Closed')}</button>
        <button data-status="open" aria-pressed="false">${t(lang, 'باز', 'Open')}</button>
        <button data-status="partial" aria-pressed="false">${t(lang, 'نیمه', 'Partial')}</button>
      </div>
    </div>
    <div id="trades" class="stack"></div>
    <div id="more-wrap" class="stack" hidden>
      <button class="btn btn--secondary" id="more">${t(lang, 'معاملات قدیمی‌تر', 'Older trades')}</button>
      <p class="t-caption" id="more-note" aria-live="polite"></p>
    </div>
    <div id="jobs" class="stack"></div>`;
  },

  after(root, ctx) {
    const { lang, profile, navigate } = ctx;
    const currency = { v: '' };
    const tradesEl = root.querySelector('#trades');
    const accountsEl = root.querySelector('#accounts');
    const jobsEl = root.querySelector('#jobs');
    const noteEl = root.querySelector('#import-note');
    const moreWrap = root.querySelector('#more-wrap');
    const moreBtn = root.querySelector('#more');
    const moreNote = root.querySelector('#more-note');
    const PAGE = 30;
    let offset = 0; let rows = []; let hasMore = false; let status = '';

    const filters = () => ({
      account_id: root.querySelector('#f-account').value || undefined,
      symbol: (root.querySelector('#f-symbol').value || '').trim() || undefined,
      from: root.querySelector('#f-from').value || undefined,
      to: root.querySelector('#f-to').value || undefined,
      status: status || undefined,
      limit: PAGE,
      offset,
    });

    const renderTrades = () => {
      if (!rows.length) {
        tradesEl.innerHTML = `<div class="card"><div class="state">
          <div class="state__icon">▤</div>
          <div class="state__title">${t(lang, 'معامله‌ای برای نمایش نیست', 'No trades to show')}</div>
          <div class="state__body">${t(lang, 'فایل journal_data.js را از پوشهٔ Files ترمینال متاتریدر بردار و اینجا وارد کن.',
            'Take journal_data.js from the MetaTrader Files folder and import it here.')}</div>
        </div></div>`;
        moreWrap.hidden = true;
        return;
      }
      tradesEl.innerHTML = rows.map((r) => {
        const dir = r.direction === 'buy' ? t(lang, 'خرید', 'Buy') : t(lang, 'فروش', 'Sell');
        const res = Number(r.realized || 0);
        const tone = res > 0 ? 'positive' : res < 0 ? 'negative' : 'neutral';
        return `<a class="card card--row" href="/trading/${r.id}" data-link>
          <div>
            <div class="entry__title">${esc(r.symbol)} · ${dir} <span class="badge">${esc(r.status)}</span>${r.uncertain ? ` <span class="badge">${t(lang, 'نامعلوم', 'uncertain')}</span>` : ''}</div>
            <div class="t-caption num">${fmtDate(r.local_date, lang)} · ${fmtTime(r.opened_at, profile?.timezone, lang)} · ${r.volume_initial}</div>
          </div>
          <div class="stack" style="align-items:flex-end;gap:2px">
            <span class="badge num ${tone}">${money(res, currency.v)}</span>
            <span class="t-caption num">${r.r_multiple === null || r.r_source === 'UNBOUNDED' ? t(lang, 'R تعریف‌نشده', 'R undefined') : `${Number(r.r_multiple).toFixed(2)}R`}</span>
          </div>
        </a>`;
      }).join('');
      moreWrap.hidden = !hasMore;
      moreNote.textContent = hasMore
        ? t(lang, `${rows.length} معامله بارگذاری شد؛ قدیمی‌ترها هم هست.`, `${rows.length} loaded; older trades exist.`)
        : t(lang, `${rows.length} معامله، همهٔ نتیجه.`, `${rows.length} trades, the whole result.`);
    };

    const loadTrades = async (reset) => {
      if (reset) { offset = 0; rows = []; }
      moreBtn.disabled = true;
      try {
        const data = await TradeApi.trades(filters());
        rows = rows.concat(data.trades || []);
        hasMore = Boolean(data.has_more);
        offset = data.next_offset ?? offset + PAGE;
        renderTrades();
      } catch (e) {
        tradesEl.innerHTML = `<div class="alert alert--negative">${e.code === 'unauthenticated'
          ? t(lang, 'نشست منقضی شده است.', 'Session expired.') : t(lang, 'بارگذاری نشد.', 'Could not load.')}</div>`;
      }
      moreBtn.disabled = false;
    };

    const loadAccounts = async () => {
      try {
        const { accounts } = await TradeApi.accounts();
        if (!accounts.length) {
          accountsEl.innerHTML = `<div class="card"><div class="state">
            <div class="state__icon">◇</div>
            <div class="state__title">${t(lang, 'حسابی وصل نیست', 'No account yet')}</div>
            <div class="state__body">${t(lang, 'اولین ورود فایل PD_DATA حساب را می‌سازد.', 'The first PD_DATA import creates the account.')}</div>
          </div></div>`;
          return;
        }
        currency.v = accounts[0].currency || '';
        accountsEl.innerHTML = accounts.map((a) => `<div class="card stack">
          <div class="row row--between">
            <div><div class="entry__title num">${esc(a.login)}</div>
            <div class="t-caption">${esc(a.broker || '—')} · ${esc(a.server || '—')} · ${esc(a.currency || '')}</div></div>
            <span class="badge">${esc(a.account_type || 'unknown')}</span>
          </div>
          <div class="grid grid--3">
            <div><div class="t-caption">${t(lang, 'موجودی', 'Balance')}</div><div class="num">${money(a.balance, a.currency)}</div></div>
            <div><div class="t-caption">${t(lang, 'ارزش خالص', 'Equity')}</div><div class="num">${money(a.equity, a.currency)}</div></div>
            <div><div class="t-caption">${t(lang, 'دراودان مصرفی', 'DD used')}</div><div class="num">${Number(a.dd_used_pct || 0).toFixed(2)}%</div></div>
          </div>
          <div class="t-caption num">${t(lang, 'آخرین دریافت', 'Last ingest')}: ${a.last_import_at ? fmtTime(a.last_import_at, profile?.timezone, lang) + ' · ' + fmtDate(String(a.last_import_at).slice(0, 10), lang) : '—'}</div>
        </div>`).join('');
        const sel = root.querySelector('#f-account');
        sel.innerHTML = `<option value="">${t(lang, 'همه', 'All')}</option>` + accounts.map((a) => `<option value="${a.id}">${esc(a.login)}</option>`).join('');
      } catch (_) { /* account list is not fatal for the trade list */ }
    };

    const loadJobs = async () => {
      try {
        const { jobs } = await TradeApi.jobs();
        if (!jobs.length) { jobsEl.innerHTML = ''; return; }
        jobsEl.innerHTML = `<div class="card stack">
          <div class="t-caption">${t(lang, 'سابقهٔ ورود داده', 'Import history')}</div>
          ${jobs.slice(0, 5).map((j) => {
            let errs = [];
            try { errs = JSON.parse(j.errors || '[]'); } catch (_) { errs = []; }
            return `<details class="stack">
              <summary class="t-caption"><span class="badge ${j.status === 'failed' ? 'negative' : j.status === 'completed' ? 'positive' : 'neutral'}">${esc(j.status)}</span>
                ${j.stale ? `<span class="badge negative">${t(lang, 'ناتمام', 'stale')}</span>` : ''}
                <span class="num"> ${fmtDate(String(j.started_at || '').slice(0, 10), lang)} · ${j.created_count || 0} ${t(lang, 'ایجاد', 'new')} · ${j.updated_count || 0} ${t(lang, 'به‌روز', 'upd')} · ${j.unchanged_count || 0} ${t(lang, 'بی‌تغییر', 'same')} · ${j.duplicate_count || 0} ${t(lang, 'تکراری', 'dup')} · ${j.rejected_count || 0} ${t(lang, 'رد', 'rejected')}</span></summary>
              <div class="t-caption num">${esc(j.source_name || '')} · schema ${j.schema_version ?? '?'} · ${j.read_count || 0}/${j.total_count ?? j.read_count ?? 0} ${t(lang, 'رکورد خوانده‌شده', 'records read')} · ${j.unprocessed_count || 0} ${t(lang, 'پردازش‌نشده', 'unprocessed')}</div>
              ${j.unprocessed_count ? `<div class="t-caption">${t(lang, 'برای ادامه، همان فایل را با offset بعدی وارد کن تا بقیه پردازش شود.', 'To continue, import the same file again from the next offset.')}</div>` : ''}
              ${errs.length ? `<div class="t-caption">${errs.map((x) => `<span class="badge negative">${esc(x.id || '—')}</span> ${esc(x.reason)}`).join('<br>')}</div>` : ''}
            </details>`;
          }).join('')}
        </div>`;
      } catch (_) { jobsEl.innerHTML = ''; }
    };

    const doImport = async (file) => {
      noteEl.innerHTML = `<div class="alert">${t(lang, 'در حال خواندن فایل…', 'Reading the file…')}</div>`;
      try {
        const text = await file.text();
        const res = await TradeApi.importPd(text, file.name);
        const s = res.summary || {};
        noteEl.innerHTML = `<div class="alert ${s.rejected ? 'alert--negative' : 'alert--positive'}">
          ${t(lang,
            `خوانده ${s.read} · ساخته ${s.created} · به‌روزشده ${s.updated} · تکراری ${s.duplicate} · ردشده ${s.rejected}`,
            `read ${s.read} · created ${s.created} · updated ${s.updated} · duplicate ${s.duplicate} · rejected ${s.rejected}`)}
          ${s.errors?.length ? `<div class="t-caption">${s.errors.map((x) => `${esc(x.id || '—')}: ${esc(x.reason)}`).join('<br>')}</div>` : ''}
        </div>`;
        await Promise.all([loadAccounts(), loadJobs(), loadTrades(true)]);
      } catch (e) {
        noteEl.innerHTML = `<div class="alert alert--negative">${esc(e.reason || e.message || t(lang, 'ورود داده انجام نشد.', 'Import failed.'))}</div>`;
      }
    };

    root.querySelector('#file').addEventListener('change', (ev) => {
      const file = ev.target.files?.[0];
      if (file) doImport(file);
    });
    root.querySelectorAll('#f-status [data-status]').forEach((b) => {
      b.onclick = () => {
        status = b.dataset.status;
        root.querySelectorAll('#f-status [data-status]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        loadTrades(true);
      };
    });
    ['#f-account', '#f-symbol', '#f-from', '#f-to'].forEach((sel) => {
      const el = root.querySelector(sel);
      el.addEventListener('change', () => loadTrades(true));
    });
    moreBtn.onclick = () => loadTrades(false);

    loadAccounts().then(() => Promise.all([loadTrades(true), loadJobs()]));
    void navigate;
  },
};
