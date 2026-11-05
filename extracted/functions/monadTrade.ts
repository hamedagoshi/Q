/**
 * monadTrade — Phase 3 trade data foundation.
 * Facts only: every field maps to a key the PropDesk EA actually exports in
 * PD_DATA schema 4. Nothing is estimated here and no metric is invented.
 * Owner is always the server session; a differing body.owner_id is rejected.
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
  console.log(JSON.stringify({ t: 'monad.trade', seq: ++SEQ, at: new Date().toISOString(), event, outcome, user: userId ? String(userId).slice(0, 8) : null, ...extra }));
}

const str = (v: any, max = 4000) => (v === undefined || v === null ? '' : String(v).slice(0, max));
const num = (v: any): number | null => {
  if (v === undefined || v === null || v === '' || v === 'null') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const textNum = (v: any): number => { const n = num(v); return n === null ? 0 : n; };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: any) => typeof v === 'string' && DAY_RE.test(v);

/* PD_DATA server time "YYYY.MM.DD HH:MM:SS" plus the offset that produced it. */
function serverToUtc(value: any, gmtMin: number): { iso: string; ms: number } {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!m) return { iso: '', ms: NaN };
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - (Number.isFinite(gmtMin) ? gmtMin : 0) * 60000;
  if (!Number.isFinite(ms) || +m[1] < 2000) return { iso: '', ms: NaN };
  return { iso: new Date(ms).toISOString(), ms };
}

function localDateFor(ms: number, tz: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC' }).format(new Date(ms));
  } catch (_) {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

async function page(base44: any, entity: string, query: Record<string, any>, limit = 200, skip = 0) {
  const res = await base44.entities[entity].filter(query, '-created_date', limit, skip);
  return Array.isArray(res) ? res : (res?.items ?? []);
}

const STATUS = { OPEN: 'open', PARTIAL: 'partial', CLOSED: 'closed' } as Record<string, string>;
const REASON = ['unknown', 'sl', 'tp', 'manual'];
const MAX_PER_RUN = 5000;
const STALE_MS = 15 * 60 * 1000;

/* Every field the EA owns. Manual fields (note, checklist, strategy_id) are not here:
   a re-import must never overwrite what the trader wrote in MONAD. */
const EA_FIELDS = [
  'account_id', 'account_identity', 'position_id', 'trade_id_source', 'trade_key', 'deal_ids',
  'symbol', 'direction', 'opened_at', 'closed_at', 'server_open_time', 'server_close_time', 'gmt_offset_min',
  'entry_price', 'exit_price', 'stop_loss', 'take_profit', 'volume_initial', 'volume_closed', 'volume_remaining',
  'balance_at_open', 'risk_pct', 'r0', 'r0_source', 'realized', 'realized_source', 'return_pct',
  'r_multiple', 'r_estimated', 'has_estimate', 'mae_price', 'mfe_price', 'mae_money', 'mfe_money',
  'exit_efficiency', 'status', 'close_reason', 'close_reason_code', 'generation', 'deals_in', 'deals_out',
  'realized_swap', 'realized_commission', 'last_deal', 'last_deal_time', 'uncertain', 'data_warning',
  'images_captured', 'images_missed', 'local_date', 'daily_record_id',
];

/* Optional Trade fields: a key that is ABSENT keeps the stored value, an explicit
   null clears it, an invalid value keeps the stored value and is logged. */
const OPTIONAL_FIELDS: Array<[string, string, string]> = [
  ['entry_price', 'entry', 'num'], ['exit_price', 'exit_price', 'num'],
  ['stop_loss', 'sl', 'num'], ['take_profit', 'tp', 'num'],
  ['volume_initial', 'vol', 'num'], ['volume_closed', 'vol_closed', 'num'],
  ['balance_at_open', 'balance_at_open', 'num'], ['risk_pct', 'risk_pct', 'num'],
  ['r0', 'r0', 'num'], ['r0_source', 'r0_src', 'str'],
  ['realized', 'realized', 'num'], ['return_pct', 'ret_pct', 'num'],
  ['r_multiple', 'r', 'num'], ['r_estimated', 'r_est', 'num'], ['has_estimate', 'has_est', 'bool'],
  ['mae_price', 'mae', 'num'], ['mfe_price', 'mfe', 'num'],
  ['mae_money', 'mae_money', 'num'], ['mfe_money', 'mfe_money', 'num'],
  ['exit_efficiency', 'kept', 'num'], ['close_reason_code', 'reason', 'int'],
  ['generation', 'generation', 'int'], ['deals_in', 'deals_in', 'int'], ['deals_out', 'deals_out', 'int'],
  ['realized_swap', 'realized_swap', 'num'], ['realized_commission', 'realized_commission', 'num'],
  ['last_deal', 'last_deal', 'str'], ['last_deal_time', 'last_deal_time', 'str'],
];

const blank = (v: any) => v === null || v === undefined || v === '';
function sameValue(a: any, b: any): boolean {
  if (blank(a) && blank(b)) return true;
  if (blank(a) !== blank(b)) return false;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a); const y = Number(b);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  return String(a) === String(b);
}
function changedFields(before: any, after: any): string[] {
  const out: string[] = [];
  for (const k of Object.keys(after)) if (!sameValue(before[k], after[k])) out.push(k);
  return out;
}

