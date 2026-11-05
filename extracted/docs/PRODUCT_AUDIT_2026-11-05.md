# MONAD — Full Product Audit & Roadmap Preparation

Date: 2026-11-05 · Mode: inspection only · **Nothing in the application was modified, created, deleted, refactored or deployed.**
Statuses used: IMPLEMENTED · PARTIALLY IMPLEMENTED · MISSING · BLOCKED · NOT VERIFIED

Inspected: 224 tracked files, `app/` (SPA, 875 lines of page code), `functions/` (2 deployed services),
`design-system/`, `brand/`, `security/`, `tests/`, plus live entity schemas and the deployed
function behaviour recorded on 2026-11-05.

---

## A. Current Product Status

MONAD today is a **working single-purpose personal daily journal**, not a Trader Management Platform.

What actually runs:
* A PWA-shaped SPA (no service worker) with 8 routes, a real login adapter against the platform
  session, one profile per user, and a day-centric journal of five collections.
* All data access is server-mediated (`monadProfile`, `monadJournal`); the client never queries
  entities directly.
* Persian RTL and English LTR, dark/light/system themes, 44px targets, no horizontal overflow at
  360–1280px (measured).

What does not exist yet: any capital, prop-firm, plan, strategy, checklist, trade, imported-history,
analytics or behavioural feature. The two routes that hint at them (`/trading`, `/insights`) are
static placeholders. There is **zero** PropDesk import code.

In one sentence: **the journal is real and usable; the "trader management" half of the product has
not been started, and two data-layer defects currently limit the journal to ~3 months of history.**

---

## B. Existing Features (with source locations)

| Feature | Status | Source |
|---|---|---|
| Brand lock v4 (mark, wordmark, icons, tokens) | IMPLEMENTED | `brand/final/`, `brand/final/assets/tokens.json` |
| Design system, 31 components, 23/23 assertions | IMPLEMENTED | `design-system/{index.html,css,js,tests.html}` |
| SPA shell, bottom nav, TopBar, theme switch | IMPLEMENTED | `app/index.html`, `app/js/app.js:56-160` |
| History router + pattern routes (`:date`) | IMPLEMENTED | `app/js/router.js:1-60` |
| Auth adapter (platform session + localhost double) | IMPLEMENTED (double is a release risk) | `app/js/auth.js:1-90` |
| One profile per user, bootstrap/settle/update/delete | IMPLEMENTED | `functions/monadProfile.ts:126-210` |
| Server-derived ownership on every action | IMPLEMENTED | `functions/monadProfile.ts:136`, `functions/monadJournal.ts:173` |
| Today screen (status, counts, latest entries) | IMPLEMENTED | `app/js/pages/home.js` |
| Journal list + 30/90/all range chips | PARTIALLY IMPLEMENTED | `app/js/pages/journal.js:54-70` |
| Day detail with 5 independent collections | IMPLEMENTED | `app/js/pages/day.js:1-307` |
| Day delete with cascade + confirmation counts | IMPLEMENTED | `functions/monadJournal.ts:243-256` |
| Timeline feed (merged, sorted) | IMPLEMENTED | `functions/monadJournal.ts:317-341` |
| Calendar month grid with marked days | IMPLEMENTED | `app/js/pages/calendar.js`, `monadJournal.ts:344+` |
| Settings (name, language, timezone, theme, sign out) | IMPLEMENTED | `app/js/pages/settings.js` |
| Profile data deletion | IMPLEMENTED | `functions/monadProfile.ts:199+` |
| PWA manifest, icons, standalone display | PARTIALLY IMPLEMENTED (no service worker) | `app/manifest.webmanifest` |
| Trading screen | MISSING (placeholder) | `app/js/pages/trading.js` (11 lines) |
| Insights screen | MISSING (placeholder) | `app/js/pages/insights.js` (11 lines) |
| Design-system lab reachable as a route | PARTIALLY IMPLEMENTED (static directory only) | `design-system/index.html` |
| PropDesk `journal_data.js` / PD_DATA / schema 4 import | MISSING (no code at all) | — |
| Export / backup | MISSING | — |
| Rate limiting | MISSING | both functions |
| RLS enforcement | BLOCKED | no platform control (see §E) |

