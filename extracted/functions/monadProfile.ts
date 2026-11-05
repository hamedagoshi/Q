/**
 * monadProfile — Phase 1.3 profile service.
 *
 * Ownership rule: the owner is ALWAYS the authenticated server-side session user
 * (base44.auth.me().id). A client-supplied owner_id is never trusted; sending a
 * different one is rejected with 403 ownership_spoof_rejected.
 *
 * Endpoints (POST, body.action):
 *   bootstrap  create-if-missing, else reuse. Idempotent, concurrency-safe.
 *   get        read own profile (or null)
 *   update     patch own profile (ownership re-checked in the same query)
 *   delete     remove own profile — exists for the Phase 1.3 §8 ownership test only.
 *              No UI exposes it; profile deletion is out of scope for this phase.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/**
 * Audit trail. Structured, deterministic, and free of secrets: no password, no
 * token, no email, no request headers. Only an opaque user id + event + outcome.
 * Retrievable with the function log viewer.
 */
let REQUEST_SEQ = 0;
function audit(event: string, outcome: string, userId: string | null, extra: Record<string, any> = {}) {
  const entry = {
    t: 'monad.security',
    seq: ++REQUEST_SEQ,
    at: new Date().toISOString(),
    event,
    outcome,
    user: userId ? userId.slice(0, 8) : null,   // truncated reference, not an identifier dump
    ...extra,
  };
  console.log(JSON.stringify(entry));
  return entry;
}

/**
 * Per-user in-process mutex. Reduces the window in which two requests handled by the
 * same isolate can both pass the "no profile" check. It is NOT a distributed lock and
 * is NOT a uniqueness guarantee — see SECURITY.md §4.
 */
const LOCKS = new Map<string, Promise<any>>();
async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = LOCKS.get(userId) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  const tail = prev.then(() => gate);
  LOCKS.set(userId, tail);
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (LOCKS.get(userId) === tail) LOCKS.delete(userId);
  }
}

const LANGS = ['fa', 'en'];
const THEMES = ['dark', 'light', 'system'];
const TZ_RE = /^[A-Za-z][A-Za-z0-9_+-]{0,39}(\/[A-Za-z0-9_+-]{1,40}){0,2}$/;

type Row = Record<string, any>;

function validatePatch(src: Row) {
  const out: Row = {};
  const errors: string[] = [];
  if ('display_name' in src) {
    const v = String(src.display_name ?? '').trim();
    if (v.length > 60) errors.push('display_name too long (max 60)');
    out.display_name = v;
  }
  if ('language' in src) {
    if (!LANGS.includes(src.language)) errors.push('language must be fa|en');
    else out.language = src.language;
  }
  if ('theme' in src) {
    if (!THEMES.includes(src.theme)) errors.push('theme must be dark|light|system');
    else out.theme = src.theme;
  }
  if ('timezone' in src) {
    if (typeof src.timezone !== 'string' || !TZ_RE.test(src.timezone)) {
      errors.push('timezone must be an IANA identifier such as Asia/Tehran');
    } else out.timezone = src.timezone;
  }
  return { out, errors };
}

/** Rows for one owner, oldest first. RLS already limits this to the caller. */
async function rowsFor(base44: any, ownerId: string): Promise<Row[]> {
  const page = await base44.entities.UserProfile.filter(
    { owner_id: ownerId },
    { sort: 'created_date', limit: 20 },
  );
  return (page?.items ?? []).filter((r: Row) => r.owner_id === ownerId);
}

