/**
 * monadJournal — Phase 2.5 service for the five journal collections.
 * Owner always comes from the session. A body owner_id that differs is rejected.
 * Phase 2.5: cursor/offset pagination with no silent ceiling, idempotent day writes,
 * duplicate settling, tombstone-first deletes, whole-history backup export.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

let SEQ = 0;
function audit(event: string, outcome: string, userId: string | null, extra: Record<string, any> = {}) {
  console.log(JSON.stringify({
    t: 'monad.journal', seq: ++SEQ, at: new Date().toISOString(),
    event, outcome, user: userId ? String(userId).slice(0, 8) : null, ...extra,
  }));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;
const CATS = ['physical', 'mental', 'emotional', 'environmental', 'other'];
const isDay = (v: any) => typeof v === 'string' && DAY_RE.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isIso = (v: any) => typeof v === 'string' && ISO_RE.test(v) && !Number.isNaN(Date.parse(v));
const str = (v: any, max: number) => (v === undefined || v === null ? '' : String(v).slice(0, max));
const opt = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? '' : String(v).trim().slice(0, max));

const PAGE_MAX = 200;
const DAY_CAP = 5000;
const CHILD = ['StateObservation', 'LifeEvent', 'TradingSession', 'Reflection'];

async function rawDays(base44: any, userId: string, query: Record<string, any> = {}, limit = PAGE_MAX, skip = 0) {
  const rows = await base44.entities.DailyRecord.filter({ owner_id: userId, ...query }, '-record_date', limit, skip);
  const arr = Array.isArray(rows) ? rows : (rows?.items ?? []);
  return arr.filter((r: any) => r.owner_id === userId);
}
/* live rows only: a tombstoned day never reaches a read path */
async function ownedDays(base44: any, userId: string, query = {}, limit = PAGE_MAX, skip = 0) {
  return (await rawDays(base44, userId, query, limit, skip)).filter((r: any) => !r.deleted_at);
}
async function allDays(base44: any, userId: string) {
  const out: any[] = [];
  let skip = 0;
  while (skip < DAY_CAP) {
    const chunk = await ownedDays(base44, userId, {}, PAGE_MAX, skip);
    out.push(...chunk);
    if (chunk.length < PAGE_MAX) break;
    skip += PAGE_MAX;
  }
  return out;
}

/* one write at a time per owner+date inside this instance */
const queues = new Map<string, Promise<any>>();
function withLock(key: string, fn: () => Promise<any>) {
  const prev = queues.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(() => {}, () => {});
  queues.set(key, tail);
  tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
  return run;
}

async function dayById(base44: any, userId: string, id: string) {
  if (!id) return null;
  const page = await base44.entities.DailyRecord.filter({ id }, { limit: 1 });
  const row = (page?.items ?? [])[0];
  if (!row || row.owner_id !== userId) return null;
  return row;
}
async function kids(base44: any, entity: string, dayId: string, userId: string) {
  const page = await base44.entities[entity].filter({ daily_record_id: dayId }, { limit: 200 });
  return (page?.items ?? []).filter((r: any) => r.owner_id === userId && r.daily_record_id === dayId);
}
async function childOwned(base44: any, entity: string, id: string, userId: string) {
  if (!id) return null;
  const page = await base44.entities[entity].filter({ id }, { limit: 1 });
  const row = (page?.items ?? [])[0];
  if (!row || row.owner_id !== userId) return null;
  return row;
}
async function countChildren(base44: any, dayId: string, userId: string) {
  const lists = await Promise.all(CHILD.map((e) => kids(base44, e, dayId, userId)));
  return {
    observations: lists[0].length, events: lists[1].length,
    sessions: lists[2].length, reflections: lists[3].length,
  };
}
async function cascadeDelete(base44: any, dayId: string, userId: string) {
  const lists = await Promise.all(CHILD.map((e) => kids(base44, e, dayId, userId)));
  let n = 0;
  for (let i = 0; i < CHILD.length; i += 1) {
    for (const row of lists[i]) { await base44.entities[CHILD[i]].delete(row.id); n += 1; }
  }
  return n;
}