type Parsed = { meta: any; trades: any[] };

function parsePayload(raw: any): Parsed {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (!raw.meta || !Array.isArray(raw.trades)) throw new Error('payload must contain meta and trades');
    return { meta: raw.meta, trades: raw.trades };
  }
  let text = String(raw ?? '').replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('empty payload');
  const marker = text.search(/var\s+PD_DATA\s*=/);
  if (marker >= 0) {
    const eq = text.indexOf('=', marker);
    text = text.slice(eq + 1).trim();
  }
  if (text.endsWith(';')) text = text.slice(0, -1).trim();
  let obj: any;
  try { obj = JSON.parse(text); } catch (e: any) { throw new Error('payload is not valid JSON: ' + String(e?.message || e).slice(0, 80)); }
  if (!obj?.meta || !Array.isArray(obj.trades)) throw new Error('payload must contain meta and trades');
  return { meta: obj.meta, trades: obj.trades };
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
  const owned = async (entity: string, id: string) => {
    if (!id) return null;
    const rows = await page(base44, entity, { id }, 1, 0);
    const row = rows[0];
    return row && row.owner_id === userId ? row : null;
  };

  try {
    /* ------------------------------------------------------------- accounts */
    if (action === 'account.list') {
      const rows = await page(base44, 'TradingAccount', { owner_id: userId }, 200, 0);
      return json({ ok: true, accounts: rows.sort((a: any, b: any) => String(b.last_import_at || '').localeCompare(String(a.last_import_at || ''))) });
    }

    if (action === 'account.update') {
      const row = await owned('TradingAccount', body.id);
      if (!row) return json({ ok: false, code: 'not_found' }, 404);
      const patch: any = { updated_at: new Date().toISOString() };
      if ('note' in body) patch.note = str(body.note, 500);
      if ('account_type' in body) {
        if (!['prop', 'live', 'demo', 'unknown'].includes(body.account_type)) return json({ ok: false, code: 'invalid_type' }, 422);
        patch.account_type = body.account_type;
      }
      const updated = await base44.entities.TradingAccount.update(row.id, patch);
      audit('account.update', 'ok', userId);
      return json({ ok: true, account: updated });
    }

    /* ------------------------------------------------------------ strategies */
    if (action === 'strategy.list') {
      return json({ ok: true, strategies: await page(base44, 'Strategy', { owner_id: userId }, 200, 0) });
    }
    if (action === 'strategy.create') {
      const name = str(body.name, 80).trim();
      if (!name) return json({ ok: false, code: 'invalid_name' }, 422);
      const now = new Date().toISOString();
      const created = await base44.entities.Strategy.create({
        owner_id: userId, name, description: str(body.description, 1000),
        version: str(body.version, 20) || '1', status: 'draft',
        settings: str(body.settings, 4000) || '', created_at: now, updated_at: now,
      });
      return json({ ok: true, strategy: created });
    }
    if (action === 'strategy.update') {
      const row = await owned('Strategy', body.id);
      if (!row) return json({ ok: false, code: 'not_found' }, 404);
      const patch: any = { updated_at: new Date().toISOString() };
      for (const k of ['name', 'description', 'version', 'settings']) if (k in body) patch[k] = str(body[k], k === 'description' ? 1000 : 4000);
      if ('status' in body) {
        if (!['draft', 'active', 'archived'].includes(body.status)) return json({ ok: false, code: 'invalid_status' }, 422);
        patch.status = body.status;
      }
      return json({ ok: true, strategy: await base44.entities.Strategy.update(row.id, patch) });
    }

    /* --------------------------------------------------------------- trades */
    if (action === 'trade.list') {
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 200);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const query: any = { owner_id: userId };
      if (body.account_id) {
        const acc = await owned('TradingAccount', body.account_id);
        if (!acc) return json({ ok: false, code: 'not_found' }, 404);
        query.account_id = acc.id;
      }
      if (body.symbol) query.symbol = String(body.symbol).toUpperCase().slice(0, 20);
      if (body.status && ['open', 'partial', 'closed'].includes(body.status)) query.status = body.status;
      const rows = await page(base44, 'Trade', query, limit + 1, offset);
      let items = rows;
      if (isDay(body.from)) items = items.filter((t: any) => t.local_date >= body.from);
      if (isDay(body.to)) items = items.filter((t: any) => t.local_date <= body.to);
      const has_more = rows.length > limit;
      return json({ ok: true, trades: items.slice(0, limit), limit, offset, has_more, next_offset: has_more ? offset + limit : null });
    }

    if (action === 'trade.get') {
      const trade = await owned('Trade', body.id);
      if (!trade) return json({ ok: false, code: 'not_found' }, 404);
      const images = await page(base44, 'TradeImage', { owner_id: userId, trade_id: trade.id }, 20, 0);
      const order = { entry: 0, exit: 1 } as any;
      const tfOrder = { H1: 0, M15: 1, M1: 2 } as any;
      images.sort((a: any, b: any) => (order[a.phase] - order[b.phase]) || (tfOrder[a.timeframe] - tfOrder[b.timeframe]));
      return json({ ok: true, trade, images });
    }

    if (action === 'trade.note') {
      const trade = await owned('Trade', body.id);
      if (!trade) return json({ ok: false, code: 'not_found' }, 404);
      return json({ ok: true, trade: await base44.entities.Trade.update(trade.id, { note: str(body.note, 4000), updated_at: new Date().toISOString() }) });
    }

    if (action === 'trade.setStrategy') {
      const trade = await owned('Trade', body.id);
      if (!trade) return json({ ok: false, code: 'not_found' }, 404);
      let strategyId = '';
      if (body.strategy_id) {
        const st = await owned('Strategy', body.strategy_id);
        if (!st) return json({ ok: false, code: 'not_found' }, 404);
        strategyId = st.id;
      }
      return json({ ok: true, trade: await base44.entities.Trade.update(trade.id, { strategy_id: strategyId, updated_at: new Date().toISOString() }) });
    }

    /* --------------------------------------------------------------- import */
    if (action === 'import.list') {
      const rows = await page(base44, 'ImportJob', { owner_id: userId }, 50, 0);
      const now = Date.now();
      const jobs = rows.map((j: any) => {
        const started = Date.parse(j.started_at || '');
        const stale = j.status === 'running' && Number.isFinite(started) && now - started > STALE_MS;
        return { ...j, stale };
      });
      return json({ ok: true, jobs });
    }

    if (action === 'import.get') {
      const job = await owned('ImportJob', body.id);
      if (!job) return json({ ok: false, code: 'not_found' }, 404);
      return json({ ok: true, job });
    }

    if (action === 'import.pd') {
      const sourceName = str(body.source_name, 200) || 'journal_data.js';
      const startedAt = new Date().toISOString();
      let job: any = null;
      const counts = { total: 0, read: 0, created: 0, updated: 0, unchanged: 0, duplicate: 0, rejected: 0, unprocessed: 0 };
      const failJob = async (code: string, reason: string, extra: Record<string, any> = {}) => {
        const row = await base44.entities.ImportJob.create({
          owner_id: userId, source_name: sourceName, status: 'failed',
          started_at: startedAt, finished_at: new Date().toISOString(), progressed_at: new Date().toISOString(),
          total_count: counts.total, read_count: counts.read, created_count: counts.created, updated_count: counts.updated,
          unchanged_count: counts.unchanged, duplicate_count: counts.duplicate, rejected_count: counts.rejected,
          unprocessed_count: counts.unprocessed,
          errors: JSON.stringify([{ index: -1, id: '', reason }]),
          file_bytes: typeof body.payload === 'string' ? body.payload.length : JSON.stringify(body.payload ?? '').length,
          ...extra,
        });
        audit('import.pd', 'failed:' + code, userId);
        return json({ ok: false, code, reason, job: row }, 422);
      };

      let parsed: Parsed;
      try {
        parsed = parsePayload(body.payload ?? body.file ?? body.text);
      } catch (e: any) {
        return await failJob('invalid_payload', String(e?.message || e).slice(0, 200));
      }

      const meta = parsed.meta;
      const schemaVersion = textNum(meta.schema);
      if (schemaVersion > 4) return await failJob('unsupported_schema', `schema ${schemaVersion} is newer than the supported 4`, { schema_version: schemaVersion });
      const login = str(meta.login, 40);
      if (!login) return await failJob('missing_account', 'meta.login is required to attach trades to an account');

      const total = parsed.trades.length;
      const offset = Math.max(Number(body.offset) || 0, 0);
      const asked = Number(body.limit);
      const runLimit = Math.min(Math.max(Number.isFinite(asked) && asked > 0 ? asked : MAX_PER_RUN, 1), MAX_PER_RUN);
      const batch = parsed.trades.slice(offset, offset + runLimit);
      counts.total = total;
      counts.read = batch.length;
      counts.unprocessed = Math.max(total - (offset + batch.length), 0);

      job = await base44.entities.ImportJob.create({
        owner_id: userId, source_name: sourceName, account_login: login, schema_version: schemaVersion,
        started_at: startedAt, progressed_at: startedAt, status: 'running', ea_version: str(meta.version, 40),
        total_count: total, read_count: batch.length, offset_start: offset,
        created_count: 0, updated_count: 0, unchanged_count: 0, duplicate_count: 0, rejected_count: 0,
        unprocessed_count: counts.unprocessed, images_present: 0, images_missing: 0,
        raw_meta: JSON.stringify(meta).slice(0, 4000),
        file_bytes: typeof body.payload === 'string' ? body.payload.length : JSON.stringify(body.payload ?? '').length,
      });

      const errors: any[] = [];
      const countsImages = { present: 0, missing: 0 };
      try {
        /* account identity is login + broker + server: two servers can share a login */
        const broker = str(meta.company, 80);
        const server = str(meta.server, 80);
        const identity = `${login}|${broker}|${server}`;
        const accRows = await page(base44, 'TradingAccount', { owner_id: userId, login, broker, server }, 2, 0);
        const accFields = {
          broker, server, identity_key: identity,
          currency: str(meta.currency, 10),
          balance: num(meta.balance), equity: num(meta.equity),
          day_anchor: num(meta.day_anchor), floor: num(meta.floor),
          dd_used_pct: num(meta.dd_used_pct), dd_limit_pct: num(meta.dd_limit_pct),
          anchor_state: str(meta.anchor_state, 40), binding: str(meta.binding, 40),
          server_gmt_offset_min: num(meta.server_gmt_offset_min), user_gmt_offset_min: num(meta.user_gmt_offset_min),
          source_version: str(meta.version, 40), last_import_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        const account = accRows.length
          ? await base44.entities.TradingAccount.update(accRows[0].id, accFields)
          : await base44.entities.TradingAccount.create({
            owner_id: userId, login, account_type: 'unknown', note: '', created_at: new Date().toISOString(), ...accFields,
          });

        /* profile timezone decides the local day, exactly as the journal does */
        let tz = 'UTC';
        try {
          const prof = await page(base44, 'UserProfile', { owner_id: userId }, 1, 0);
          if (prof[0]?.timezone) tz = String(prof[0].timezone);
        } catch (_) { tz = 'UTC'; }

        /* The platform caps entity reads per minute, so every lookup this import
           needs is preloaded once instead of once per trade. */
        const tradeIndex = new Map<string, any>();
        for (let s2 = 0; s2 < 5000; s2 += 200) {
          const chunk = await page(base44, 'Trade', { owner_id: userId, account_id: account.id }, 200, s2);
          for (const t2 of chunk) tradeIndex.set(`${t2.position_id}|${t2.opened_at}`, t2);
          if (chunk.length < 200) break;
        }
        const imageIndex = new Map<string, any>();
        for (let s2 = 0; s2 < 4000; s2 += 200) {
          const chunk = await page(base44, 'TradeImage', { owner_id: userId }, 200, s2);
          for (const im of chunk) imageIndex.set(`${im.trade_id}|${im.phase}|${im.timeframe}`, im);
          if (chunk.length < 200) break;
        }
        const dayCache = new Map<string, string>();
        for (let s2 = 0; s2 < 5000; s2 += 200) {
          const chunk = await page(base44, 'DailyRecord', { owner_id: userId }, 200, s2);
          for (const d2 of chunk) if (!d2.deleted_at && !dayCache.has(d2.record_date)) dayCache.set(d2.record_date, d2.id);
          if (chunk.length < 200) break;
        }
        const ensureDay = async (date: string) => {
          if (dayCache.has(date)) return dayCache.get(date) as string;
          const now = new Date().toISOString();
          const created = await base44.entities.DailyRecord.create({
            owner_id: userId, record_date: date, title: '', general_note: '', created_at: now, updated_at: now,
          });
          dayCache.set(date, created.id);
          return created.id;
        };

        const seenThisRun = new Set<string>();

        const progress = async () => {
          await base44.entities.ImportJob.update(job.id, {
            progressed_at: new Date().toISOString(),
            read_count: counts.read, created_count: counts.created, updated_count: counts.updated,
            unchanged_count: counts.unchanged, duplicate_count: counts.duplicate, rejected_count: counts.rejected,
            unprocessed_count: counts.unprocessed, errors: JSON.stringify(errors).slice(0, 8000),
          });
        };

        for (let i = 0; i < batch.length; i += 1) {
          const src: any = batch[i] || {};
          const reasons: string[] = [];
          const positionId = str(src.pos, 40);
          const symbol = str(src.sym, 20).toUpperCase();
          const dir = Number(src.dir);
          const gmt = num(src.gmt_off);
          const opened = serverToUtc(src.open, gmt === null ? 0 : gmt);
          if (!positionId) reasons.push('pos is required');
          if (!symbol) reasons.push('sym is required');
          if (dir !== 1 && dir !== -1) reasons.push('dir must be 1 or -1');
          if (!opened.iso) reasons.push('open must be a server timestamp');
          if (reasons.length) {
            counts.rejected += 1;
            errors.push({ index: offset + i, id: str(src.id, 40), reason: reasons.join('; ') });
            continue;
          }

          const closed = serverToUtc(src.close, gmt === null ? 0 : gmt);
          const statusText = String(src.status || '').toUpperCase();
          const status = STATUS[statusText] || 'open';
          const localDate = localDateFor(opened.ms, tz);
          const recordId = await ensureDay(localDate);
          const key = `${positionId}|${opened.iso}`;
          const existing = tradeIndex.get(key);
          const rowErrors: string[] = [];
          const pick = (field: string, sourceKey: string, kind: string) => {
            if (!(sourceKey in src)) return { present: false } as any;
            const raw = src[sourceKey];
            if (raw === null || raw === '') return { present: true, value: null } as any;
            if (kind === 'num' || kind === 'int') {
              const n = Number(raw);
              const okNum = Number.isFinite(n) && (kind === 'num' || Number.isInteger(n));
              return okNum ? { present: true, value: n } as any : { present: true, invalid: true } as any;
            }
            if (kind === 'bool') return { present: true, value: raw === true || raw === 'true' || Number(raw) === 1 } as any;
            return { present: true, value: str(raw, 4000) } as any;
          };

          /* Deal semantics of schema 4: the export carries the counts and the last
             deal only. deal_ids stays empty rather than pretending one deal is a list. */
          const dealIds: string[] = [];
          const ea: any = {
            account_id: account.id, account_identity: identity, account_login: login,
            position_id: positionId, trade_id_source: str(src.id, 40),
            trade_key: `${account.id}|${positionId}|${opened.iso}`,
            deal_ids: JSON.stringify(dealIds),
            symbol, direction: dir === 1 ? 'buy' : 'sell',
            opened_at: opened.iso,
            /* an open position has no close time: null, never a fabricated one */
            closed_at: status === 'open' || !closed.iso ? null : closed.iso,
            server_open_time: str(src.open, 30),
            server_close_time: status === 'open' || !closed.iso ? '' : str(src.close, 30),
            gmt_offset_min: gmt,
            status, close_reason: REASON[textNum(src.reason)] || 'unknown',
            realized_source: 'ea_position_total',
            uncertain: Boolean(src.uncertain), data_warning: Boolean(src.data_warning),
            images_captured: textNum(src.imgs_count), images_missed: textNum(src.imgs_missed),
            local_date: localDate, daily_record_id: recordId,
          };

          for (const [field, sourceKey, kind] of OPTIONAL_FIELDS) {
            const picked = pick(field, sourceKey, kind);
            if (!picked.present) {
              if (!existing) ea[field] = null; /* new row: the value simply is not there */
              continue;                        /* existing row: keep what we already have */
            }
            if (picked.invalid) {
              rowErrors.push(`${field}: invalid value for "${sourceKey}" ignored, previous value kept`);
              if (!existing) ea[field] = null;
              continue;
            }
            ea[field] = picked.value;
          }

          if (ea.volume_initial !== undefined || (existing && existing.volume_initial !== undefined)) {
            const vi = ea.volume_initial !== undefined ? ea.volume_initial : existing?.volume_initial;
            const vc = ea.volume_closed !== undefined ? ea.volume_closed : existing?.volume_closed;
            if (typeof vi === 'number') ea.volume_remaining = Math.max(vi - (typeof vc === 'number' ? vc : 0), 0);
          }
          if (rowErrors.length) errors.push({ index: offset + i, id: str(src.id, 40), reason: rowErrors.join('; ') });

          /* the EA note is its own column; the trader's note is never touched by an import */
          const eaNote = 'note' in src ? str(src.note, 4000) : (existing ? undefined : '');
          const eaChecklist = 'checklist' in src ? str(src.checklist, 1000) : (existing ? undefined : '');

          let tradeRow: any = null;
          if (!existing) {
            counts.created += 1;
            tradeRow = await base44.entities.Trade.create({
              owner_id: userId, strategy_id: '', note: eaNote || '', note_source: 'ea',
              ea_note: eaNote || '', user_note: '',
              checklist: eaChecklist || '', checklist_source: 'ea',
              actions: JSON.stringify(Array.isArray(src.actions) ? src.actions : []).slice(0, 20000),
              import_job_id: job.id, provenance: 'ea_imported', raw: JSON.stringify(src).slice(0, 20000),
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...ea,
            });
          } else if (seenThisRun.has(key)) {
            counts.duplicate += 1;
            errors.push({ index: offset + i, id: str(src.id, 40), reason: 'duplicate row inside this file; first occurrence kept' });
            continue;
          } else {
            const patch: any = { ...ea };
            if (eaNote !== undefined) patch.ea_note = eaNote;
            patch.user_note = existing.user_note || '';
            patch.strategy_id = existing.strategy_id || '';
            const diff = changedFields(existing, ea).concat(eaNote !== undefined && !sameValue(existing.ea_note, eaNote) ? ['ea_note'] : []);
            if (!diff.length) {
              counts.unchanged += 1;
            } else {
              counts.updated += 1;
              tradeRow = await base44.entities.Trade.update(existing.id, {
                ...patch, actions: JSON.stringify(Array.isArray(src.actions) ? src.actions : []).slice(0, 20000),
                import_job_id: job.id, raw: JSON.stringify(src).slice(0, 20000), updated_at: new Date().toISOString(),
              });
            }
            tradeRow = tradeRow || existing;
          }
          seenThisRun.add(key);
          tradeIndex.set(key, tradeRow);

          /* six fixed slots; a path is a reference, not an ingested file.
             Only slots the payload actually declares are touched: an absent imgs
             object or an absent slot keeps what is already stored. */
          for (const phase of src.imgs && typeof src.imgs === 'object' ? ['entry', 'exit'] : []) {
            const phaseObj = src.imgs[phase];
            if (!phaseObj || typeof phaseObj !== 'object') continue;
            for (const tf of ['H1', 'M15', 'M1']) {
              if (!(tf in phaseObj)) continue;
              const ref = str(phaseObj[tf], 300);
              const state = ref ? 'reference_only' : 'missing';
              if (ref) countsImages.present += 1; else countsImages.missing += 1;
              const imgKey = `${tradeRow.id}|${phase}|${tf}`;
              const payload = { ref, status: state, created_at: new Date().toISOString() };
              try {
                const found = imageIndex.get(imgKey);
                if (found) {
                  if (!sameValue(found.ref, ref) || !sameValue(found.status, state)) await base44.entities.TradeImage.update(found.id, payload);
                } else {
                  imageIndex.set(imgKey, await base44.entities.TradeImage.create({ owner_id: userId, trade_id: tradeRow.id, phase, timeframe: tf, ...payload }));
                }
              } catch (e: any) {
                await base44.entities.TradeImage.create({ owner_id: userId, trade_id: tradeRow.id, phase, timeframe: tf, ref, status: 'failed', created_at: new Date().toISOString() }).catch(() => null);
                errors.push({ index: offset + i, id: str(src.id, 40), reason: `image ${phase}/${tf}: ${String(e?.message || e).slice(0, 80)}` });
              }
            }
          }
          if (i > 0 && i % 100 === 0) await progress();
        }

        const finishedAt = new Date().toISOString();
        const finalStatus = counts.rejected || counts.unprocessed ? 'completed_with_errors' : 'completed';
        const finalJob = await base44.entities.ImportJob.update(job.id, {
          finished_at: finishedAt, progressed_at: finishedAt, status: finalStatus,
          total_count: total, read_count: counts.read, offset_start: offset,
          created_count: counts.created, updated_count: counts.updated, unchanged_count: counts.unchanged,
          duplicate_count: counts.duplicate, rejected_count: counts.rejected, unprocessed_count: counts.unprocessed,
          images_present: countsImages.present, images_missing: countsImages.missing,
          errors: JSON.stringify(errors).slice(0, 8000), account_id: account.id, account_identity: identity,
        });
        await base44.entities.TradingAccount.update(account.id, { trades_seen: total, last_import_at: finishedAt });

        audit('import.pd', 'ok', userId, { read: counts.read, created: counts.created, updated: counts.updated, unchanged: counts.unchanged, rejected: counts.rejected, unprocessed: counts.unprocessed });
        return json({
          ok: true,
          job: finalJob,
          summary: {
            total, read: counts.read, created: counts.created, updated: counts.updated, unchanged: counts.unchanged,
            duplicate: counts.duplicate, rejected: counts.rejected, unprocessed: counts.unprocessed,
            offset, next_offset: counts.unprocessed ? offset + counts.read : null,
            images_present: countsImages.present, images_missing: countsImages.missing,
            account_login: login, account_identity: identity, schema: schemaVersion, timezone: tz, errors,
          },
        });
      } catch (e: any) {
        /* a crash must not leave the job running: progress so far is preserved */
        const reason = String(e?.message || e).slice(0, 200);
        errors.push({ index: -1, id: '', reason });
        await base44.entities.ImportJob.update(job.id, {
          status: 'failed', finished_at: new Date().toISOString(), progressed_at: new Date().toISOString(),
          total_count: total, read_count: counts.read, created_count: counts.created, updated_count: counts.updated,
          unchanged_count: counts.unchanged, duplicate_count: counts.duplicate, rejected_count: counts.rejected,
          unprocessed_count: Math.max(total - (offset + counts.read), 0),
          images_present: countsImages.present, images_missing: countsImages.missing,
          errors: JSON.stringify(errors).slice(0, 8000),
        }).catch(() => null);
        audit('import.pd', 'failed_exception', userId, { message: reason.slice(0, 100) });
        return json({ ok: false, code: 'import_failed', reason, job_id: job.id, progress: counts }, 500);
      }
    }

    if (action === 'import.close') {
      const row = await owned('ImportJob', body.id);
      if (!row) return json({ ok: false, code: 'not_found' }, 404);
      if (row.status !== 'running') return json({ ok: false, code: 'not_running', job: row }, 409);
      const reason = str(body.reason, 200).trim();
      if (!reason) return json({ ok: false, code: 'reason_required' }, 422);
      const errs = (() => { try { return JSON.parse(row.errors || '[]'); } catch (_) { return []; } })();
      errs.push({ index: -1, id: '', reason: `closed by owner: ${reason}` });
      const updated = await base44.entities.ImportJob.update(row.id, {
        status: 'failed', finished_at: new Date().toISOString(), progressed_at: new Date().toISOString(),
        errors: JSON.stringify(errs).slice(0, 8000),
      });
      audit('import.close', 'ok', userId);
      return json({ ok: true, job: updated });
    }

    if (action === 'trade.migrateNotes') {
      const rows: any[] = [];
      for (let s2 = 0; s2 < 5000; s2 += 200) {
        const chunk = await page(base44, 'Trade', { owner_id: userId }, 200, s2);
        rows.push(...chunk);
        if (chunk.length < 200) break;
      }
      let migrated = 0; let clearedDealIds = 0;
      for (const t of rows) {
        const patch: any = {};
        if (t.ea_note === undefined || t.ea_note === null) patch.ea_note = t.note_source === 'user' ? '' : (t.note || '');
        if (t.user_note === undefined || t.user_note === null) patch.user_note = t.note_source === 'user' ? (t.note || '') : '';
        const list = (() => { try { return JSON.parse(t.deal_ids || '[]'); } catch (_) { return []; } })();
        if (Array.isArray(list) && list.length === 1 && list[0] === t.last_deal) { patch.deal_ids = '[]'; clearedDealIds += 1; }
        if (Object.keys(patch).length) { await base44.entities.Trade.update(t.id, patch); migrated += 1; }
      }
      audit('trade.migrateNotes', 'ok', userId, { migrated });
      return json({ ok: true, scanned: rows.length, migrated, cleared_deal_ids: clearedDealIds });
    }

    if (action === 'trade.export') {
      const trades: any[] = [];
      for (let s2 = 0; s2 < 5000; s2 += 200) {
        const chunk = await page(base44, 'Trade', { owner_id: userId }, 200, s2);
        trades.push(...chunk);
        if (chunk.length < 200) break;
      }
      const images: any[] = [];
      for (let s2 = 0; s2 < 4000; s2 += 200) {
        const chunk = await page(base44, 'TradeImage', { owner_id: userId }, 200, s2);
        images.push(...chunk);
        if (chunk.length < 200) break;
      }
      const accounts = await page(base44, 'TradingAccount', { owner_id: userId }, 200, 0);
      audit('trade.export', 'ok', userId, { trades: trades.length });
      return json({ ok: true, export: { schema: 'monad.trades.export/1', exported_at: new Date().toISOString(), accounts, trades, images } });
    }

    return json({ ok: false, code: 'unknown_action' }, 400);
  } catch (e: any) {
    audit('request', 'server_error', userId, { action: action.slice(0, 40), message: String(e?.message || e).slice(0, 120) });
    return json({ ok: false, code: 'server_error', message: String(e?.message || e).slice(0, 200) }, 500);
  }
});
