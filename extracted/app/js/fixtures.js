/* LOCAL-ONLY fixture store. Active only with ?test=1&fixtures=1 on localhost.
   It exists so UI layout can be reviewed without a session. It is NOT production
   data, NOT an authentication path, and must be deleted before release. */
const DAYS = [{ id: 'd1', record_date: '2026-11-05', title: 'روز اول', general_note: 'اولین ثبت واقعی روی سرویس مستقر. تمرکز روی فرآیند، نه نتیجه.', created_at: '2026-11-05T06:00:00.000Z' }];
const OBS = [{ id: 'o1', daily_record_id: 'd1', observed_at: '2026-11-05T05:45:00.000Z', state_category: 'mental', description: 'ذهن آرام بود، ولی توجه پراکنده شد.', intensity: 4 }];
const EVS = [{ id: 'e1', daily_record_id: 'd1', event_time: '2026-11-05T04:00:00.000Z', title: 'پیاده‌روی صبحگاهی', description: 'چهل دقیقه پیاده‌روی قبل از بازار.', category: 'health' }];
const SES = [{ id: 's1', daily_record_id: 'd1', start_time: '2026-11-05T04:30:00.000Z', end_time: '2026-11-05T07:30:00.000Z', market: 'XAUUSD', note: 'دو ورود، هر دو در ناحیه مشخص‌شده.' }];
const REF = [{ id: 'r1', daily_record_id: 'd1', question: 'امروز چه چیزی را باید می‌دیدم و ندیدم؟', response: 'به جای نتیجه، به فرآیند نگاه نکردم. فردا فقط اجرا را می‌سنجم.', created_at: '2026-11-05T12:00:00.000Z' }];

const KEY = 'monad.fixtures.store';
try {
  const saved = sessionStorage.getItem(KEY);
  if (saved) {
    const st = JSON.parse(saved);
    DAYS.splice(0, DAYS.length, ...(st.DAYS || DAYS));
    OBS.splice(0, OBS.length, ...(st.OBS || OBS));
    EVS.splice(0, EVS.length, ...(st.EVS || EVS));
    SES.splice(0, SES.length, ...(st.SES || SES));
    REF.splice(0, REF.length, ...(st.REF || REF));
  }
} catch (_) { /* ignore */ }
function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ DAYS, OBS, EVS, SES, REF })); } catch (_) { /* ignore */ }
}

const ok = (v) => Promise.resolve(v);
const notFound = () => Promise.reject(Object.assign(new Error('not_found'), { code: 'not_found' }));

