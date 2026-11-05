/* One imported trade. Observed values only: the EA's own numbers, labelled,
   plus the raw payload it came from. Nothing here is recalculated or scored. */
import { TradeApi, fmtDate, fmtTime } from '../api.js';

const t = (lang, fa, en) => (lang === 'en' ? en : fa);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n2 = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(2));

export default {
  title: 'معامله',
  html({ lang }) {
    return `<div id="trade" class="stack">
      <div class="skeleton skeleton--text"></div><div class="skeleton skeleton--text" style="width:60%"></div>
    </div>`;
  },

  after(root, ctx) {
    const { lang, profile, params, navigate } = ctx;
    const host = root.querySelector('#trade');
    const id = params?.id;

    const row = (label, value, cls = '') => `<div class="row row--between"><span class="t-caption">${label}</span><span class="num ${cls}">${value}</span></div>`;

    const render = ({ trade: d, images }) => {
      let actions = [];
      try { actions = JSON.parse(d.actions || '[]'); } catch (_) { actions = []; }
      const rText = d.r_multiple === null || d.r_multiple === undefined
        ? t(lang, 'ثبت نشده', 'not recorded')
        : d.r_source === 'UNBOUNDED'
          ? t(lang, 'تعریف‌نشده (بدون حد ضرر)', 'undefined (no stop)')
          : (d.has_estimate ? `${n2(d.r_multiple)} · ${t(lang, 'تخمینی', 'ESTIMATED')}` : `${n2(d.r_multiple)}R`);
      const IMG_STATE = {
        available: [t(lang, 'موجود', 'available'), 'positive'],
        reference_only: [t(lang, 'فقط مسیر مرجع', 'reference only'), 'neutral'],
        missing: [t(lang, 'ثبت نشده', 'not captured'), 'neutral'],
        failed: [t(lang, 'خطا در ثبت', 'failed'), 'negative'],
      };
      const resTone = Number(d.realized) > 0 ? 'positive' : Number(d.realized) < 0 ? 'negative' : 'neutral';
      host.innerHTML = `
      <section class="section-header">
        <div>
          <h1 class="section-header__title num">${esc(d.symbol)} ${d.direction === 'buy' ? t(lang, 'خرید', 'Buy') : t(lang, 'فروش', 'Sell')}</h1>
          <div class="t-caption num">${esc(d.account_login)} · ${esc(d.status)}${d.uncertain ? ' · ' + t(lang, 'داده ناقص', 'incomplete data') : ''}</div>
        </div>
        <span class="badge num ${resTone}">${n2(d.realized)}</span>
      </section>

      <div class="card stack">
        <div class="t-caption">${t(lang, 'زمان', 'Time')}</div>
        ${row(t(lang, 'ورود (محلی)', 'Entry (local)'), `${fmtDate(d.local_date, lang)} · ${fmtTime(d.opened_at, profile?.timezone, lang)}`)}
        ${row(t(lang, 'خروج (محلی)', 'Exit (local)'), d.closed_at ? fmtTime(d.closed_at, profile?.timezone, lang) : t(lang, 'باز', 'open'))}
        ${row(t(lang, 'زمان سرور', 'Server time'), `${esc(d.server_open_time)} → ${esc(d.server_close_time || '—')}`)}
        ${row(t(lang, 'اختلاف GMT', 'GMT offset'), `${d.gmt_offset_min > 0 ? '+' : ''}${d.gmt_offset_min} min`)}
        <a class="btn btn--ghost btn--sm" href="/day/${d.local_date}" data-link>${t(lang, 'رفتن به ژورنال همان روز', 'Open that day in the journal')}</a>
      </div>

      <div class="card stack">
        <div class="t-caption">${t(lang, 'قیمت و حجم', 'Price and volume')}</div>
        ${row(t(lang, 'ورود', 'Entry'), n2(d.entry_price))}
        ${row(t(lang, 'خروج', 'Exit'), d.exit_price === null || d.exit_price === undefined ? t(lang, 'در خروجی PD_DATA نیست', 'not in the PD_DATA export') : n2(d.exit_price))}
        ${row(t(lang, 'حد ضرر اولیه', 'Initial SL'), d.stop_loss ? n2(d.stop_loss) : '—')}
        ${row(t(lang, 'حد سود اولیه', 'Initial TP'), d.take_profit ? n2(d.take_profit) : '—')}
        ${row(t(lang, 'حجم اولیه', 'Volume'), d.volume_initial)}
        ${row(t(lang, 'حجم بسته‌شده', 'Closed volume'), d.volume_closed)}
        ${row(t(lang, 'موجودی هنگام ورود', 'Balance at open'), d.balance_at_open ? n2(d.balance_at_open) : t(lang, 'نامعلوم', 'unknown'))}
        ${row(t(lang, 'ورود/خروج (Deal)', 'Deals in / out'), `${d.deals_in ?? 0} / ${d.deals_out ?? 0}`)}
        ${row(t(lang, 'چرخه', 'Generation'), d.generation ?? 0)}
      </div>

      <div class="card stack">
        <div class="t-caption">${t(lang, 'نتیجهٔ ثبت‌شده توسط اکسپرت', 'Result as recorded by the EA')}</div>
        ${row(t(lang, 'سود/زیان محقق‌شده', 'Realized'), n2(d.realized), resTone)}
        ${row(t(lang, 'R0', 'R0'), d.r0 ? n2(d.r0) : '—')}
        ${row(t(lang, 'منبع R0', 'R0 source'), esc(d.r0_source || '—'))}
        ${row(t(lang, 'R', 'R multiple'), rText)}
        ${row(t(lang, 'درصد ریسک', 'Risk %'), d.risk_pct ? `${Number(d.risk_pct).toFixed(2)}%` : '—')}
        ${row(t(lang, 'درصد بازده', 'Return %'), d.balance_at_open ? `${Number(d.return_pct).toFixed(2)}%` : '—')}
        ${row('MAE / MFE', d.mae_price ? `${d.mae_price} / ${d.mfe_price}` : '—')}
        ${row(t(lang, 'بازدهی خروج', 'Exit efficiency'), d.mfe_money ? Number(d.exit_efficiency).toFixed(2) : '—')}
        ${row(t(lang, 'دلیل بستن', 'Close reason'), esc(d.close_reason))}
        ${row(t(lang, 'سوآپ / کمیسیون', 'Swap / commission'), `${n2(d.realized_swap)} / ${n2(d.realized_commission)}`)}
      </div>

      <div class="card stack">
        <div class="t-caption">${t(lang, 'تصاویر', 'Screenshots')}</div>
        <div class="grid grid--3">
          ${images.map((im) => `<div class="stack" style="gap:2px">
            <div class="t-caption">${im.phase === 'entry' ? t(lang, 'ورود', 'Entry') : t(lang, 'خروج', 'Exit')} · ${im.timeframe}</div>
            <div class="badge ${(IMG_STATE[im.status] || IMG_STATE.missing)[1]}">${(IMG_STATE[im.status] || IMG_STATE.missing)[0]}</div>
            ${im.ref ? `<div class="t-caption num" style="word-break:break-all">${esc(im.ref)}</div>` : ''}
          </div>`).join('')}
        </div>
        <p class="t-caption">${t(lang, 'این‌ها مسیر مرجع‌اند، نه فایل تصویر؛ هنوز هیچ تصویری دریافت و ذخیره نشده است. نبودن تصویر دلیل رد معامله نیست.', 'These are reference paths, not image files: nothing has been ingested or stored yet. A missing screenshot never rejects the trade.')}</p>
      </div>

      <div class="card stack">
        <div class="t-caption">${t(lang, 'یادداشت اکسپرت', 'EA note')}</div>
        <div class="t-body" id="ea-note" style="white-space:pre-wrap">${esc(d.ea_note ?? d.note ?? '') || `<span class="t-caption">${t(lang, 'خالی', 'empty')}</span>`}</div>
        <div class="t-caption">${t(lang, 'این متن از اکسپرت می‌آید و با هر ایمپورت تازه به‌روز می‌شود.', 'Comes from the EA and is refreshed by every import.')}</div>
      </div>

      <div class="card stack">
        <label class="field"><span class="field__label">${t(lang, 'یادداشت من', 'My note')}</span>
          <textarea class="input" id="note" rows="4">${esc(d.user_note ?? '')}</textarea></label>
        <button class="btn btn--secondary btn--sm" id="save-note">${t(lang, 'ذخیرهٔ یادداشت من', 'Save my note')}</button>
        <p class="t-caption" id="note-msg" aria-live="polite"></p>
        <div class="t-caption">${t(lang, 'این یادداشت با ایمپورت مجدد بازنویسی نمی‌شود.', 'An import never overwrites this note.')}</div>
        ${d.checklist ? `<div class="divider"></div><div class="t-caption">${t(lang, 'چک‌لیست ثبت‌شده', 'Recorded checklist')}</div><div class="t-body">${esc(d.checklist)}</div>` : ''}
      </div>

      ${actions.length ? `<div class="card stack">
        <div class="t-caption">${t(lang, 'اقدام‌های ثبت‌شده', 'Recorded actions')}</div>
        ${actions.map((a) => `<div class="row row--between">
          <span class="t-caption num">${esc(a.ts)} · ${esc(a.act)}</span>
          <span class="t-caption num">${a.vol_after ?? '—'}${a.violation ? ' · ' + t(lang, 'نقض', 'violation') : ''}</span>
        </div>`).join('')}
      </div>` : ''}

      <details class="card stack">
        <summary class="t-caption">${t(lang, 'دادهٔ خام و منشأ', 'Raw source record')}</summary>
        <div class="t-caption num">${t(lang, 'کارت ورود', 'Import job')}: ${esc(d.import_job_id || '—')}</div>
        <pre style="white-space:pre-wrap;word-break:break-all;max-height:320px;overflow:auto">${esc(d.raw || '')}</pre>
      </details>`;

      root.querySelector('#save-note').onclick = async (ev) => {
        const msg = root.querySelector('#note-msg');
        ev.target.disabled = true;
        try {
          await TradeApi.saveNote(d.id, root.querySelector('#note').value);
          msg.textContent = t(lang, 'ذخیره شد', 'Saved');
        } catch (_) { msg.textContent = t(lang, 'ذخیره نشد', 'Not saved'); }
        ev.target.disabled = false;
      };
    };

    (async () => {
      try {
        const data = await TradeApi.trade(id);
        render(data);
      } catch (e) {
        host.innerHTML = `<div class="card"><div class="state">
          <div class="state__icon">□</div>
          <div class="state__title">${t(lang, 'این معامله پیدا نشد', 'This trade was not found')}</div>
          <div class="state__body">${t(lang, 'یا حذف شده یا مال حساب دیگری است.', 'It was removed, or it belongs to another account.')}</div>
          <button class="btn btn--secondary btn--sm state__action" id="back">${t(lang, 'بازگشت', 'Back')}</button>
        </div></div>`;
        root.querySelector('#back').onclick = () => navigate('/trading');
        void e;
      }
    })();
  },
};
