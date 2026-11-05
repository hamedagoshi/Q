# MONAD — Phase 4 Report: Daily Experience Integration

**Build:** MONAD 0.4.0 · **Built:** 2026-11-05 17:15 UTC · **Deployed:** `monadTrade` (imgs contract), frontend `app/`
**Base:** 0.3.1 · **Scope:** connect the imported trading record to the daily journal experience. No new entity, no schema change beyond what 0.3.1 already had.

## PART A — Preflight

### A1. The 28/29 assertion
Classification: **environment limitation, not a product defect, not a test defect.**
The failing check clicks «دریافت فایل JSON» and reads the status line. Headless Chromium cannot save a download, so the handler stays inside the browser's download prompt and the status line never updates. The export itself was verified at the API level (versioned envelope, relations, counts, profile). Product code unchanged.

### A2/A3. `imgs` contract (fixed and deployed)
Before: any payload without `imgs` reset all six slots to `missing`. Now only slots the payload actually declares are touched.

| Payload | Behaviour | Evidence |
|---|---|---|
| no `imgs` key | nothing touched, counters 0/0 | `unchanged 1`, `images_present 0`, `images_missing 0`, refs intact |
| `imgs.entry.H1 = ""` | that slot `missing`, others kept | after run: entry/H1 missing, entry/M15 + exit/H1 still `reference_only` |
| slot key absent | preserved | same test |
| path present | `reference_only` | 3 slots |

`available` is still never produced: no image file is ingested in this phase.

## PART B — Daily experience

The day page (`/day/:date`) is now the single place where a day is reviewed:

1. day title, general note, save/delete — unchanged from Phase 2.5
2. **Trades of this day** (new): every trade whose `local_date` equals the day, with symbol, direction, entry/exit time, status (open / partial / closed), volumes, realized result and the trader's own note; each card opens the trade detail; an explicit empty state when there are none, plus a link to all trades.
3. **Daily review** (new): five optional prompts — plan, what I did, what did not go as expected, what I learned, what should change tomorrow — written straight into the existing `Reflection` entity (one row per question, upsert by question key). No interpretation, no scoring.
4. Observations, life events, trading sessions, reflection list: unchanged sections.

Data rules
- `Trade` remains the only source of trade facts; nothing is copied into `DailyRecord`.
- The link is **date-based** (`Trade.local_date` ↔ `DailyRecord.record_date`). `daily_record_id` stays as a convenience pointer and is never treated as the source of truth, so a deleted day cannot hide or delete a trade.
- Trade detail links back with «بازگشت به تجربهٔ روز» + the local date.
- Timezone: same single path as 0.3.1 (`server time − gmt_off → UTC`, local day via profile timezone). No second time logic was added.

## PART C — Regression (executed against the deployed services)

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Day without trades | **PASS** | `2026-11-20` → 0 rows; UI empty state asserted |
| 2 | Day with one trade | **PASS** | `2026-11-09` → 1 (`P401`) |
| 3 | Day with several trades | **PASS** | `2026-11-08` → 5, `2026-11-05` → 4, `2026-11-07` → 2 |
| 4 | Open trade | **PASS** | 301 / 305 / 306 → `closed_at` null, status `open` |
| 5 | Closed trade | **PASS** | 303 → `closed_at` set, status `closed` |
| 6 | Partial close | **PASS** | 302 (0.5/0.25), 202 (0.5/0.25), 104 (1.0/0.4) |
| 7 | Trade near UTC midnight | **PASS** | 105: `2026-11-05T21:00Z` → local `2026-11-06` |
| 8 | Profile timezone change | **PASS** | same trade `P502` (`2026-11-12T22:30Z`): UTC → `local_date 2026-11-12`, Tehran → `2026-11-13` |
| 9 | Two trades on one day | **PASS** | `2026-11-07` → 201 + 202 |
| 10 | Trade → day navigation | **PASS** | detail link `/day/{local_date}` asserted in the UI suite |
| 11 | Delete day, trades survive | **PASS** | day `2026-11-12` deleted (`purged`, children 1) → `P501` still present with `realized 12.5`; `day.get` returns `record: null` |
| 12 | Trade data preserved when the day is edited | **PASS** | day title change on 11-09 → `P401` row unchanged |
| 13 | Day data preserved when the trade is edited | **PASS** | `trade.note` on `P401` → day 11-09 record untouched |
| 14 | Day with every child type | **PASS** | `2026-11-05`: 1 observation, 1 life event, 1 session, 1 reflection, 4 trades |
| 15 | Empty and error states in the UI | **PASS** | empty trade state, error alert + retry path |

UI suites after the change: **112/112** layout combinations clean (5 widths × RTL/LTR × dark/light), **33/34** assertions (the single failure is the headless download check above).

## PART D — Scope respected
No analytics, no score, no psychological interpretation, no MQL5 change, no live EA link, no new entity, no deletion of existing data. One day and one test day were created and one test day deleted on purpose; every pre-existing journal record and trade remains.

## PART E — Delivery
- Services deployed: `monadTrade` (imgs contract). `monadJournal` unchanged.
- Build 0.4.0, built 2026-11-05 17:15 UTC.
- Full source ZIP with this report and the updated build stamp.

## Remaining problems
1. **RLS still BLOCKED** (no platform API). Isolation rests on server-side `owner_id` checks.
2. **Cross-user isolation, Android install, real session expiry: NOT EXECUTED.**
3. **5001-record import: NOT EXECUTED** (cannot fit the write budget).
4. **`available` images never produced**; paths are references only.
5. **Dangling `daily_record_id`** after a day delete: harmless because the day link is date-based, but the pointer stays until the trade is re-imported.
6. **Timezone change does not re-bucket existing trades.** `local_date` is written at import time; after a timezone change only new imports and re-imports move. Documented, not silently "fixed".
7. Headless cannot verify a real download.

## Suggested Phase 5
1. Image ingestion: upload → private storage → `TradeImage.status = available` with a thumbnail in the trade detail.
2. Timezone re-bucket migration: recompute `local_date` for existing trades when the profile timezone changes, with a dry-run count first.
3. Day-level continuity: a small "recent days with trades" strip on Today so the trader can jump into a day's experience.
4. Auth-account deletion and the TWA release (the remaining Phase 5 items from the original plan).