export const Fixtures = {
  dayGet: (date) => {
    const record = DAYS.find((d) => d.record_date === date) || null;
    if (!record) return ok({ record: null, observations: [], events: [], sessions: [], reflections: [] });
    return ok({
      record,
      observations: OBS.filter((x) => x.daily_record_id === record.id),
      events: EVS.filter((x) => x.daily_record_id === record.id),
      sessions: SES.filter((x) => x.daily_record_id === record.id),
      reflections: REF.filter((x) => x.daily_record_id === record.id),
    });
  },
  dayUpsert: (date, fields) => {
    let r = DAYS.find((d) => d.record_date === date);
    if (!r) { r = { id: 'd' + (DAYS.length + 1), record_date: date, title: '', general_note: '', created_at: new Date().toISOString() }; DAYS.push(r); }
    if ('title' in fields) r.title = fields.title;
    if ('general_note' in fields) r.general_note = fields.general_note;
    persist();
    return ok({ record: r, created: false });
  },
  dayDelete: (id, confirm) => (confirm ? ok({ deleted: id }) : Promise.reject(Object.assign(new Error('confirmation_required'), {
    code: 'confirmation_required', children: { observations: 1, events: 1, sessions: 1, reflections: 1 },
  }))),
  dayList: ({ limit = 30, offset = 0, from } = {}) => {
    const all = [...DAYS].sort((a, b) => (a.record_date < b.record_date ? 1 : -1)).filter((r) => !from || r.record_date >= from);
    const slice = all.slice(offset, offset + limit);
    return ok({ records: slice, count: slice.length, limit, offset, has_more: all.length > offset + limit, next_offset: all.length > offset + limit ? offset + limit : null });
  },
  exportBackup: () => ok({ export: {
    schema: 'monad.journal.export/1', app: 'MONAD', exported_at: new Date().toISOString(), owner_id: 'fixture',
    profile: null, counts: { days: DAYS.length, observations: OBS.length, events: EVS.length, sessions: SES.length, reflections: REF.length },
    days: DAYS.map((d) => ({ ...d, observations: OBS.filter((o) => o.daily_record_id === d.id), events: EVS.filter((o) => o.daily_record_id === d.id), sessions: SES.filter((o) => o.daily_record_id === d.id), reflections: REF.filter((o) => o.daily_record_id === d.id) })),
  } }),
  daySweep: () => ok({ found: 0, purged: 0 }),
  /* Phase 3 fixtures — localhost-only, never shipped as real trades */
  accounts: () => ok({ accounts: [{ id: 'acc1', login: '51234567', broker: 'PropDesk Capital', server: 'PropDesk-Live', currency: 'USD', balance: 10240.75, equity: 10210.1, dd_used_pct: 2.3, account_type: 'prop', last_import_at: '2026-11-05T16:47:29.000Z' }] }),
  updateAccount: (id, patch) => ok({ account: { id, ...patch } }),
  trades: ({ limit = 30, offset = 0, from = '', to = '' } = {}) => {
    const all = [
      { id: 't1', symbol: 'XAUUSD', direction: 'buy', status: 'closed', local_date: '2026-11-05', opened_at: '2026-11-05T05:45:00.000Z', volume_initial: 0.1, realized: 120.5, r_multiple: 2.41, r_source: 'CONFIRMED', uncertain: false },
      { id: 't2', symbol: 'EURUSD', direction: 'sell', status: 'closed', local_date: '2026-11-05', opened_at: '2026-11-05T07:30:00.000Z', volume_initial: 0.2, realized: -40, r_multiple: -1, r_source: 'CONFIRMED', uncertain: false },
      { id: 't3', symbol: 'GBPUSD', direction: 'buy', status: 'open', local_date: '2026-11-05', opened_at: '2026-11-05T10:35:00.000Z', volume_initial: 0.1, realized: 0, r_multiple: 0, r_source: 'CONFIRMED', uncertain: false },
      { id: 't5', symbol: 'NAS100', direction: 'sell', status: 'closed', local_date: '2026-11-06', opened_at: '2026-11-05T21:00:00.000Z', volume_initial: 0.3, realized: 135, r_multiple: 1.5, r_source: 'CONFIRMED', uncertain: false },
    ];
    const ranged = all.filter((r) => (!from || r.local_date >= from) && (!to || r.local_date <= to));
    const slice = ranged.slice(offset, offset + limit);
    return ok({ trades: slice, has_more: ranged.length > offset + limit, next_offset: offset + limit, limit, offset });
  },
  trade: (id) => ok({
    trade: { id, symbol: 'XAUUSD', direction: 'buy', status: 'closed', account_login: '51234567', local_date: '2026-11-05',
      opened_at: '2026-11-05T05:45:00.000Z', closed_at: '2026-11-05T06:32:00.000Z', server_open_time: '2026.11.05 09:15:00', server_close_time: '2026.11.05 10:02:00',
      gmt_offset_min: 210, entry_price: 2650.25, stop_loss: 2645.25, take_profit: 2665.25, volume_initial: 0.1, volume_closed: 0.1,
      balance_at_open: 10000, risk_pct: 0.5, r0: 50, r0_source: 'CONFIRMED', realized: 120.5, return_pct: 1.205, r_multiple: 2.41, has_estimate: false,
      mae_price: 2647.1, mfe_price: 2672.4, mae_money: 31.5, mfe_money: 222.5, exit_efficiency: 0.5417,
      close_reason: 'tp', realized_swap: 0, realized_commission: 0, deals_in: 1, deals_out: 1, generation: 0,
      note: 'انتظار برگشت از کف', ea_note: 'EA v3', user_note: 'یادداشت شخصی من', checklist: '1. جهت H4 2. نواحی', actions: JSON.stringify([{ ts: '2026.11.05 09:16:00', act: 'OPEN', vol_after: 0.1, violation: false }]),
      raw: '{"id":"P101","pos":101}', import_job_id: 'job1', uncertain: false },
    images: ['entry:reference_only:H1','entry:reference_only:M15','entry:missing:M1','exit:reference_only:H1','exit:missing:M15','exit:missing:M1'].map((x) => {
      const [phase, status, timeframe] = x.split(':');
      return { phase, status, timeframe, ref: status !== 'missing' ? `images/P101/${phase}_${timeframe}.png` : '' };
    }),
  }),
  saveNote: (id, note) => ok({ trade: { id, note } }),
  jobs: () => ok({ jobs: [{ id: 'job1', status: 'completed_with_errors', started_at: '2026-11-05T16:47:20.000Z', finished_at: '2026-11-05T16:47:29.000Z', created_count: 5, updated_count: 0, unchanged_count: 0, duplicate_count: 0, rejected_count: 1, unprocessed_count: 0, read_count: 6, total_count: 6, stale: false, schema_version: 4, source_name: 'journal_data.js', errors: '[{"index":5,"id":"P106","reason":"sym is required"}]' }] }),
  importPd: (payload) => ok({ summary: { read: 2, created: 2, updated: 0, duplicate: 0, rejected: 0, images_present: 6, images_missing: 6, account_login: '51234567', schema: 4, errors: [] } }),
  strategies: () => ok({ strategies: [] }),
  create: (kind, f) => {
    const map = { obs: OBS, event: EVS, session: SES, reflection: REF };
    const item = { id: kind + Date.now(), ...f };
    map[kind].push(item);
    persist();
    return ok({ item });
  },
  update: (kind, id, f) => {
    const map = { obs: OBS, event: EVS, session: SES, reflection: REF };
    const row = map[kind].find((x) => x.id === id);
    if (!row) return notFound();
    Object.assign(row, f);
    persist();
    return ok({ item: row });
  },
  remove: (kind, id) => {
    const map = { obs: OBS, event: EVS, session: SES, reflection: REF };
    const arr = map[kind];
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return notFound();
    arr.splice(i, 1);
    persist();
    return ok({ deleted: id });
  },
  timeline: () => ok({
    items: [
      { type: 'reflection', id: 'r1', at: '2026-11-05T12:00:00.000Z', date: '2026-11-05', title: 'بازنگری', excerpt: 'به جای نتیجه، به فرآیند نگاه نکردم.' },
      { type: 'observation', id: 'o1', at: '2026-11-05T05:45:00.000Z', date: '2026-11-05', title: 'mental', excerpt: 'ذهن آرام بود، ولی توجه پراکنده شد.' },
      { type: 'session', id: 's1', at: '2026-11-05T04:30:00.000Z', date: '2026-11-05', title: 'XAUUSD', excerpt: 'دو ورود، هر دو در ناحیه مشخص‌شده.' },
      { type: 'event', id: 'e1', at: '2026-11-05T04:00:00.000Z', date: '2026-11-05', title: 'پیاده‌روی صبحگاهی', excerpt: 'چهل دقیقه پیاده‌روی قبل از بازار.' },
    ],
    count: 4,
  }),
  calendar: (from, to) => ok({
    days: DAYS.filter((d) => d.record_date >= from && d.record_date <= to).map((d) => ({
      date: d.record_date, record_id: d.id,
      counts: { observations: OBS.length, events: EVS.length, sessions: SES.length, reflections: REF.length },
      has_note: Boolean(d.general_note),
    })),
  }),
};

/* Read the flag once: after the first pushState the query string is gone. */
const FLAG = (() => {
  try {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const q = new URLSearchParams(location.search).get('fixtures') === '1';
    if (local && q) sessionStorage.setItem('monad.fixtures.on', '1');
    return local && (q || sessionStorage.getItem('monad.fixtures.on') === '1');
  } catch (_) { return false; }
})();

export const fixturesEnabled = () => FLAG;
