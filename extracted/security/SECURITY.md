# MONAD — Phase 1.4 Security & Ownership Verification

Date: 2026-11-05 · Target: deployed function `monadProfile` · Entity: `UserProfile`

## 1. Trust model

| Assumption | Consequence |
|---|---|
| The browser is untrusted | Route guards are UX only; they are never the security boundary. |
| Identity comes only from the platform session | `base44.auth.me().id` inside the function is the single source of ownership. |
| Any `owner_id` in a request body is hostile input | Mismatch → `403 ownership_spoof_rejected`. A matching id is ignored, not used. |
| Client-side filtering is not isolation | Every read and write re-derives the owner server-side in the same query. |
| Platform RLS is not assumed | The function does not depend on RLS for its own correctness. RLS is still recommended (see §5, R2). |

## 2. Control inventory

| Control | Where | Behaviour |
|---|---|---|
| Session verification | `monadProfile` step 1 | `auth.me()`; missing or throwing session → `401 unauthenticated` |
| Owner derivation | step 1 | `userId = me.id`, never from body |
| Owner spoof rejection | step 2 | different `owner_id` → `403 ownership_spoof_rejected` |
| Ownership-scoped reads | `rowsFor()` | `filter({owner_id})` **and** a post-filter `r.owner_id === ownerId` |
| Ownership-scoped update | `action === 'update'` | record is located through the owner-scoped query; the id is never taken from the body |
| Ownership-scoped delete | `action === 'delete'` | the requested id must appear inside the caller's own result set, else `404 not_found` |
| Deterministic errors | all paths | fixed codes: `unauthenticated`, `ownership_spoof_rejected`, `validation_failed`, `not_found`, `method_not_allowed`, `unknown_action`, `server_error` |
| Method control | request entry | only `POST`; `OPTIONS` for preflight; everything else `405` |
| Cache control | `json()` | `Cache-Control: no-store` on every response |
| Input validation | `validatePatch()` | allow-list of four fields; enum and IANA-format checks; unknown keys dropped |
| Audit trail | `audit()` | structured JSON: event, outcome, truncated user reference, field names. No password, token, email or headers |
| Race narrowing | `withUserLock()` | per-user in-process mutex around bootstrap (not a distributed lock) |
| Duplicate reconciliation | `settle()` | oldest row kept, extras deleted; runs on `get`, `bootstrap` and `update` |

## 3. Executed tests

All HTTP results below were produced against the deployed function. Raw JSON:
`security/results-unauthenticated.json`.

| # | Test | Method / input | HTTP | Body | Verdict |
|---|---|---|---|---|---|
| 1 | Unauthenticated profile read | POST `{action:get}` | **401** | `unauthenticated` | PASS |
| 2 | Unauthenticated profile update | POST `{action:update}` | **401** | `unauthenticated` | PASS |
| 3 | Unauthenticated profile delete | POST `{action:delete}` | **401** | `unauthenticated` | PASS |
| 4 | Invalid session (garbage bearer) | `Authorization: Bearer not-a-token` | **401** | `unauthenticated` | PASS |
| 5 | Expired session (past `exp`) | JWT-shaped, `exp`=2020, bad signature | **401** | `unauthenticated` | PASS |
| 6 | Forged bearer with foreign subject | same token, `action:bootstrap` | **401** | `unauthenticated` | PASS |
| 7 | Wrong method | `GET` | **405** | `method_not_allowed` | PASS |
| 8 | CORS preflight | `OPTIONS` | **200** | `ok` | PASS |
| 9 | Forged `owner_id` (authenticated session) | `{action:get, owner_id:"6a00…"}` | **403** | `ownership_spoof_rejected` | PASS |
| 10 | Invalid input validation | `{theme:"neon"}` | **422** | `validation_failed` + field error | PASS |
| 11 | Path traversal in a field | `timezone:"../../etc/passwd"` | **422** | three validation errors | PASS |
| 12 | Repeated bootstrap (idempotency) | `{action:bootstrap}` ×3 | **200** | `created:false`, identical id | PASS |
| 13 | Duplicate reconciliation | 2 extra rows injected → bootstrap | **200** | back to `count: 1`, oldest kept | PASS |
| 14 | Preference preservation through reconciliation | compare before/after | **200** | `en / light / Asia/Tehran` unchanged | PASS |
| 15 | Delete with a foreign / stale record id | `{action:delete, id:<other>}` | **404** | `not_found` | PASS |
| 16 | Audit entry retrievable, secret-free | log viewer | — | `{"t":"monad.security","event":"auth.verify","outcome":"denied_unauthenticated","user":null}` | PASS (single entry retained) |
| 17 | Cross-user read | two real accounts | — | — | **NOT EXECUTED** |
| 18 | Cross-user update | two real accounts | — | — | **NOT EXECUTED** |
| 19 | Cross-user delete | two real accounts | — | — | **NOT EXECUTED** |
| 20 | Concurrent bootstrap (parallel authenticated requests) | — | — | — | **NOT EXECUTED** |
| 21 | Real hosted signup / login / logout | — | — | — | **NOT EXECUTED** |
| 22 | Session restoration against the platform session | — | — | — | **NOT EXECUTED** |