---

## C. Incomplete Features — what remains

1. **PWA** (`manifest.webmanifest`): icons and standalone mode exist, **no service worker**, so no
   offline shell, no cache strategy and an unreliable install prompt on Android Chrome. Remaining:
   `sw.js` with precache + navigation fallback, offline page, update prompt, install test on a real device.
2. **Journal list**: the range filter is applied **client-side after a server cap of 100 days**, and
   the "all" option therefore is not all. Remaining: cursor pagination end to end.
3. **Design system integration**: the app ships its own `app/css/app.css` built on the design-system
   token names (0 hardcoded hex, 52 `var(--m-*)` uses — verified) but the `/design-system` route is
   only a static directory, not part of the SPA. Remaining: mount it or link it from settings.
4. **Calendar**: renders a month and marks days; no month-to-month persistence of position, no
   multi-month range request, no empty-month guidance beyond the generic state.
5. **Timeline**: merges five item types but a day record is dated by `created_at`, not by the day's
   own date, so a day edited later can jump in the feed.
6. **Settings**: language switch updates the profile and re-renders, but there is no export, no
   account deletion (deliberately Phase 5), and no visible security/RLS status.
7. **Auth**: only the platform adapter is exercised in production paths; the localhost test double
   still ships inside `auth.js` and `fixtures.js`.

---

## D. Missing Features required by the mission

**A. Capital Management — MISSING (0%).** No account entity, no prop-firm profile, no balance/equity,
no daily-loss or max-drawdown limits, no rule set (profit target, consistency rule, news ban), no
risk monitor, no position sizing. Nothing exists.

**B. Plans & Strategies — MISSING (0%).** No plan, no strategy, no versioning, no entry/exit
conditions, no checklists, no compliance tracking. `TradingSession` records *that* a session happened
and its market/note — it is not a plan.

**C. Trade Journal — MISSING (0%).** No trade entity, no entry/exit, no R, no screenshots, no
strategy/account association.

**D. Daily Journal — IMPLEMENTED (~85%).** Present: day record, note, observations, life events,
sessions, reflections, calendar, timeline. Missing: per-day trade linkage (depends on C), attachments.

**E. Trading Analytics — MISSING (0%).** No P/L, win rate, profit factor, expectancy, average
win/loss, drawdown, MAE/MFE, R-multiple, per-strategy or per-session breakdown. `TradingSession` has
no monetary fields at all, so no metric can be derived from today's data.

**F. Behavioural Analytics — MISSING (0%).** No plan-violation model, no mistake taxonomy, no
decision-pattern layer. Correctly not attempted before trade data exists.

**G. Integrated Daily Insights — MISSING (0%).** The journal has no trade side to integrate with.
The separation discipline (fact / calculated / hypothesis) exists in prose only; no data field or UI
distinguishes the three.

**H. Platform & UX — PARTIALLY IMPLEMENTED.** Android-first layout, RTL/LTR, themes, responsive and
accessibility are done. Missing: multi-user beyond per-owner isolation (no coach, no team, no shared
account), export/backup, offline, install test evidence.

**PropDesk integration foundation — MISSING.** No importer, no `PD_DATA` parser, no schema-4 mapping,
no dedupe key based on position ids, no GMT-offset normalisation. Earlier research into the format
exists in project history, but **no code and no test** exists in this workspace.

---

## E. Critical Issues (functional / data integrity / financial / access-control only)

**C1 — History is silently truncated at 100 days. HIGH.**
`functions/monadJournal.ts:52` fetches at most 100 DailyRecords (`limit: 100`) and every aggregate
(`day.list`, `timeline`, `calendar`) is built from that subset. A daily journal crosses 100 days in
about three months; after that, older days simply stop appearing in the journal, the timeline and the
calendar, with no error and no "more" affordance. The client's "All" range cannot undo it.

