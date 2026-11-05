# MONAD — Trade Data Contract v1 (design only)

Status: **design only. Nothing in this document is implemented, and no trade data exists in the app.**
This file exists so that Phase 3 starts from an agreed shape instead of reverse-engineering one.
It introduces no entity, no endpoint and no UI.

## 1. Why a contract

The PropDesk Expert Advisor already exports `journal_data.js` → `PD_DATA`, schema version 4, with
position-based identifiers, screenshots and server/GMT offsets. The mobile app must never guess what a
trade is. The contract below is the only agreed boundary between the desk and MONAD Backend, and it is
**versioned**: `contract: "monad.trade/1"`.

## 2. Transport (Phase 3 decision, not taken here)

Three candidates, none chosen yet: (a) signed upload of the PD_DATA file, (b) HTTPS POST of one record
batch per upload, (c) EA-side queue with retry. Whatever is chosen must be idempotent and resumable.
No broker connection, no live socket, no EA change in Phase 2.5.

## 3. Envelope

```json
{
  "contract": "monad.trade/1",
  "produced_by": "MONAD-EA",
  "ea_version": "x.y.z",
  "schema_source": "PD_DATA/4",
  "account": { "login": "string", "server": "string", "broker": "string", "currency": "USD",
               "account_type": "prop|live|demo", "leverage": 100 },
  "server_time": "ISO-8601Z", "gmt_offset_minutes": 0,
  "window": { "from": "ISO-8601Z", "to": "ISO-8601Z" },
  "trades": [ /* §4 */ ],
  "actions": [ /* §6 */ ]
}
```

## 4. Trade record (facts only)

| field | type | note |
|---|---|---|
| `position_id` | string | stable across partial closes; the dedupe key with account |
| `symbol` | string | |
| `side` | `buy`/`sell` | |
| `opened_at`, `closed_at` | ISO-8601 + offset | stored with the original offset, never re-derived |
| `volume_open`, `volume_closed` | string decimal | money/volume as decimal strings, never floats |
| `entry_price`, `exit_price` | string decimal | volume-weighted when partial |
| `deals` | array | partial closes: `{ deal_id, at, volume, price, commission, swap, profit }` |
| `realized_pnl`, `commission`, `swap` | string decimal | as reported by the server, not recomputed |
| `stop_loss`, `take_profit` | string decimal, nullable | nullable means "not set", never `0` |
| `risk_amount` | string decimal, nullable | only if the EA knew it at entry; never invented |
| `initial_risk_points` | string decimal, nullable | basis for R-multiple; if absent, R is **not** computed |
| `mae_points`, `mfe_points` | string decimal, nullable | from tick history; must record the sampling basis |
| `strategy_ref`, `checklist_ref` | string, nullable | references, not copies |
| `screenshots` | array of `{ slot, taken_at, mime, bytes_ref }` | up to 6, binary stored separately |
| `notes` | string, nullable | trader-written |

## 5. Derived values (never stored as facts)

`R-multiple = realized_pnl / risk_amount` — only when `risk_amount` is present and non-zero.
`MAE/MFE in R` — only when both the excursion and the risk basis exist.
Any metric whose inputs are missing is reported as **not available**, never as `0` and never as an
estimate. This is the rule that keeps the analytics screen honest.

## 6. Trader actions (behaviour, not psychology)

`{ at, action, context }` where `action` ∈ `open | modify_sl | modify_tp | partial_close | close |
add_position | cancel_pending | ignore_planned_setup | manual_intervention`, with `context` carrying
what can be observed (prices, planned vs actual volume, whether a plan existed). The EA records what
happened. It does not rate the trader, and MONAD does not compute a score.

## 7. Day linkage

A trade joins the journal through **one** value: the account's local calendar date, computed from the
profile timezone at import time, stamped as `local_date: "YYYY-MM-DD"`. No other rule may infer a day.
That is the same authority the journal already uses for `record_date`.

## 8. Versioning rules

Additive changes bump the minor (`monad.trade/1.1`); a breaking change bumps the major and the old
contract keeps being accepted for at least one release. Every import stores the contract string it was
parsed with, so a bad mapping can be traced later.
