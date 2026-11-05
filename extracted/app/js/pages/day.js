/* Day detail — /day/:date. Five independent sections; each write is its own request. */
import { JournalApi, TradeApi, fmtDate, fmtTime, toIso } from '../api.js';

const CATS = [
  ['physical', 'جسمی', 'Physical'], ['mental', 'ذهنی', 'Mental'],
  ['emotional', 'احساسی', 'Emotional'], ['environmental', 'محیطی', 'Environmental'],
  ['other', 'سایر', 'Other'],
];

const REVIEW = [
  ['plan', 'چه برنامه‌ای داشتم؟', 'What was my plan?'],
  ['did', 'چه کارهایی انجام دادم؟', 'What did I do?'],
  ['unexpected', 'چه چیزی مطابق انتظار نبود؟', 'What did not go as expected?'],
  ['learned', 'چه چیزی آموختم؟', 'What did I learn?'],
  ['change', 'چه چیزی باید در روز بعد تغییر کند؟', 'What should change tomorrow?'],
];

const t = (lang, fa, en) => (lang === 'en' ? en : fa);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default {
  title: 'روز',
  html({ params, lang }) {
    return `
    <section class="section-header">
      <div>
        <a href="/journal" data-link class="t-caption">${t(lang, 'ژورنال', 'Journal')}</a>
        <h1 class="section-header__title" id="day-title">${esc(params.date)}</h1>
      </div>
      <span class="badge num" id="day-badge">…</span>
    </section>
    <div id="day-body"><div class="skeleton skeleton--title"></div></div>`;
  },

  after(root, ctx) {
    const { params, lang, profile } = ctx;
    const tz = profile?.timezone || undefined;
    const body = root.querySelector('#day-body');

    const fail = (err) => {
      const map = {
        network: t(lang, 'اتصال برقرار نشد.', 'Network failed.'),
        unauthenticated: t(lang, 'نشست منقضی شده است.', 'Session expired.'),
        not_found: t(lang, 'این روز دیگر وجود ندارد.', 'This day no longer exists.'),
      };
      body.innerHTML = `<div class="alert alert--negative" role="alert">${map[err.code] || t(lang, 'خطای غیرمنتظره.', 'Unexpected error.')}</div>
        <button class="btn btn--ghost btn--sm" id="retry">${t(lang, 'تلاش دوباره', 'Retry')}</button>`;
      root.querySelector('#retry').onclick = load;
    };

    async function load() {
      try {
        const [data, tradeRes] = await Promise.all([
          JournalApi.dayGet(params.date),
          TradeApi.trades({ from: params.date, to: params.date, limit: 200 }).catch(() => ({ trades: [] })),
        ]);
        data.trades = tradeRes.trades || [];
        root.querySelector('#day-title').textContent = fmtDate(params.date, lang);
        root.querySelector('#day-badge').textContent = data.record ? t(lang, 'ثبت‌شده', 'recorded') : t(lang, 'خالی', 'empty');
        body.innerHTML = view(data);
        wire(data);
      } catch (e) { fail(e); }
    }

    function view(d) {
      const r = d.record;
      const note = r?.general_note || '';
      const obs = d.observations || [];
      const evs = d.events || [];
      const ses = d.sessions || [];
      const refs = d.reflections || [];
      const trades = d.trades || [];
      const reflectionFor = (question) => (refs.find((x) => x.question === question)?.response || '');

      const lab = (k) => CATS.find((c) => c[0] === k)?.[lang === 'en' ? 2 : 1] || k;

      return `
      <div class="card stack">
        <div class="field">
          <label class="field__label" for="note">${t(lang, 'یادداشت روز', 'General note')}</label>
          <textarea class="textarea" id="note" rows="4" maxlength="8000" placeholder="${t(lang, 'امروز چه دیدی؟', 'What did you notice today?')}">${esc(note)}</textarea>
        </div>
        <div class="field">
          <label class="field__label" for="title">${t(lang, 'عنوان (اختیاری)', 'Title (optional)')}</label>
          <input class="input" id="title" maxlength="120" value="${esc(r?.title || '')}">
        </div>
        <div class="row" style="gap:8px;justify-content:flex-start">
          <button class="btn btn--primary btn--sm" id="save-day">${t(lang, 'ذخیره', 'Save')}</button>
          ${r ? `<button class="btn btn--ghost btn--sm" id="del-day">${t(lang, 'حذف روز', 'Delete day')}</button>` : ''}
        </div>
        <p class="t-caption" id="day-msg" hidden></p>
      </div>

      <section class="section-header"><h2 class="section-header__title">${t(lang, 'مشاهده‌ها', 'Observations')}</h2><span class="section-header__hint num">${obs.length}</span></section>
      <div class="card stack" data-sec="obs">
        ${obs.length ? obs.map((o) => `
          <div class="entry" data-id="${o.id}">
            <div class="entry__head">
              <span class="badge">${esc(lab(o.state_category))}</span>
              <span class="num t-caption">${fmtTime(o.observed_at, tz, lang)}${o.intensity ? ' · ' + t(lang, 'شدت ثبت‌شده توسط خودت', 'intensity you recorded') + ': ' + o.intensity : ''}</span>
            </div>
            <p class="entry__body">${esc(o.description)}</p>
            <div class="entry__actions">
              <button class="btn btn--ghost btn--xs" data-edit="obs">${t(lang, 'ویرایش', 'Edit')}</button>
              <button class="btn btn--ghost btn--xs" data-del="obs">${t(lang, 'حذف', 'Delete')}</button>
            </div>
          </div>`).join('') : `<p class="t-caption">${t(lang, 'هنوز مشاهده‌ای ثبت نشده.', 'No observations yet.')}</p>`}
        <button class="btn btn--ghost btn--sm" data-add="obs">+ ${t(lang, 'مشاهده', 'Observation')}</button>
      </div>

      <section class="section-header"><h2 class="section-header__title">${t(lang, 'رویدادهای زندگی', 'Life events')}</h2><span class="section-header__hint num">${evs.length}</span></section>
      <div class="card stack" data-sec="event">
        ${evs.length ? evs.map((e) => `
          <div class="entry" data-id="${e.id}">
            <div class="entry__head">
              <strong class="entry__title">${esc(e.title)}</strong>
              <span class="num t-caption">${fmtTime(e.event_time, tz, lang)}</span>
            </div>
            ${e.description ? `<p class="entry__body">${esc(e.description)}</p>` : ''}
            <div class="entry__actions">
              <button class="btn btn--ghost btn--xs" data-edit="event">${t(lang, 'ویرایش', 'Edit')}</button>
              <button class="btn btn--ghost btn--xs" data-del="event">${t(lang, 'حذف', 'Delete')}</button>
            </div>
          </div>`).join('') : `<p class="t-caption">${t(lang, 'رویدادی ثبت نشده.', 'No events yet.')}</p>`}
        <button class="btn btn--ghost btn--sm" data-add="event">+ ${t(lang, 'رویداد', 'Event')}</button>
      </div>

      <section class="section-header"><h2 class="section-header__title">${t(lang, 'جلسات معاملاتی', 'Trading sessions')}</h2><span class="section-header__hint num">${ses.length}</span></section>
      <div class="card stack" data-sec="session">
        ${ses.length ? ses.map((s) => `
          <div class="entry" data-id="${s.id}">
            <div class="entry__head">
              <strong class="entry__title">${esc(s.market || t(lang, 'جلسه', 'Session'))}</strong>
              <span class="num t-caption">${fmtTime(s.start_time, tz, lang)}${s.end_time ? '–' + fmtTime(s.end_time, tz, lang) : ''}</span>
            </div>
            ${s.note ? `<p class="entry__body">${esc(s.note)}</p>` : ''}
            <div class="entry__actions">
              <button class="btn btn--ghost btn--xs" data-edit="session">${t(lang, 'ویرایش', 'Edit')}</button>
              <button class="btn btn--ghost btn--xs" data-del="session">${t(lang, 'حذف', 'Delete')}</button>
            </div>
          </div>`).join('') : `<p class="t-caption">${t(lang, 'جلسه‌ای ثبت نشده.', 'No sessions yet.')}</p>`}
        <button class="btn btn--ghost btn--sm" data-add="session">+ ${t(lang, 'جلسه', 'Session')}</button>
      </div>

      <section class="section-header"><h2 class="section-header__title">${t(lang, 'معاملات این روز', 'Trades of this day')}</h2><span class="section-header__hint num">${trades.length}</span></section>
      <section class="stack" id="day-trades">
        ${trades.length ? trades.map((x) => `
          <a class="card stack" href="/trading/${esc(x.id)}" data-link data-trade="${esc(x.id)}" style="text-decoration:none;color:inherit">
            <div class="row row--between">
              <strong class="num">${esc(x.symbol || '—')} · ${x.direction === 'sell' ? t(lang, 'فروش', 'sell') : t(lang, 'خرید', 'buy')}</strong>
              <span class="badge ${x.status === 'open' ? 'neutral' : x.status === 'partial' ? 'neutral' : 'positive'}">${x.status === 'open' ? t(lang, 'باز', 'open') : x.status === 'partial' ? t(lang, 'نیمه‌بسته', 'partial') : t(lang, 'بسته', 'closed')}</span>
            </div>
            <div class="t-caption num">${fmtTime(x.opened_at, tz, lang)}${x.closed_at ? ' → ' + fmtTime(x.closed_at, tz, lang) : ' → ' + t(lang, 'هنوز باز', 'still open')}</div>
            <div class="t-caption num">${t(lang, 'حجم', 'volume')} ${x.volume_initial ?? '—'}${x.volume_closed ? ' / ' + x.volume_closed : ''} · ${t(lang, 'نتیجه', 'realized')} ${x.realized ?? '—'}</div>
            ${x.user_note ? `<div class="t-body">${esc(x.user_note)}</div>` : ''}
          </a>`).join('') : `<p class="t-caption">${t(lang, 'در این روز معامله‌ای ثبت نشده است.', 'No trades recorded on this day.')}</p>`}
        <a class="btn btn--ghost btn--sm" href="/trading" data-link>${t(lang, 'همهٔ معاملات', 'All trades')}</a>
      </section>

      <section class="section-header"><h2 class="section-header__title">${t(lang, 'بازنگری روز', 'Daily review')}</h2><span class="section-header__hint">${t(lang, 'اختیاری', 'optional')}</span></section>
      <div class="card stack" id="review">
        <p class="t-caption">${t(lang, 'این پرسش‌ها فقط برای خودبازنگری‌اند؛ پاسخ‌ها همان‌طور که می‌نویسی ذخیره می‌شوند.', 'These prompts are only for your own review; answers are stored exactly as you write them.')}</p>
        ${REVIEW.map((q, i) => `<label class="field"><span class="field__label">${esc(lang === 'en' ? q[2] : q[1])}</span><textarea class="textarea" id="rv-${i}" rows="2" maxlength="2000">${esc(reflectionFor(q[0]))}</textarea></label>`).join('')}
        <button class="btn btn--secondary btn--sm" id="save-review">${t(lang, 'ذخیرهٔ بازنگری', 'Save review')}</button>
        <p class="t-caption" id="review-msg" aria-live="polite"></p>
      </div>

      <section class="section-header"><h2 class="section-header__title">${t(lang, 'بازنگری', 'Reflections')}</h2><span class="section-header__hint num">${refs.length}</span></section>
      <div class="card stack" data-sec="reflection">
        ${refs.length ? refs.map((x) => `
          <div class="entry" data-id="${x.id}">
            ${x.question ? `<p class="entry__q">${esc(x.question)}</p>` : ''}
            <p class="entry__body">${esc(x.response)}</p>
            <div class="entry__actions">
              <button class="btn btn--ghost btn--xs" data-edit="reflection">${t(lang, 'ویرایش', 'Edit')}</button>
              <button class="btn btn--ghost btn--xs" data-del="reflection">${t(lang, 'حذف', 'Delete')}</button>
            </div>
          </div>`).join('') : `<p class="t-caption">${t(lang, 'بازنگری‌ای نوشته نشده.', 'No reflections yet.')}</p>`}
        <button class="btn btn--ghost btn--sm" data-add="reflection">+ ${t(lang, 'بازنگری', 'Reflection')}</button>
      </div>`;
    }

    const msg = (text, bad) => {
      const el = root.querySelector('#day-msg');
      if (!el) return;
      el.hidden = false; el.textContent = text;
      el.className = bad ? 'alert alert--negative' : 't-caption';
    };

    const ensureDay = async () => {
      const d = await JournalApi.dayGet(params.date);
      if (d.record) return d.record;
      const up = await JournalApi.dayUpsert(params.date, {});
      return up.record;
    };

    function wire(data) {
      const saveDay = root.querySelector('#save-day');
      saveDay.onclick = async () => {
        saveDay.disabled = true;
        try {
          await JournalApi.dayUpsert(params.date, {
            general_note: root.querySelector('#note').value,
            title: root.querySelector('#title').value,
          });
          msg(t(lang, 'ذخیره شد', 'Saved'));
          await load();
        } catch (e) { msg(t(lang, 'ذخیره نشد: ', 'Not saved: ') + e.code, true); saveDay.disabled = false; }
      };

      const del = root.querySelector('#del-day');
      if (del) del.onclick = async () => {
        try {
          await JournalApi.dayDelete(data.record.id, false);
          msg(t(lang, 'خطا: تأیید لازم است.', 'Confirmation required.'), true);
        } catch (e) {
          if (e.code !== 'confirmation_required') { msg(e.code, true); return; }
          const c = e.children || {};
          const summary = `${c.observations || 0} ${t(lang, 'مشاهده', 'obs')} · ${c.events || 0} ${t(lang, 'رویداد', 'events')} · ${c.sessions || 0} ${t(lang, 'جلسه', 'sessions')} · ${c.reflections || 0} ${t(lang, 'بازنگری', 'reflect')}`;
          if (!window.confirm(t(lang, `این روز و ${summary} حذف می‌شوند. مطمئنی؟`, `This day and ${summary} will be deleted. Continue?`))) return;
          try { await JournalApi.dayDelete(data.record.id, true); ctx.navigate('/journal'); }
          catch (err) { msg(err.code, true); }
        }
      };

      root.querySelectorAll('[data-add]').forEach((b) => {
        b.onclick = () => openForm(b.dataset.add, null, data);
      });
      root.querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = () => {
          const kind = b.dataset.edit;
          const id = b.closest('.entry').dataset.id;
          const source = kind === 'obs' ? data.observations : kind === 'event' ? data.events : kind === 'session' ? data.sessions : data.reflections;
          openForm(kind, source.find((x) => x.id === id), data);
        };
      });
      root.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => {
          const kind = b.dataset.del;
          const id = b.closest('.entry').dataset.id;
          if (!window.confirm(t(lang, 'این بخش حذف شود؟', 'Delete this entry?'))) return;
          try { await JournalApi.remove(kind, id); await load(); }
          catch (e) { msg(e.code, true); }
        };
      });
    }

    function openForm(kind, item, snapshot) {
      const host = root.querySelector(`[data-sec="${kind}"]`);
      if (!host || host.querySelector('.inline-form')) return;
      const f = document.createElement('form');
      f.className = 'inline-form stack';
      const time = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '09:00');
      const isEdit = Boolean(item);

      const fields = {
        obs: `
          <div class="field"><label class="field__label">${t(lang, 'دسته', 'Category')}</label>
            <select class="select" name="state_category">${CATS.map((c) => `<option value="${c[0]}" ${item?.state_category === c[0] ? 'selected' : ''}>${c[lang === 'en' ? 2 : 1]}</option>`).join('')}</select></div>
          <div class="field"><label class="field__label">${t(lang, 'توضیح', 'Description')}</label>
            <textarea class="textarea" name="description" rows="2" required maxlength="2000">${esc(item?.description || '')}</textarea></div>
          <div class="field"><label class="field__label">${t(lang, 'شدت (۱ تا ۵، اختیاری)', 'Intensity (1-5, optional)')}</label>
            <input class="input num" type="number" min="1" max="5" name="intensity" inputmode="numeric"
              value="${item?.intensity ?? ''}" aria-describedby="intensity-hint"></div>
          <div class="field"><label class="field__label">${t(lang, 'زمان', 'Time')}</label>
            <input class="input num" type="time" name="time" value="${time(item?.observed_at)}"></div>`,
        event: `
          <div class="field"><label class="field__label">${t(lang, 'عنوان', 'Title')}</label>
            <input class="input" name="title" required maxlength="120" value="${esc(item?.title || '')}"></div>
          <div class="field"><label class="field__label">${t(lang, 'توضیح', 'Description')}</label>
            <textarea class="textarea" name="description" rows="2" maxlength="2000">${esc(item?.description || '')}</textarea></div>
          <div class="field"><label class="field__label">${t(lang, 'دسته (اختیاری)', 'Category (optional)')}</label>
            <input class="input" name="category" maxlength="40" value="${esc(item?.category || '')}"></div>
          <div class="field"><label class="field__label">${t(lang, 'زمان', 'Time')}</label>
            <input class="input num" type="time" name="time" value="${time(item?.event_time)}"></div>`,
        session: `
          <div class="field"><label class="field__label">${t(lang, 'بازار (اختیاری)', 'Market (optional)')}</label>
            <input class="input" name="market" maxlength="40" value="${esc(item?.market || '')}"></div>
          <div class="field"><label class="field__label">${t(lang, 'شروع', 'Start')}</label>
            <input class="input num" type="time" name="start" value="${time(item?.start_time)}"></div>
          <div class="field"><label class="field__label">${t(lang, 'پایان (اختیاری)', 'End (optional)')}</label>
            <input class="input num" type="time" name="end" value="${item?.end_time ? time(item.end_time) : ''}"></div>
          <div class="field"><label class="field__label">${t(lang, 'یادداشت', 'Note')}</label>
            <textarea class="textarea" name="note" rows="2" maxlength="2000">${esc(item?.note || '')}</textarea></div>`,
        reflection: `
          <div class="field"><label class="field__label">${t(lang, 'پرسش (اختیاری)', 'Question (optional)')}</label>
            <input class="input" name="question" maxlength="300" value="${esc(item?.question || '')}"></div>
          <div class="field"><label class="field__label">${t(lang, 'پاسخ', 'Response')}</label>
            <textarea class="textarea" name="response" rows="4" required maxlength="8000">${esc(item?.response || '')}</textarea></div>`,
      };

      f.innerHTML = `${fields[kind]}
        <div class="row" style="gap:8px;justify-content:flex-start">
          <button class="btn btn--primary btn--sm" type="submit">${t(lang, isEdit ? 'ذخیره' : 'افزودن', isEdit ? 'Save' : 'Add')}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-cancel>${t(lang, 'لغو', 'Cancel')}</button>
        </div>
        <p class="t-caption" data-form-msg hidden></p>`;

      host.prepend(f);
      f.querySelector('[data-cancel]').onclick = () => f.remove();
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(f);
        const payload = {};
        try {
          if (!snapshot?.record) await ensureDay();
          const sid = snapshot?.record?.id || (await JournalApi.dayGet(params.date)).record?.id;
          if (!sid) throw Object.assign(new Error('day_missing'), { code: 'day_missing' });
          if (kind === 'obs') {
            payload.state_category = fd.get('state_category');
            payload.description = fd.get('description');
            payload.intensity = fd.get('intensity') ? Number(fd.get('intensity')) : null;
            payload.observed_at = toIso(params.date, fd.get('time') || '09:00', ctx.profile?.timezone);
          }
          if (kind === 'event') {
            payload.title = fd.get('title');
            payload.description = fd.get('description');
            payload.category = fd.get('category');
            payload.event_time = toIso(params.date, fd.get('time') || '09:00', ctx.profile?.timezone);
          }
          if (kind === 'session') {
            payload.market = fd.get('market');
            payload.note = fd.get('note');
            payload.start_time = toIso(params.date, fd.get('start') || '09:00', ctx.profile?.timezone);
            payload.end_time = fd.get('end') ? toIso(params.date, fd.get('end'), ctx.profile?.timezone) : '';
          }
          if (kind === 'reflection') {
            payload.question = fd.get('question');
            payload.response = fd.get('response');
          }
          if (isEdit) await JournalApi.update(kind, item.id, payload);
          else await JournalApi.create(kind, { ...payload, daily_record_id: sid });
          await load();
        } catch (e) {
          const el = f.querySelector('[data-form-msg]');
          el.hidden = false;
          el.className = 'alert alert--negative';
          el.textContent = (e.fields && e.fields[0]) || e.code || e.message || 'error';
        }
      });
    }

    const reviewBtn = root.querySelector('#save-review');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', async () => {
        const msgEl = root.querySelector('#review-msg');
        reviewBtn.disabled = true;
        try {
          let recordId = (await JournalApi.dayGet(params.date)).record?.id;
          if (!recordId) throw Object.assign(new Error('day_missing'), { code: 'day_missing' });
          const fresh = await JournalApi.dayGet(params.date);
          const existing = fresh.reflections || [];
          for (let i = 0; i < REVIEW.length; i += 1) {
            const question = REVIEW[i][0];
            const response = (root.querySelector(`#rv-${i}`)?.value || '').trim();
            const foundRow = existing.find((x) => x.question === question);
            if (foundRow) {
              if ((foundRow.response || '') !== response) await JournalApi.update('reflection', foundRow.id, { question, response });
            } else if (response) {
              await JournalApi.create('reflection', { question, response, daily_record_id: recordId });
            }
          }
          msgEl.hidden = false;
          msgEl.className = 't-caption';
          msgEl.textContent = t(lang, 'ذخیره شد', 'Saved');
          await load();
        } catch (e) {
          msgEl.hidden = false;
          msgEl.className = 'alert alert--negative';
          msgEl.textContent = t(lang, 'ذخیره نشد: ', 'Not saved: ') + (e.code || e.message || 'error');
        } finally { reviewBtn.disabled = false; }
      });
    }

    load();
  },
};
