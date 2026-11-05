# MONAD — Phase 3 Report: Trade Data Foundation (hardened)

**Build:** MONAD 0.3.1 (data integrity patch) · **Built:** 2026-11-05 17:10 UTC · **Deployed:** `monadTrade`
**Source of truth for the data shape:** `mt5/upload/propdesk/Experts/PropDesk_Assistant_SINGLE.mq5`
(`PD_TRADE_SCHEMA 4`, `TradeJson`, `MetaJson`, `ActionJson`, `TfName`, `PD_IMAGES_EXPECTED 6`).
No field was invented; every mapped key exists in that writer.

## 1. Entities created

| Entity | Purpose |
|---|---|
| `TradingAccount` | owner, login, broker, server, `identity_key`, currency, balance/equity, prop anchors, GMT offsets, last ingest |
| `Trade` | one row per MT5 position, EA values + provenance (`raw`, `import_job_id`, `provenance`) |
| `TradeImage` | six slots, `entry/exit` × `H1/M15/M1`, status `available | reference_only | missing | failed` |
| `Strategy` | base infrastructure only (name, version, status, free-form settings) |
| `ImportJob` | audit trail: status, totals, created/updated/unchanged/duplicate/rejected/unprocessed, errors, offset |

Journal entities (`DailyRecord`, `StateObservation`, `LifeEvent`, `TradingSession`, `Reflection`) and `UserProfile` untouched.

## 2. Backend (`monadTrade`)

`account.list|update` · `trade.list|get|note|setStrategy|export` · `strategy.list|create|update` · `import.pd|list|get|close`.
Owner is always `base44.auth.me().id`; a body `owner_id` that differs is rejected with 403. Every read is filtered by `owner_id`; every id-based write re-reads the row and checks ownership first.

## 3. Import pipeline

1. **Parse** — accepts the EA file as written (`var PD_DATA = {...};`), bare JSON, or an object. BOM and trailing `;` handled.
2. **Schema gate** — `meta.schema > 4` → job `failed`, reason `schema N is newer than the supported 4`.
3. **Account identity** — `login | broker | server` (`identity_key`). A missing broker/server is stored empty, never invented.
4. **Preload** — existing trades, images and days are read once (paged) instead of once per trade: this removed a real 429 (70 reads/minute).
5. **Per record** — validate → resolve UTC → local day → outcome.
6. **Finalise** — job closed with the real counters, `progressed_at` refreshed every 100 records, and on a crash the job is marked `failed` with the progress reached (it can no longer stay `running`).
7. **Resume** — `offset` + `limit`; `next_offset` returned, `unprocessed` counted, nothing dropped silently.

### Deduplication
Key: `(owner_id, account_id, position_id, opened_at_utc)` (`trade_key = account|position|opened_at`). Checked before any write and once per file (`duplicate` = the same key twice inside one file). MT5 shapes: netting and hedging positions get separate rows; several deals on one position collapse into one row with `deals_in/deals_out`, `last_deal`, `deal_ids`; partial closes keep `volume_initial`, `volume_closed`, `volume_remaining`. `realized` is only ever the EA's position total (`realized_source: ea_position_total`), never summed again.

### Outcomes
`created` · `updated` (an EA-owned field actually changed) · `unchanged` (re-import of identical data, **no write**) · `duplicate` (repeat row in the same file) · `rejected` (with reason).
Manual fields are protected: `note`, `checklist`, `strategy_id` are never overwritten once `note_source/checklist_source = user`; `provenance` records `ea_imported | user_edited`.

### Missing values
`schema 4` exports no exit price. `exit_price` is stored `null` (never 0, never derived); the raw payload is kept verbatim in `raw`. Optional numbers (`sl`, `tp`, `r0`, `mae/mfe`, `swap`, `commission`, …) are `null` when absent. `closed_at` is `null` while a position is open.

### Timezone and journal linkage
Server time `YYYY.MM.DD HH:MM:SS` minus `gmt_off` → UTC; the local day uses the profile timezone via `Intl` (same reference as Phase 2.5). A `DailyRecord` for that local day is reused if it exists, created once otherwise.

### Images
A path is a reference, not a file: `reference_only` when the EA named a path, `missing` when the slot is empty, `failed` if the slot row could not be written. A missing screenshot never rejects a trade.