**C2 — Entry time is captured in the device timezone, displayed in the profile timezone. HIGH-MEDIUM.**
`app/js/api.js:79` builds `new Date('YYYY-MM-DDTHH:mm:00')`, which the browser interprets in the
**device** timezone, then stores UTC. Display (`fmtTime`) converts into the **profile** timezone
(`app/js/api.js:82`). If the device timezone differs from the profile timezone, every observation,
event and session is stored and shown shifted by the offset difference, silently and permanently.

**C3 — Day range filtering mixes UTC and local days. MEDIUM.**
`monadJournal.ts:319` compares an ISO timestamp against `body.from` and against `to + 'T23:59:59.999Z'`
— a UTC day boundary — while entries are anchored to the user's local date. Around midnight, filtered
feeds can include or drop items from the adjacent day.

**C4 — No uniqueness guarantee for one-day-per-date. MEDIUM.**
The rule is enforced in application code only (`day.upsert` reads, then writes). There is no index or
unique constraint available through the API. Two concurrent saves can create two records for the same
`record_date`; counts and the calendar then double-count, and the profile layer's duplicate-settling
logic does not exist for journals.

**C5 — Day deletion is not atomic. MEDIUM (risk, not reproduced).**
`monadJournal.ts:243-256` deletes children collection by collection, then the parent. A failure part
way leaves a partially deleted day. No transaction is available on the platform.

**C6 — RLS state unknown. BLOCKED.**
No API in this workspace reads or sets row-level security. Anonymous requests to the entity API return
403 (verified, 5 probes), but **isolation between two authenticated users is NOT VERIFIED**. Until the
owner enables owner-only RLS for all six entities, a session-holding client could plausibly read rows
it does not own. This is the only open access-control item.

**C7 — Release risk: test doubles ship in the bundle. MEDIUM.**
`app/js/auth.js` (routing double) and `app/js/fixtures.js` (in-memory store) are guarded to localhost,
but they are present in the production bundle. They must be removed before any store submission.

**C8 — `intensity` 1–5 contradicts the product principles. LOW-MEDIUM.**
`StateObservation.intensity` is a numeric 1–5. Relative to "no artificial psychological scores /
no energy-focus ratings", a 1–5 number on a state is exactly the pattern the brief excludes. Either
drop it, or rename and re-frame it as an explicitly subjective note the user writes for themselves.

**C9 — Orphan entity. LOW.**
`MonadConfig` exists with fields `base_url`, `note` and is referenced by **no code** (verified by
search). It should be removed to keep the schema honest.

**C10 — No export. MEDIUM.** A journal with no export is a lock-in; there is no JSON/CSV backup and no
"download everything" path.

**C11 — Two fake destinations in navigation. MEDIUM (UX trust).**
The bottom nav exposes `/trading`, which renders a placeholder card. A user sees a section that does
nothing. `/insights` is routed but not in the nav.

Verified as *not* an issue: no fabricated trade numbers anywhere; missing `intensity` renders as
absent, not as `0` (`day.js:86`); no hardcoded colors in `app.css`; no broken route in the 84-combination
harness sweep; server-side ownership checks are present on every mutating action.

---

## F. Recommended Product Architecture

```
 MetaTrader 5 (desk)                    Cloud (Base44)                     Mobile PWA
┌────────────────────────┐   export   ┌──────────────────────────┐   sync   ┌────────────────────┐
│ PropDesk EA / journal  │ ─────────► │ ImportJob  (raw payload) │ ───────► │ Today / Journal    │
│  journal_data.js       │  JSON file │      │                   │  read    │ Day detail         │
│  PD_DATA schema 4      │            │      ▼  parser+dedupe    │          │ Timeline / Calendar│
│                        │            │ Trade  ──────┐          │          │ Analytics          │
│ Desk tools (Phase 5+)  │            │ TradeImage   │          │          │                    │
│  risk / checklists     │            │              ▼          │          │                    │
└────────────────────────┘            │ Account ── Strategy ── Account │   └────────────────────┘
                                      │   │          │        │   │
                                      │   └── Plan ──┴─ Checklist    │
                                      │        │                      │
                                      │        ▼                      │
                                      │  Day (DailyRecord) ◄── link by local date
                                      └──────────────────────────┘
```

