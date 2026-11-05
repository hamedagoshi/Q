# MONAD — Phase 2.5 Final Report

**Build:** MONAD 0.2.5 (journal core, hardened trade reader) · **Generated:** 2026-11-05 17:00 UTC
**Deployed service:** `monadJournal` (unchanged in this pass), `monadTrade` (Phase 3)
**Scope of this pass:** close the two open items from the Phase 2.5 report (full regression, backup verification) and keep Phase 2.5 intact while Phase 3 was added.

## 1. Regression (the 84-combination matrix, extended)

| Item | Result | Evidence |
|---|---|---|
| 84 combinations (6 routes × 14 width/theme/lang combos) | **PASS** | `tests/ui-harness.html`, 0 overflow, 0 undersized targets, 0 alerts |
| Extended to 112 combinations (adds `/trading` and `/trading/:id`) | **PASS** | 112/112 clean after the fix below |
| Behavioural flows (empty day, note, observation create/edit/delete, cascade delete, calendar, timeline, journal paging) | **PASS** | 9/9 |
| Console errors during the sweep | **PASS** | 0 |

**Defect found and fixed:** rejected-record reasons inside the import history were rendered with `.alert--negative`, so the harness (and a reader) could not tell a *rejected row* from a *failed page*. They are now rendered as a labelled badge + caption. Re-run: 112/112.

## 2. Backup / export

| Test | Result | Evidence |
|---|---|---|
| Export payload builds, is versioned, includes relations | **PASS** | `monad.journal.export/1`, `days[]` carries `observations/events/sessions/reflections`, counts match, profile + timezone included |
| Download button wiring in a real browser | **NOT EXECUTED** | headless Chromium cannot save a download; the click leaves the handler awaiting the download prompt. Verified by code path + payload, not by a saved file |
| Manual procedure for the owner | — | open `/settings`, press «دریافت فایل JSON», confirm a file lands in Downloads and opens as valid JSON |

## 3. Security status (unchanged, reported honestly)

| Test | Result |
|---|---|
| Unauthenticated request denied (401) | PASS |
| Forged `owner_id` rejected (403) | PASS |
| Cross-user read/update/delete with two real accounts | **NOT EXECUTED** (no second real account in this environment) |
| RLS enabled at platform level | **BLOCKED** (no app-settings API exposed to the agent) |
| Real expired-session behaviour | **NOT EXECUTED** |
| Android PWA install | **NOT EXECUTED** (no device) |

An unauthenticated 403/401 is **not** evidence of user isolation. Ownership is enforced in code on every path (`owner_id` from the server session only), which is the currently available control.

## 4. Preserved from earlier Phase 2.5 work

Pagination over the full history, single timezone reference for input and display, local-day filtering, idempotent day creation, tombstone-based cascade delete, honest paging counters, no score/streak/gamification, 4-item bottom navigation.

## 5. Files touched in this pass

`app/js/pages/trading.js` (counter row + stale marker + neutral rejection styling), `app/tests/ui-harness.html` (routes), `app/tests/p25-checks.html` (trading + detail assertions), `app/js/fixtures.js` (trade fixtures, counters). No journal entity or journal service change.

## 6. Remaining risks

- Headless-only verification for the download path (manual step above).
- RLS still unavailable; code-level ownership is the sole barrier.
- Two-account isolation and Android install remain unproven.