### 5,000 ceiling
`limit` (max 5,000 per run) keeps the cap, but the remainder is reported as `unprocessed` with `next_offset`, the job ends `completed_with_errors`, and re-import with that offset continues with dedupe intact.

## 4. Test results (executed against the deployed function)

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Import real-shaped schema 4 file | **PASS** | 6 read → 5 created, 1 rejected (`P106: sym is required`) |
| 2 | Re-import identical file | **PASS** | 0 created, 0 updated, 3 unchanged, 1 duplicate, 1 rejected |
| 3 | Changed file | **PASS** | `P303 realized 75.5 → 80.5` → 1 updated, 1 unchanged |
| 4 | Manual note survives re-import | **PASS** | note stayed «یادداشت من در MONAD», `note_source=user`, EA text kept only in `raw` |
| 5 | Open position | **PASS** | `closed_at = null`, status `open`, `volume_remaining 0.2` |
| 6 | Partial close | **PASS** | `volume_initial 0.5`, `volume_closed 0.25`, `remaining 0.25`, `deals_out 1` |
| 7 | Several deals, one position | **PASS** | `deals_in 3 / deals_out 2`, `generation 1`, one row |
| 8 | Netting / hedging | **PASS (limited)** | two opposite XAUUSD positions at the same time stored as two rows; no netting merge tested against a real netting account |
| 9 | No double counting of P/L | **PASS** | realized unchanged across three re-imports |
| 10 | No exit price | **PASS** | `exit_price = null` on every imported row |
| 11 | GMT offset and local day | **PASS** | `00:30 +210` → `2026-11-05T21:00Z` → local `2026-11-06` |
| 12 | Link to an existing day | **PASS** | two trades, one `DailyRecord`, no duplicate day |
| 13 | Failed import state | **PASS** | broken payload → job `failed` + reason; no job left `running` |
| 14 | 5,000 ceiling / unprocessed | **PASS (mechanism)** | `limit 1` on a 2-row file → `unprocessed 1`, `next_offset 1`, status `completed_with_errors`. The literal 5,001-row case was not executed |
| 15 | Image states | **PASS** | `reference_only` for named paths, `missing` for empty slots (10 / 8 in one run) |
| 16 | User isolation | **NOT EXECUTED** | only one real account exists here; unauthenticated 401 is not evidence of isolation |
| 17 | Raw data and provenance | **PASS** | `raw`, `account_identity`, `import_job_id`, `provenance`, `realized_source` present |

UI: `/trading` (accounts, import, history, filters) and `/trading/:id` (facts, six slots, note, raw record, day link) pass 112/112 layout combinations and the assertion suite (24/25; the single failure is the headless download limitation described in the Phase 2.5 report).

## 5. Files changed / created

- `functions/monadTrade.ts` (new, deployed)
- `app/js/api.js` (`TradeApi`), `app/js/app.js` (routes), `app/js/pages/trading.js` (rewritten), `app/js/pages/trade.js` (new), `app/css/app.css` (grids, badges, details), `app/js/fixtures.js` (trade fixtures, localhost-only)
- `tests/fixtures/{pd_schema4_valid.json, journal_data.js, pd_schema4_invalid.json, pd_schema5_future.json}`
- `app/tests/p25-checks.html`, `app/tests/ui-harness.html`
- `PHASE_2_5_FINAL_REPORT.md`, `PHASE_3_REPORT.md`, `BUILD.txt`

## 6. Data preservation

Every journal record from Phase 2 and 2.5 is untouched. Trade rows created during testing belong to two test logins (`51234567`, `77700001`); no production account exists yet. Deletes were never run against real data.

## 7. Remaining problems (explicit)

1. **RLS is still not enabled** (BLOCKED: no platform API). Isolation rests on server-side `owner_id` checks.
2. **Client-supplied file only.** No EA push, no live link, by design for this phase.
3. **`exit_price` is always null** because schema 4 does not export it. Any future exit-price feature needs a contract change, not a derivation.
4. **Absent keys overwrite with `null`** on update: a hand-trimmed record can blank optional values. Real PD_DATA always emits all keys; the importer trusts the export shape.
5. **EA note written after a user edit in MONAD is not applied** (`note_source = user` wins); it stays visible in `raw`.
6. **`deal_ids` holds only the last deal** the EA exposes (`last_deal`); a full deal list is not in the export.
7. **Images are references only**; no file ingestion, so `available` is never produced yet.
8. **5,001-row case untested**; the resume mechanism is tested at small scale.
9. **Second-account isolation, Android install, real session expiry** remain NOT EXECUTED.