/* duplicates for one date collapse into the oldest row; children are re-parented */
async function settleDay(base44: any, userId: string, date: string) {
  const rows = await ownedDays(base44, userId, { record_date: date });
  if (rows.length <= 1) return rows[0] ?? null;
  const ordered = [...rows].sort((a: any, b: any) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)));
  const keep = ordered[0];
  for (const extra of ordered.slice(1)) {
    for (const entity of CHILD) {
      for (const row of await kids(base44, entity, extra.id, userId)) {
        await base44.entities[entity].update(row.id, { daily_record_id: keep.id });
      }
    }
    await base44.entities.DailyRecord.delete(extra.id);
  }
  audit('day.settle', 'duplicates_removed', userId, { date, removed: ordered.length - 1 });
  return keep;
}

const SPEC: Record<string, { entity: string }> = {
  obs: { entity: 'StateObservation' },
  event: { entity: 'LifeEvent' },
  session: { entity: 'TradingSession' },
  reflection: { entity: 'Reflection' },
};

function validate(kind: string, src: any, creating: boolean) {
  const errors: string[] = [];
  const out: Record<string, any> = {};
  const put = (k: string, v: any) => { if (v !== undefined) out[k] = v; };

  if (kind === 'event') {
    if (creating || 'title' in src) {
      const title = str(src.title, 120).trim();
      if (!title) errors.push('title is required');
      put('title', title);
    }
    if (creating || 'event_time' in src) {
      if (!isIso(src.event_time)) errors.push('event_time must be an ISO timestamp');
      put('event_time', src.event_time);
    }
    put('description', str(src.description, 2000));
    put('category', opt(src.category, 40));
  }

  if (kind === 'obs') {
    if (creating || 'state_category' in src) {
      if (!CATS.includes(src.state_category)) errors.push('state_category must be physical|mental|emotional|environmental|other');
      put('state_category', src.state_category);
    }
    if (creating || 'observed_at' in src) {
      if (!isIso(src.observed_at)) errors.push('observed_at must be an ISO timestamp');
      put('observed_at', src.observed_at);
    }
    if (creating || 'description' in src) {
      const desc = str(src.description, 2000).trim();
      if (!desc) errors.push('description is required');
      put('description', desc);
    }
    /* intensity is a subjective self-report on a 1..5 scale, not a measured score */
    if ('intensity' in src) {
      if (src.intensity === null || src.intensity === '') put('intensity', null);
      else {
        const n = Number(src.intensity);
        if (!Number.isFinite(n) || n < 1 || n > 5) errors.push('intensity must be between 1 and 5');
        else put('intensity', n);
      }
    }
  }

  if (kind === 'session') {
    if (creating || 'start_time' in src) {
      if (!isIso(src.start_time)) errors.push('start_time must be an ISO timestamp');
      put('start_time', src.start_time);
    }
    if ('end_time' in src) {
      if (src.end_time === null || src.end_time === '') put('end_time', '');
      else if (!isIso(src.end_time)) errors.push('end_time must be an ISO timestamp');
      else put('end_time', src.end_time);
    }
    if (creating && out.start_time && out.end_time && Date.parse(out.end_time) < Date.parse(out.start_time)) {
      errors.push('end_time must not precede start_time');
    }
    put('market', opt(src.market, 40));
    put('note', str(src.note, 2000));
  }

  if (kind === 'reflection') {
    if (creating || 'response' in src) {
      const response = str(src.response, 8000).trim();
      if (!response) errors.push('response is required');
      put('response', response);
    }
    put('question', opt(src.question, 300));
  }

  return { out, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);

  const base44 = createClientFromRequest(req);
  let me = null;
  try { me = await base44.auth.me(); } catch (_) { me = null; }
  if (!me?.id) { audit('auth.verify', 'denied_unauthenticated', null); return json({ ok: false, code: 'unauthenticated' }, 401); }
  const userId = String(me.id);

  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }

  if (body.owner_id && String(body.owner_id) !== userId) {
    audit('authorization', 'denied_owner_mismatch', userId);
    return json({ ok: false, code: 'ownership_spoof_rejected' }, 403);
  }

  const action = String(body.action || '');

  try {
    if (action === 'day.get') {
      if (!isDay(body.date)) return json({ ok: false, code: 'invalid_date' }, 422);
      let rows = await ownedDays(base44, userId, { record_date: body.date });
      if (rows.length > 1) { const kept = await settleDay(base44, userId, body.date); rows = kept ? [kept] : []; }
      const record = rows[0] ?? null;
      if (!record) return json({ ok: true, record: null, observations: [], events: [], sessions: [], reflections: [] });
      const lists = await Promise.all(CHILD.map((e) => kids(base44, e, record.id, userId)));
      return json({ ok: true, record, observations: lists[0], events: lists[1], sessions: lists[2], reflections: lists[3] });
    }

    if (action === 'day.upsert') {
      if (!isDay(body.date)) return json({ ok: false, code: 'invalid_date' }, 422);
      return withLock(`${userId}:${body.date}`, async () => {
        let rows = await ownedDays(base44, userId, { record_date: body.date });
        if (rows.length > 1) { const kept = await settleDay(base44, userId, body.date); rows = kept ? [kept] : []; }
        const now = new Date().toISOString();
        if (rows.length) {
          const patch: any = { updated_at: now };
          if ('title' in body) patch.title = str(body.title, 120).trim();
          if ('general_note' in body) patch.general_note = str(body.general_note, 8000);
          const updated = await base44.entities.DailyRecord.update(rows[0].id, patch);
          audit('day.upsert', 'updated', userId);
          return json({ ok: true, record: updated, created: false });
        }
        const created = await base44.entities.DailyRecord.create({
          owner_id: userId, record_date: body.date,
          title: str(body.title, 120).trim(), general_note: str(body.general_note, 8000),
          created_at: now, updated_at: now,
        });
        const after = await ownedDays(base44, userId, { record_date: body.date });
        if (after.length > 1) {
          const kept = await settleDay(base44, userId, body.date);
          audit('day.upsert', 'created_raced_settled', userId);
          return json({ ok: true, record: kept, created: true, settled: true });
        }
        audit('day.upsert', 'created', userId);
        return json({ ok: true, record: created, created: true });
      });
    }

    if (action === 'day.update') {
      const row = await dayById(base44, userId, body.id);
      if (!row || row.deleted_at) { audit('day.update', 'not_found_or_foreign', userId); return json({ ok: false, code: 'not_found' }, 404); }
      const patch: any = { updated_at: new Date().toISOString() };
      const source = body.patch ?? body;
      if ('title' in source) patch.title = str(source.title, 120).trim();
      if ('general_note' in source) patch.general_note = str(source.general_note, 8000);
      if ('record_date' in source) {
        if (!isDay(source.record_date)) return json({ ok: false, code: 'invalid_date' }, 422);
        const clash = await ownedDays(base44, userId, { record_date: source.record_date });
        if (clash.some((r: any) => r.id !== row.id)) return json({ ok: false, code: 'date_conflict' }, 409);
        patch.record_date = source.record_date;
      }
      const updated = await base44.entities.DailyRecord.update(row.id, patch);
      audit('day.update', 'ok', userId);
      return json({ ok: true, record: updated });
    }

    if (action === 'day.delete') {
      const row = await dayById(base44, userId, body.id);
      if (!row || row.deleted_at) { audit('day.delete', 'not_found_or_foreign', userId); return json({ ok: false, code: 'not_found' }, 404); }
      if (body.confirm !== true) {
        audit('day.delete', 'confirmation_required', userId);
        return json({ ok: false, code: 'confirmation_required', children: await countChildren(base44, row.id, userId) }, 409);
      }
      /* tombstone first: the day leaves every read path before the cascade runs */
      await base44.entities.DailyRecord.update(row.id, { deleted_at: new Date().toISOString() });
      let removed = 0;
      let purged = false;
      try {
        removed = await cascadeDelete(base44, row.id, userId);
        await base44.entities.DailyRecord.delete(row.id);
        purged = true;
      } catch (e) {
        audit('day.delete', 'cascade_failed', userId, { message: String(e?.message || e).slice(0, 80) });
      }
      audit('day.delete', purged ? 'deleted' : 'tombstoned', userId, { children: removed });
      return json({ ok: true, deleted: row.id, children: removed, purged, ...(purged ? {} : { pending_purge: true }) });
    }

    if (action === 'day.list') {
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), PAGE_MAX);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const rows = await ownedDays(base44, userId, {}, limit + 1, offset);
      const has_more = rows.length > limit;
      const records = rows.slice(0, limit)
        .filter((r: any) => (isDay(body.from) ? r.record_date >= body.from : true))
        .filter((r: any) => (isDay(body.to) ? r.record_date <= body.to : true));
      audit('day.list', 'ok', userId, { limit, offset, has_more });
      return json({ ok: true, records, count: records.length, limit, offset, has_more, next_offset: has_more ? offset + limit : null });
    }

    if (action === 'day.sweep') {
      const raw = await rawDays(base44, userId, {}, PAGE_MAX, 0);
      const dead = raw.filter((r: any) => r.deleted_at);
      let purged = 0;
      for (const row of dead) {
        try { await cascadeDelete(base44, row.id, userId); await base44.entities.DailyRecord.delete(row.id); purged += 1; } catch (_) { /* stays tombstoned */ }
      }
      return json({ ok: true, found: dead.length, purged });
    }

    if (action === 'export.backup') {
      const days = await allDays(base44, userId);
      const out: any[] = [];
      for (const d of days) {
        const lists = await Promise.all(CHILD.map((e) => kids(base44, e, d.id, userId)));
        out.push({ ...d, observations: lists[0], events: lists[1], sessions: lists[2], reflections: lists[3] });
      }
      let profile = null;
      try {
        const res = await base44.entities.UserProfile.filter({ owner_id: userId }, '-created_date', 1, 0);
        profile = (Array.isArray(res) ? res : (res?.items ?? []))[0] ?? null;
      } catch (_) { profile = null; }
      const counts = out.reduce((acc: any, d: any) => {
        acc.days += 1;
        acc.observations += d.observations.length; acc.events += d.events.length;
        acc.sessions += d.sessions.length; acc.reflections += d.reflections.length;
        return acc;
      }, { days: 0, observations: 0, events: 0, sessions: 0, reflections: 0 });
      audit('export.backup', 'ok', userId, counts);
      return json({ ok: true, export: {
        schema: 'monad.journal.export/1', app: 'MONAD',
        exported_at: new Date().toISOString(), owner_id: userId,
        profile, counts, days: out,
      } });
    }

    const childMatch = action.match(/^(obs|event|session|reflection)\.(create|update|delete)$/);
    if (childMatch) {
      const kind = childMatch[1];
      const op = childMatch[2];
      const entity = SPEC[kind].entity;

      if (op === 'create') {
        const parent = await dayById(base44, userId, body.daily_record_id || body.day_id);
        if (!parent || parent.deleted_at) { audit(`${kind}.create`, 'parent_not_owned', userId); return json({ ok: false, code: 'not_found' }, 404); }
        const { out, errors } = validate(kind, body, true);
        if (errors.length) return json({ ok: false, code: 'validation_failed', errors }, 422);
        const now = new Date().toISOString();
        const created = await base44.entities[entity].create({
          ...out, owner_id: userId, daily_record_id: parent.id, created_at: now,
          ...(kind === 'reflection' ? { updated_at: now } : {}),
        });
        audit(`${kind}.create`, 'ok', userId);
        return json({ ok: true, item: created });
      }

      if (op === 'update') {
        const row = await childOwned(base44, entity, body.id, userId);
        if (!row) { audit(`${kind}.update`, 'not_found_or_foreign', userId); return json({ ok: false, code: 'not_found' }, 404); }
        const { out, errors } = validate(kind, body, false);
        if (errors.length) return json({ ok: false, code: 'validation_failed', errors }, 422);
        const nextStart = out.start_time ?? row.start_time;
        const nextEnd = out.end_time ?? row.end_time;
        if (kind === 'session' && nextEnd && nextStart && Date.parse(nextEnd) < Date.parse(nextStart)) {
          return json({ ok: false, code: 'validation_failed', errors: ['end_time must not precede start_time'] }, 422);
        }
        const updated = await base44.entities[entity].update(row.id, {
          ...out, ...(kind === 'reflection' ? { updated_at: new Date().toISOString() } : {}),
        });
        audit(`${kind}.update`, 'ok', userId);
        return json({ ok: true, item: updated });
      }

      const row = await childOwned(base44, entity, body.id, userId);
      if (!row) { audit(`${kind}.delete`, 'not_found_or_foreign', userId); return json({ ok: false, code: 'not_found' }, 404); }
      await base44.entities[entity].delete(row.id);
      audit(`${kind}.delete`, 'deleted', userId);
      return json({ ok: true, deleted: row.id });
    }

    if (action === 'timeline') {
      const limit = Math.min(Number(body.limit) || 100, 500);
      const days = (await allDays(base44, userId))
        .filter((d: any) => (isDay(body.from) ? d.record_date >= body.from : true))
        .filter((d: any) => (isDay(body.to) ? d.record_date <= body.to : true));
      const perDay = await Promise.all(days.map(async (d: any) => {
        const lists = await Promise.all(CHILD.map((e) => kids(base44, e, d.id, userId)));
        return { d, obs: lists[0], evs: lists[1], ses: lists[2], refs: lists[3] };
      }));
      const feed: any[] = [];
      for (const { d, obs, evs, ses, refs } of perDay) {
        const anchor = d.record_date + 'T00:00:00.000Z';
        feed.push({ type: 'day', id: d.id, at: d.created_at || anchor, date: d.record_date, title: d.title || '', excerpt: (d.general_note || '').slice(0, 120), record_id: d.id });
        obs.forEach((o: any) => feed.push({ type: 'observation', id: o.id, at: o.observed_at, date: d.record_date, title: o.state_category, excerpt: (o.description || '').slice(0, 120), record_id: d.id, category: o.state_category }));
        evs.forEach((e: any) => feed.push({ type: 'event', id: e.id, at: e.event_time, date: d.record_date, title: e.title || '', excerpt: (e.description || '').slice(0, 120), record_id: d.id }));
        ses.forEach((s: any) => feed.push({ type: 'session', id: s.id, at: s.start_time, date: d.record_date, title: s.market || 'session', excerpt: (s.note || '').slice(0, 120), record_id: d.id }));
        refs.forEach((r: any) => feed.push({ type: 'reflection', id: r.id, at: r.created_at || anchor, date: d.record_date, title: r.question || 'reflection', excerpt: (r.response || '').slice(0, 120), record_id: d.id }));
      }
      feed.sort((a, b) => (String(a.at) < String(b.at) ? 1 : String(a.at) > String(b.at) ? -1 : 0));
      const items = feed.slice(0, limit);
      return json({ ok: true, items, count: items.length, total: feed.length, truncated: feed.length > limit });
    }

    if (action === 'calendar') {
      if (!isDay(body.from) || !isDay(body.to)) return json({ ok: false, code: 'invalid_range' }, 422);
      const days = (await allDays(base44, userId)).filter((d: any) => d.record_date >= body.from && d.record_date <= body.to);
      const out: any[] = [];
      for (const d of days) {
        const lists = await Promise.all(CHILD.map((e) => kids(base44, e, d.id, userId)));
        out.push({
          date: d.record_date, record_id: d.id,
          counts: { observations: lists[0].length, events: lists[1].length, sessions: lists[2].length, reflections: lists[3].length },
          has_note: Boolean((d.general_note || '').trim()),
        });
      }
      return json({ ok: true, days: out });
    }

    return json({ ok: false, code: 'unknown_action' }, 400);
  } catch (e: any) {
    audit('request', 'server_error', userId, { action: action.slice(0, 40), message: String(e?.message || e).slice(0, 120) });
    return json({ ok: false, code: 'server_error', message: String(e?.message || e) }, 500);
  }
});
