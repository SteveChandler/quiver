# Live Crowd Signal — Design Spec

**Date:** 2026-06-20
**Status:** Draft (brainstorm output, pre-implementation-plan)
**Scope:** Backend crowd-verdict service. No UI in v1.

## Problem

A surfer's most useful pre-paddle question is *"how crowded is it right now?"* Quiver has
no way to answer it. We have no live presence / check-in system — we only learn a beach was
crowded *after* someone logs a session or files a crowd intel post. At current app density,
most beaches at most moments have **zero fresh first-party signal**, so a naive "real-time
crowd" feature would be blank almost everywhere.

This spec defines a backend service that produces a live crowd verdict per beach by combining
a paid external busyness proxy (cold-start blanket) with our own session/intel data (the only
signal that's actually about the lineup), via a precedence ladder. It exposes the verdict over
an API and defers all UI to a follow-on.

## Goals

- Given a `beach_id` and "now," return a crowd verdict: an absolute 1–5 level, a deviation
  flag (busier/normal/quieter than usual), the source tier it came from, a confidence level,
  and an `as_of` timestamp.
- Always return *something* useful where possible; degrade gracefully to "unknown" only when
  no signal of any kind exists.
- Be honest: never present a proxy (beach-activity) number as if it measures the lineup.
- Keep paid-API spend bounded and predictable.

## Non-goals (explicitly out of v1)

- Any UI (web or native). v1 ships the signal + API only.
- Surf-cam / computer-vision lineup headcount.
- Crowd *forecasting* / prediction of future windows.
- First-party (session-based) anomaly detection — deferred until per-(beach, hour) density
  is sufficient for a stable baseline.
- A map crowd layer or a "spots going off near you" feed (the deviation field is built to
  enable these later, but they are not in scope now).

## Key concepts

### "Crowded" = two complementary readings

1. **Absolute level (1–5, Empty→Packed)** — how busy it is right now, on the same scale as
   `sessions.crowd_level`. Answers *"is this always-packed spot packed?"*
2. **Deviation / anomaly** — is it busier than *this spot usually is at this hour*. Answers
   *"did my normally-empty spot suddenly get a crowd?"* A surge is the most actionable surf
   signal because it implies conditions are firing.

These are not redundant: a normally-packed break at its normal level is high-absolute /
zero-deviation; a normally-dead spot with a few extra surfers is low-absolute /
high-deviation. The verdict carries **both**.

### Deviation mechanic

Deviation needs a baseline (the "usual" for this beach at this hour-of-week). We do **not**
build that baseline ourselves for v1: BestTime's live response returns both the *live*
busyness and the *forecasted/typical* busyness for that exact moment, so

```
deviation = live_busyness − typical_busyness_for_now
```

is a subtraction over two numbers it already gives us. Bucketed to
`busier_than_usual` / `normal` / `quieter_than_usual` with a magnitude.

First-party (session) data stays **absolute-only** in v1 — we lack the per-(beach, hour)
sample density to compute a trustworthy first-party baseline.

## The crowd-verdict ladder (best signal wins)

For a beach at "now," walk down until a tier produces a value:

| Priority | Source | Reads | Freshness window | Confidence | Reading |
|---|---|---|---|---|---|
| 1 | Live first-party — `intel_posts` tagged `crowd` | A surfer just reported it | ~2 hrs | High | Absolute (+ post text) |
| 2 | Recent sessions — `sessions.crowd_level` near this time | Real lineup crowd, slightly lagged | ~3 hrs | High | Absolute |
| 3 | BestTime **live** busyness | Beach *activity* now (proxy) | live snapshot ≤ ~30 min old | Low | Absolute **+ deviation** |
| 4 | BestTime **typical** popular-times for this hour/day | Usually-this-busy baseline | always | Low | Absolute |
| 5 | Editorial — `beaches.crowd_level` / `crowd_tips` | Hand-authored prior | always | Lowest | Absolute |
| 6 | Unknown | No signal at all | — | None | Empty |

The verdict's `source` field records which tier won, so consumers can label honestly (e.g.
"2 surfers reported light crowd 40m ago" vs "beach usually busy around now"). Deviation is
only populated when BestTime live (tier 3) is the winning or an available adjacent tier.

## Source → 1–5 normalization

- **`sessions.crowd_level`** — native 1–5; average across the freshness window.
- **Crowd `intel_posts`** — no numeric value; treat presence as a qualitative ≈4 bump and
  surface the post text. Do not let a single report dominate; require/weight by
  `confirmations_count` where present.
