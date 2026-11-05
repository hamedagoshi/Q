# MONAD — Phase 1.3 Report
Authentication, UserProfile & Application Routing · 2026-11-05

## 1. What already existed (inspected before writing code)

| Path | State |
|---|---|
| `MONAD/brand/final/` (assets, raster, tokens.json) | Phase 1.1, untouched |
| `MONAD/design-system/` (tokens.css, base.css, components.css, theme.js, ui.js, lab) | Phase 1.2, reused as-is |
| `functions/` | empty before this phase |

No brand asset and no design-system file was edited. The app imports the Phase 1.2
token and component sheets directly; there is no second colour system, no duplicated
button, input or theme logic.

## 2. Architecture

```
MONAD/
  brand/final/            Phase 1.1 identity + tokens.json  (source of truth)
  design-system/          Phase 1.2 components + tokens.css (generated)
  app/                    Phase 1.3 application shell
    index.html            single entry, every route resolves here (SPA fallback)
    js/router.js          history router, async guards, 404
    js/auth.js            auth adapter (platform session; localhost test double)
    js/api.js             profile client (never sends owner_id)
    js/app.js             shell, route table, boot, profile bootstrap
    js/pages/*.js         one module per route (no monolith)
  functions/monadProfile.ts   server-side ownership + bootstrap + update
```

## 3. Routes

| Route | Guard | Notes |
|---|---|---|
| `/` | auth | Today |
| `/journal` | auth | Phase 2 placeholder |
| `/trading` | auth | Phase 3 placeholder |
| `/timeline` | auth | Phase 2 placeholder |
| `/calendar` | auth | Phase 2 placeholder |
| `/insights` | auth | later phase |
| `/settings` | auth | profile settings only |
| `/login`, `/signup` | guest only | authenticated users are sent to `/` |
| `/design-system` | none | static Phase 1.2 lab (directory), public |
| anything else | — | in-app not-found, URL preserved |

Unknown paths return the app shell so deep links and PWA/TWA start URLs stay stable.
The dev server (`app/tools_serve.py`) implements the SPA fallback; production must
configure the same fallback.

## 4. Authentication

* Platform session is the only production mechanism (`base44.auth` in the adapter).
  There is no custom credential store, no password field in any entity, and no
  password written to storage — asserted in the harness (`no password persisted`).
* `monadProfile` derives the owner from `base44.auth.me().id`. A `owner_id` supplied
  in the request body that differs from the session user is rejected with **403
  ownership_spoof_rejected** (executed).
* Unauthenticated HTTP call to the deployed function returns **401** (executed with
  curl, no session).
* `localhost` + `?test=1` selects a routing test double. It performs no
  authentication and exists only for the route/session harness.

## 5. Entity — UserProfile (the only entity created in this phase)

| Field | Type | Notes |
|---|---|---|
| owner_id | string | server-derived session user id |
| display_name | string (≤60) | free text |
| language | enum `fa`,`en` | default `fa` |
| timezone | string | IANA; bootstrap default `UTC`, never re-inferred |
| theme | enum `dark`,`light`,`system` | default `system` |
| created_at / updated_at | date-time | written by the function |

Base44 adds `id`, `created_date`, `updated_date`, `created_by` automatically.

**Unique constraint:** the platform exposes no index/constraint API, so a database-level
UNIQUE on `owner_id` could not be created (**NOT EXECUTED**). Instead the function
implements an idempotent, conflict-tolerant upsert: read by owner → create if absent →
re-read → keep the oldest row and delete any duplicate produced by a race. Evidence
below.

## 6. Executed evidence

### 6.1 Profile service (deployed function `monadProfile`)

| Call | Result |
|---|---|
| `bootstrap` (first) | `created: true`, id `6aec7b5158…` |
| `bootstrap` (again) | `created: false`, **same id** — idempotent |
| `update {display_name, language:en, theme:light, timezone:Asia/Tehran}` | `ok:true`, `updated_at` changed |
| duplicate row injected into the DB on purpose, then `bootstrap` | duplicate removed by `settle()`, **original preferences kept** (`en / light / Asia/Tehran`) |
| `UserProfile` list after that | `count: 1` |
| `get` with foreign `owner_id` | **403 ownership_spoof_rejected** |
| `update` with `language:de, theme:neon, timezone:../../etc/passwd` | **422**, three validation errors, path traversal rejected |
| unauthenticated `curl POST` | **401 unauthenticated** |

### 6.2 Application harness (`app/tests/app-tests.html`, headless Chromium, 390px iframe)

**18 / 18 PASS** — anonymous `/` → `/login?next=%2F`; anonymous `/settings` keeps
`next`; login returns to the requested route; direct `/journal` renders; reload on
`/settings` keeps the session; authenticated user is not bounced to `/login`; unknown
route shows not-found on its own URL; `/design-system/` served without auth; light and
dark themes apply; RTL computed for Persian; no horizontal overflow (375/375);
logout returns to `/login`; protected route after logout redirects; signup and login
screens render; no password in storage.