/** Keep the oldest row, remove accidental duplicates from a concurrent bootstrap. */
async function settle(base44: any, rows: Row[]) {
  const [keep, ...extra] = rows;
  for (const r of extra) {
    try { await base44.entities.UserProfile.delete(r.id); } catch (_) { /* best effort */ }
  }
  return keep;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);

  const base44 = createClientFromRequest(req);

  // 1. server-side identity — the only source of ownership
  let me: Row | null = null;
  try { me = await base44.auth.me(); } catch (_) { me = null; }
  if (!me?.id) { audit('auth.verify', 'denied_unauthenticated', null); return json({ ok: false, code: 'unauthenticated' }, 401); }
  audit('auth.verify', 'ok', String(me.id));

  const userId = me.id;
  let body: Row = {};
  try { body = await req.json(); } catch (_) { body = {}; }

  // 2. never trust a client-supplied owner id
  if (body.owner_id && String(body.owner_id) !== userId) {
    audit('profile.authorization', 'denied_owner_mismatch', userId, { supplied: String(body.owner_id).slice(0, 8) });
    return json({ ok: false, code: 'ownership_spoof_rejected' }, 403);
  }
  if (body.owner_id) audit('profile.authorization', 'ignored_redundant_owner_id', userId);

  const action = String(body.action || 'bootstrap');

  try {
    if (action === 'get') {
      const rows = await rowsFor(base44, userId);
      if (rows.length > 1) audit('profile.settle', 'collapsed', userId, { rows: rows.length });
      return json({ ok: true, profile: rows.length ? await settle(base44, rows) : null });
    }

    if (action === 'bootstrap') {
      return await withUserLock(userId, async () => {
      const rows = await rowsFor(base44, userId);
      if (rows.length) return json({ ok: true, profile: await settle(base44, rows), created: false });

      const now = new Date().toISOString();
      const payload = {
        owner_id: userId,
        display_name: body.display_name ? String(body.display_name).trim().slice(0, 60) : '',
        language: LANGS.includes(body.language) ? body.language : 'fa',
        theme: THEMES.includes(body.theme) ? body.theme : 'system',
        timezone: typeof body.timezone === 'string' && TZ_RE.test(body.timezone) ? body.timezone : 'UTC',
        created_at: now,
        updated_at: now,
      };

      try {
        const created = await base44.entities.UserProfile.create(payload);
        // after create, collapse any rows that a concurrent call also produced
        const after = await rowsFor(base44, userId);
        return json({ ok: true, profile: await settle(base44, after), created: true, id: created?.id });
      } catch (e) {
        // a racing create may have won; re-read rather than failing
        const after = await rowsFor(base44, userId);
        if (after.length) {
          audit('profile.bootstrap', 'raced_recovered', userId, { rows: after.length });
          return json({ ok: true, profile: await settle(base44, after), created: false, raced: true });
        }
        audit('profile.bootstrap', 'create_failed', userId);
        return json({ ok: false, code: 'create_failed', message: String(e) }, 500);
      }
      });
    }

    if (action === 'update') {
      const { out, errors } = validatePatch(body.patch ?? {});
      if (errors.length) { audit('profile.update', 'validation_failed', userId, { fields: Object.keys(body.patch || {}) }); return json({ ok: false, code: 'validation_failed', errors }, 422); }

      const rows = await rowsFor(base44, userId);
      if (!rows.length) { audit('profile.update', 'not_found', userId); return json({ ok: false, code: 'not_found' }, 404); }
      const current = await settle(base44, rows);

      const updated = await base44.entities.UserProfile.update(current.id, {
        ...out,
        updated_at: new Date().toISOString(),
      });
      return json({ ok: true, profile: updated });
    }

    if (action === 'delete') {
      const rows = await rowsFor(base44, userId);
      const row = rows.find((r) => (body.id ? r.id === body.id : true));
      // a foreign id is invisible under RLS and never matches owner_id
      if (!row) { audit('profile.delete', 'not_found_or_foreign', userId, { requested_id: body.id ? String(body.id).slice(0, 8) : null }); return json({ ok: false, code: 'not_found' }, 404); }
      await base44.entities.UserProfile.delete(row.id);
      audit('profile.delete', 'deleted', userId);
      return json({ ok: true, deleted: row.id });
    }

    return json({ ok: false, code: 'unknown_action' }, 400);
  } catch (e) {
    return json({ ok: false, code: 'server_error', message: String(e) }, 500);
  }
});
