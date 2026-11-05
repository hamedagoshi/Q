import { Fixtures, fixturesEnabled } from './fixtures.js';

/* MONAD — profile API client (server derives ownership; never sends owner_id) */
const ENDPOINT = '/functions/monadProfile';

async function call(payload) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.code || `http_${res.status}`);
    err.code = data?.code || `http_${res.status}`;
    err.status = res.status;
    err.fields = data?.errors || [];
    throw err;
  }
  return data;
}

export const ProfileApi = {
  bootstrap: () => call({ action: 'bootstrap' }),
  get: () => call({ action: 'get' }),
  update: (patch) => call({ action: 'update', patch }),
};


const JOURNAL = '/functions/monadJournal';

async function jcall(payload) {
  const res = await fetch(JOURNAL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.code || ('http_' + res.status));
    err.code = data?.code || ('http_' + res.status);
    err.status = res.status;
    err.fields = data?.errors || [];
    err.children = data?.children || null;
    throw err;
  }
  return data;
}

const F = () => fixturesEnabled();
const fx = (name, args) => Fixtures[name](...args);

export const TradeApi = {
  accounts: () => (F() ? fx('accounts', []) : jcall({ action: 'account.list' })),
  updateAccount: (id, patch) => (F() ? fx('updateAccount', [id, patch]) : jcall({ action: 'account.update', id, ...patch })),
  trades: (opts = {}) => (F() ? fx('trades', [opts]) : jcall({ action: 'trade.list', ...opts })),
  trade: (id) => (F() ? fx('trade', [id]) : jcall({ action: 'trade.get', id })),
  saveNote: (id, note) => (F() ? fx('saveNote', [id, note]) : jcall({ action: 'trade.note', id, note })),
  jobs: () => (F() ? fx('jobs', []) : jcall({ action: 'import.list' })),
  importPd: (payload, sourceName) => (F() ? fx('importPd', [payload, sourceName]) : jcall({ action: 'import.pd', payload, source_name: sourceName })),
};

export const JournalApi = {
  dayGet: (date) => (F() ? fx('dayGet', [date]) : jcall({ action: 'day.get', date })),
  dayUpsert: (date, fields) => (F() ? fx('dayUpsert', [date, fields]) : jcall({ action: 'day.upsert', date, ...fields })),
  dayUpdate: (id, patch) => (F() ? fx('update', ['day', id, patch]) : jcall({ action: 'day.update', id, patch })),
  dayDelete: (id, confirm = false) => (F() ? fx('dayDelete', [id, confirm]) : jcall({ action: 'day.delete', id, confirm })),
  dayList: (opts = {}) => (F() ? fx('dayList', [opts]) : jcall({ action: 'day.list', ...opts })),
  exportBackup: () => (F() ? fx('exportBackup', []) : jcall({ action: 'export.backup' })),
  daySweep: () => (F() ? fx('daySweep', []) : jcall({ action: 'day.sweep' })),
  create: (kind, fields) => (F() ? fx('create', [kind, fields]) : jcall({ action: kind + '.create', ...fields })),
  update: (kind, id, fields) => (F() ? fx('update', [kind, id, fields]) : jcall({ action: kind + '.update', id, ...fields })),
  remove: (kind, id) => (F() ? fx('remove', [kind, id]) : jcall({ action: kind + '.delete', id })),
  timeline: (opts = {}) => (F() ? fx('timeline', [opts]) : jcall({ action: 'timeline', ...opts })),
  calendar: (from, to) => (F() ? fx('calendar', [from, to]) : jcall({ action: 'calendar', from, to })),
};

/* ---------- date helpers: stored strings stay strings; display is tz-aware ---------- */
export function todayIn(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

/* One authority for "a wall-clock time on a calendar day, in the user's timezone".
   The device timezone is never consulted when a profile timezone is supplied. */
export function toIso(dateStr, timeStr = '00:00', tz) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  const tm = /^(\d{2}):(\d{2})/.exec(String(timeStr));
  if (!dm || !tm) return null;
  const [y, mo, d] = [+dm[1], +dm[2], +dm[3]];
  const [hh, mm] = [+tm[1], +tm[2]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  if (!tz) {
    const local = new Date(`${dateStr}T${timeStr}:00`);
    return Number.isNaN(local.getTime()) ? null : local.toISOString();
  }
  const offsetMs = (utcMs) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
    return asUtc - utcMs;
  };
  const guess = Date.UTC(y, mo - 1, d, hh, mm, 0);
  let utc = guess - offsetMs(guess);
  utc = guess - offsetMs(utc); /* second pass settles DST edges */
  return new Date(utc).toISOString();
}

export function fmtTime(iso, tz, lang = 'fa') {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
      timeZone: tz || undefined, hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch (_) { return iso.slice(11, 16); }
}

export function fmtDate(day, lang = 'fa') {
  if (!day) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(day + 'T00:00:00Z'));
  } catch (_) { return day; }
}