## 7. Acceptance criteria

1. Signup works — **UI flow PASS (test double)**, platform signup **NOT EXECUTED**
2. Login works — **UI flow PASS (test double)**, platform login **NOT EXECUTED**
3. Logout works — **PASS (adapter cleared + guard re-applied)**
4. Session restoration — **PASS (reload keeps the session)**
5. Protected routes reject unauthenticated — **PASS**
6. Direct route navigation — **PASS**
7. Unknown route handling — **PASS**
8. Profile bootstrap — **PASS**
9. Exactly one profile per user — **PASS** (`count: 1` after injected duplicate)
10. Duplicate creation safely resolved — **PASS** (`created:false`, dedupe)
11. Concurrent bootstrap — **PARTIAL**: duplicate-collapse path executed; a true
    parallel race was **NOT EXECUTED**
12. Existing preferences survive later login — **PASS**
13. Profile updates persist — **PASS**
14. Ownership checked server-side — **PASS** (session-derived, spoof rejected)
15. Cross-user read rejected — **NOT EXECUTED** (no second real account)
16. Cross-user update rejected — **NOT EXECUTED**
17. Cross-user delete rejected — **NOT EXECUTED**
18. RTL and LTR auth screens — **PASS**
19. Dark / Light / System themes — **PASS** (dark, light executed; `system` follows
    the OS preference through the Phase 1.2 controller)
20. `/design-system` accessible — **PASS**
21. No out-of-scope entities — **PASS** (only `UserProfile` exists)

## 8. Known limitations

* **No database-level UNIQUE on `owner_id`** — the platform has no index/constraint
  API. Mitigated by idempotent read-create-reread-settle; a genuine simultaneous
  double-insert is theoretically possible between the create and the settle read, and
  would be collapsed on the next bootstrap.
* Production frontend hosting is not deployed yet, so the platform OAuth/session flow
  could not be driven end to end from this workspace.
* The `localhost` test double is compiled into `js/auth.js`, gated by
  `?test=1` on localhost/127.0.0.1. It must be stripped before a public release.
* `monadProfile` includes a `delete` action used only for the §8 ownership test; no
  UI exposes it and profile deletion is out of scope for Phase 1.3.
* The design-system lab is served from the `/design-system/` directory, so that path
  is a static document rather than an SPA route.

## 9. NOT EXECUTED

* Platform signup / login / logout end to end against the Base44 auth service.
* Cross-user read / update / delete with two real authenticated accounts.
* True concurrent bootstrap race (parallel requests with a fresh profile).
* Database-level unique constraint on `owner_id` (not supported by the platform).
* Android device install, PWA install prompt, TWA packaging.


---

# Phase 1.4 — Security & Ownership Verification (2026-11-05)

Full detail: `security/SECURITY.md` · raw HTTP evidence: `security/results-unauthenticated.json`

## Modified files
- `functions/monadProfile.ts` — hardened: server-side audit trail, per-user bootstrap
  mutex, reconciliation on every read, deterministic error codes, allow-list validation.
- `security/SECURITY.md`, `security/run_unauth_tests.py`, `security/results-unauthenticated.json` — new.
- Nothing else was rebuilt: router, auth integration, design system, entity and the
  bootstrap contract are unchanged.

## Executed results (HTTP)

| Test | HTTP | Verdict |
|---|---|---|
| Unauthenticated read / update / delete | 401 ×3 | PASS |
| Invalid session (garbage bearer) | 401 | PASS |
| Expired session (past exp) | 401 | PASS |
| Forged bearer, foreign subject | 401 | PASS |
| Wrong method GET | 405 | PASS |
| CORS preflight | 200 | PASS |
| Forged `owner_id` with a valid session | 403 | PASS |
| Invalid enum value | 422 | PASS |
| Path traversal in `timezone` | 422 | PASS |
| Repeated bootstrap | 200 `created:false` | PASS |
| Duplicate reconciliation (3 rows → 1) | 200 | PASS |
| Preferences preserved through reconciliation | 200 | PASS |
| Delete with a foreign record id | 404 | PASS |
| Audit entry retrievable and secret-free | — | PASS |

## NOT EXECUTED in Phase 1.4
- Real hosted signup / login / logout.
- Session restoration and expiration with a genuine platform session.
- Two-account cross-user read / update / delete.
- Parallel authenticated bootstrap (no second authenticated principal available).
- Entity RLS state verification (requires an app-settings action).

## Carried-forward limitations from Phase 1.3 (still true)
1. No database-level UNIQUE on `UserProfile.owner_id` — the platform exposes no index
   API. Duplicate reconciliation is **not** a uniqueness guarantee.
2. Signup and login were never exercised against the hosted auth service.
3. Two independent real user accounts were never tested.
4. Bootstrap still uses read-create-read-delete reconciliation; the residual
   cross-isolate race is documented in `SECURITY.md` §4.