Test 13 is not a uniqueness guarantee. It proves the reconciliation path works when
duplicates already exist. It does not prevent two simultaneous inserts on different
isolates.

## 4. Concurrency investigation

Current behaviour of `bootstrap`:

```
lock(user)  →  SELECT by owner  →  if rows: settle & return
                               →  else INSERT  →  SELECT again → settle  →  return
```

What is real:
* Same-isolate interleaving is serialised by `withUserLock` (map keyed by user id).
* If an insert still races, the loser re-reads, finds the winner's row and returns it
  (`raced_recovered`) instead of failing or creating a second visible profile.
* Every later `get`, `update` or `bootstrap` collapses leftovers, so duplicates never
  reach the UI for more than one request.

**Residual race (stated plainly):** two requests handled by different isolates can both
observe "no profile" and both insert. There is no atomic compare-and-set, no unique
index and no transaction boundary available through the platform API. The window is
small (one round trip) and the damage is bounded to a duplicate row that the next
request deletes.

**Safest supported mitigations, in order of strength:**
1. **Platform-level unique index on `owner_id`** — the only true fix. Not exposed today;
   this is a platform request, not something to fake in application code.
2. **Single-writer bootstrap** — perform profile creation in exactly one place (already
   true: only `action:'bootstrap'` inserts) and never add a second insert path.
3. **Sweep on read** (already implemented) — keeps duplicates invisible and self-healing.
4. **In-process mutex** (already implemented) — narrows the same-instance window.

The implementation was not replaced with an unsupported construct; the existing
read-create-read-delete logic was kept and hardened.

## 5. Residual risks

| id | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Duplicate `UserProfile` rows under multi-isolate concurrency | Low | §4 items 1–4; duplicates are swept on the next request |
| R2 | If entity RLS is disabled in app settings, a client could query `UserProfile` directly through the platform entity API and read other rows | Medium | Enable RLS on `UserProfile` (owner-only action in app settings; cannot be toggled from this workspace). The function itself does not depend on RLS. Keep no sensitive data in this entity |
| R3 | No rate limiting on the function | Low | Platform-level throttling; out of scope for this phase |
| R4 | `delete` action exists although profile deletion has no UI | Low | Documented; unreachable from the app shell |
| R5 | Audit log retention observed as a single entry in the viewer | Low | Logging is structured and secret-free; retention is a platform concern |

## 6. NOT EXECUTED

* Real hosted signup, login, logout against the platform auth service.
* Session restoration and expiration using a genuine platform session.
* Two-account (User A / User B) isolation tests: cross-user read, update, delete.
* Truly parallel authenticated bootstrap requests (no second authenticated principal
  is available from this workspace).
* Entity RLS state verification (no API exposed; app-settings action required).
* Automated dependency or OWASP scan.

Simulated accounts and the localhost routing double were **not** used as evidence for
any security verdict above.