- **BestTime 0–100** — bucketed: 0–20→1, 20–40→2, 40–60→3, 60–80→4, 80–100→5.
- **Editorial** `low` / `moderate` / `high` → 2 / 3 / 4.

## Data model

### `beaches.besttime_venue_id` (new column, nullable text)
Maps a beach to its BestTime venue. Populated by a one-time matching script (name + lat/lon),
**human-verified for marquee spots**. `NULL` ⇒ beach skips tiers 3–4 and falls to
editorial/unknown.

### `beach_crowd_snapshots` (new table)
Cache of BestTime reads so the API never calls the paid service on request path.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `beach_id` | fk → beaches | |
| `kind` | enum (`live`, `typical`) | |
| `busyness_0_100` | int | |
| `typical_busyness_0_100` | int null | parallel "expected for now" on `live` rows, for deviation |
| `captured_at` | timestamptz | |

Indexed on `(beach_id, kind, captured_at desc)`. Migrations wrapped `BEGIN; … COMMIT;` per
`docs/MIGRATION_SAFETY.md`; RLS read-only to clients, writes service-role only.

## Components

1. **BestTime matching script** (one-time / occasional) — resolves `besttime_venue_id` for
   beaches. Outputs a review list of low-confidence matches for human verification.
2. **BestTime ingestion cron** (Seaside — fits the existing APScheduler/cron model) —
   - *typical* popular-times: pulled rarely (changes slowly), per matched beach.
   - *live* busyness: short cadence, **only for beaches recently viewed/favorited** (not the
     whole table), written as `live` snapshots with the parallel `typical_busyness_0_100`.
   - Built with the `defensive-paid-api-batching` discipline: hard daily credit ceiling,
     idempotent writes, no blind retries, and graceful fallthrough to tier 4 (typical) when
     the budget is spent.
3. **Crowd-verdict resolver** (pure function, web side) — reads fresh `intel_posts(crowd)` →
   recent `sessions` → `beach_crowd_snapshots(live)` → `(typical)` → `beaches.crowd_level` →
   unknown; normalizes to 1–5; computes deviation from a live snapshot; returns
   `{ level, deviation, source, confidence, as_of, label }`. Stateless, no paid calls.
4. **API endpoint** — `GET /api/beaches/:id/crowd` returns the verdict object. Reads cached
   snapshots + DB only. Follows existing API middleware (`withAuth`) conventions.

## Cost control

BestTime bills per credit; *live* busyness is the expensive call. Controls:
- Never fetch on page/API load — serve cached snapshots only.
- Live refresh limited to beaches with recent user interest, cached ~15–30 min.
- Hard daily credit ceiling; once hit, ingestion stops and the resolver simply falls through
  to typical-times / editorial. No degradation in correctness, only in freshness.

## Risks

- **Wrong venue↔beach matches** — a `besttime_venue_id` pointing at the wrong POI yields
  *confidently wrong* data. Mitigation: human-verify marquee spots; flag low-confidence
  matches; allow per-beach disable.
- **Beach-activity vs. lineup conflation** — BestTime measures everyone at the beach POI
  (sunbathers, tourists), not surfers in the water. On a hot flat day a positive deviation is
  beachgoers, not crowd. Mitigation: tiers 3–4 are always **low confidence**; UI (later) must
  label as "beach activity," not lineup.
- **Calendar baseline flags good swell as anomaly** — surf crowd is condition-driven, not a
  weekly rhythm, so deviation will spike whenever conditions fire. This is the *intended*
  signal ("it's pumping and everyone's out"), but must be understood as such. A future,
  optional refinement is a condition-adjusted baseline.
- **Paid-API spend** — see Cost control. The ceiling makes worst-case spend bounded.

## Open questions

- Exact freshness windows for tiers 1–2 (proposed ~2 hrs / ~3 hrs) — tune against real
  session-logging latency.
- Whether crowd `intel_posts` should resolve to a fixed ≈4 or scale with `confirmations_count`.
- BestTime tier/plan and the concrete daily credit ceiling number.
- "Recently viewed/favorited" definition that drives which beaches get live refresh.

## Follow-ons (post-v1)

- UI surfaces (native beach detail first, then map).
- "Spots going off near you right now" feed/alert — scans the deviation field across beaches.
- First-party anomaly detection once per-(beach, hour) session density supports a baseline.
- Surf-cam + CV lineup headcount as a high-accuracy tier.