## 8. Suggested next phase

Phase 4: image ingestion (upload → private file → `TradeImage.status = available`), then a read-only "day with its trades" join in the journal, then the live EA link last. No analytics, no scoring.

## 9. Final data integrity patch (build 0.3.1)

### 9.1 Missing key vs explicit null
Every optional `Trade` field is now resolved through an explicit contract (`OPTIONAL_FIELDS`, 28 entries): `entry`, `exit_price`, `sl`, `tp`, `vol`, `vol_closed`, `balance_at_open`, `risk_pct`, `r0`, `r0_src`, `realized`, `ret_pct`, `r`, `r_est`, `has_est`, `mae`, `mfe`, `mae_money`, `mfe_money`, `kept`, `reason`, `generation`, `deals_in`, `deals_out`, `realized_swap`, `realized_commission`, `last_deal`, `last_deal_time`.

| Situation | Behaviour |
|---|---|
| key absent | the stored value is kept, the field is not compared, no write |
| key present, `null` or `""` | the field is cleared to `null` |
| key present, valid value | validated, written only if it actually differs |
| key present, invalid value | value ignored, previous kept, reason appended to the job's `errors` |
| new record with absent key | stored as `null`, never 0 |

The original payload is always written to `raw`, independently of what was accepted.

### 9.2 Notes
`Trade` now has two separate columns: `ea_note` (refreshed by every import) and `user_note` (only written by the trader through `trade.note`). A migration action `trade.migrateNotes` filled both from the legacy `note` + `note_source` pair without losing a character: scanned 13 rows, migrated 12, cleared 1 legacy `deal_ids`. The legacy `note` column is kept as a mirror and is documented as deprecated.

### 9.3 Deals
`last_deal` remains exactly the last deal the EA exposes. `deal_ids` is now always an empty array: schema 4 exports a deal *count* and the last deal, not a list, and a one-element array implying a full list was misleading. The legacy one-element value was cleared by the migration.

### 9.4 Images
`available` is never produced in this phase. A named path is `reference_only`, an empty slot is `missing`, `failed` only when the slot row could not be written. The detail page shows them as reference paths, never as images (asserted: zero `<img>` inside the trade view).

### 9.5 Test results of this patch (against the deployed function)

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Key absent keeps the previous value | **PASS** | import without `sl`, `tp`, `mae` → `unchanged 1`, stored 2655 / 2675 / 2658 intact |
| 2 | Explicit null | **PASS** | `sl: null` → `updated 1`, `stop_loss = null` |
| 3 | Valid new value | **PASS** | `sl: 2655` after null → `updated 1` |
| 4 | Invalid value | **PASS** | `sl: "abc"`, `deals_in: 2.5` → `unchanged 1`, both ignored, both logged in `errors` |
| 5 | Re-import unchanged file | **PASS** | `unchanged 1`, `updated 0` |
| 6 | EA note updates | **PASS** | `EA v1 → v2 → v3` in `ea_note` |
| 7 | User note preserved | **PASS** | `user_note = «یادداشت شخصی من»` after three imports |
| 8 | Multi-deal / source limits | **PASS** | `deals_in 3`, `deals_out 2`, `last_deal 990100`, `deal_ids []` |
| 9 | Image statuses | **PASS** | `reference_only` 3 / `missing` 3, no `available` |
| 10 | Journal + trade data preserved | **PASS** | migration touched only the note/`deal_ids` columns; journal entities untouched |
| 11 | 5,001-record import | **NOT EXECUTED** | cannot be pushed through the function within its runtime/write budget (≈30k writes); the clamp and `unprocessed` accounting were verified with `limit 1` and `limit 2` |

UI after the patch: **112/112** layout combinations clean, **28/29** assertions (the one failure is the headless download check, unchanged and documented as NOT EXECUTED).

### 9.6 Still open
1. `imgs` absent from a payload is treated as "no images" and resets the six slots. Real PD_DATA always includes `imgs`; documented rather than patched in this pass.
2. RLS remains BLOCKED; isolation rests on server-side `owner_id` checks.
3. Cross-user isolation, Android install, real session expiry: NOT EXECUTED.
4. `available` images, full deal list, exit price: need a schema/EA change, not an app change.