Rules that keep it honest:
1. **Raw → derived → interpreted, in separate stores.** `Trade`/`TradeImage`/`ImportJob` hold facts;
   metrics are computed and cacheable but never written back into raw rows; hypotheses (behavioural)
   live in their own table with an explicit `basis` field.
2. **One date authority.** A single `localDate` string per day, computed once from the user's profile
   timezone at write time, stamped on every child. Nothing else infers a day.
3. **Dedupe key** for imports: `(owner_id, account_login, position_id, opened_at)`. Re-import updates,
   never duplicates.
4. **Money is integer minor units** (cents) plus an explicit currency, never floats.
5. **The mobile app never talks to MetaTrader.** It reads imported history; desk-side tools never read
   the journal database. The only bridge is the import.

---

## G. Recommended Development Roadmap

**Phase 2.5 — Data Integrity & Trust (essential, small)**
Pagination for days (cursor, no 100-day wall) · fix the timezone capture/display split with one date
authority · UTC/local range alignment · idempotent day creation · remove `MonadConfig` and the test
doubles · export (JSON) · replace the two placeholder routes with honest "not yet" states and remove
`/trading` from the nav. *Outcome: the journal is trustworthy for years, not months.*

**Phase 3 — Trade Data Foundation (essential)**
`Account`, `Strategy`, `Trade`, `TradeImage`, `ImportJob` · PD_DATA schema-4 parser · position-id
dedupe · GMT-offset normalisation · trade list and single trade detail · day↔trade link by local date.
*Outcome: the second half of the product exists as data before any chart is drawn.*

**Phase 4 — Trading Analytics (high value)**
Computed metrics only: net P/L, win rate, profit factor, expectancy, average win/loss, drawdown,
R-multiple, per-account / per-strategy / per-session breakdowns. Every figure labelled *calculated*,
with the sample size and the date range printed beside it. No score, no grade.

**Phase 5 — Capital & Prop-Firm Rules (essential to the mission)**
Account profiles with balance, profit target, daily loss and max drawdown · rule set per firm ·
live rule monitor · position-size calculator · daily risk budget.

**Phase 6 — Plans, Strategies & Checklists**
Plan and strategy records with versions, entry/exit conditions and checklists · plan compliance
computed against real trades (violation = a rule that was broken, not a mood).

**Phase 7 — Behavioural Layer & Integrated Insights**
Mistake taxonomy, repeated-violation detection, day-quality vs performance comparisons — reported as
**observed association with n and effect size**, never causation, no psychological score.

**Phase 8 — Productisation**
Multi-user readiness (roles, coach view if wanted), offline cache, install evidence on a device,
account deletion, store packaging (TWA).

Ordering logic: trust the data (2.5) → have the data (3) → measure it (4) → control capital (5) →
formalise intent (6) → interpret (7) → ship (8).

---

## H. Recommended Next Phase

**Phase 2.5 — Data Integrity & Trust.** Start here, not with trading features.

Why: every later phase multiplies whatever the day layer does. A 100-day wall and a device-vs-profile
timezone split do not merely annoy today's user; they corrupt the join key that Phase 3 will use to
attach trades to days, and the sample that Phase 4 will report on. Fixing them is a bounded,
low-risk change to two functions and three pages, and it makes the journal usable for a full trading
year before any new entity is created. Building accounts and trades on top of a truncated, silently
shifted day layer would bake the defect into the analytics.

Runners-up: Phase 3 is the larger value, but it is not safe to start until 2.5 lands.

---

## Limitations of this audit

* Runtime behaviour was verified on 2026-11-05 against the deployed functions and the local harness;
  it was not re-executed for this report (nothing was run or changed here).
* Real hosted signup/login, and isolation between two real accounts, remain **NOT VERIFIED**.
* RLS state remains **BLOCKED**; no platform control exists in this workspace.
* A physical-device PWA install test remains **NOT EXECUTED**.
* This audit read code and schemas; it did not measure performance under load or review dependencies.
