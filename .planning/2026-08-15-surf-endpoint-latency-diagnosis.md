# Surf endpoint latency — diagnosis (2026-08-15)

**Status:** diagnosis only. No code changed. Nothing measured against a running server.

Native client work on 2026-08-14 took cold Home from 3,862 ms to 1,442 ms. The remaining wait is
server-side. Simulator-measured against `dev.quiversurf.app`:

| Endpoint | Measured |
|---|---|
| `/api/surf/discover` (include-beach, Home) | ~2,828 ms |
| `/api/surf/call` (beach-detail) | ~2,998 ms |

## The measurement that constrains every hypothesis

`/discover` scores up to 60 beaches and fetches ~5,700 forecast rows. `/call` scores **one** and
fetches ~96. They land **170 ms apart**.

Latency is essentially independent of candidate volume. That rules out the forecast batch and the
scoring loop as the dominant cost, and points at fixed per-request overhead. Any proposed fix that
scales with beach count is aiming at the wrong thing.

## Findings (verified in code)

### 1. Water-quality hold resolution runs 4× per request, 4 serial hops each

`resolveWaterQualityHolds` (`lib/recommendations/major-event-hold/water-quality.ts:301`) is four
strictly sequential round-trips — no `Promise.all`:

1. `water_quality_held_beaches` (`:322`)
2. `beach_water_quality` (`:378`)
3. `county_beach_advisory_runs` (`:179`)
4. `county_beach_advisories` (`:235`) — genuinely serial, depends on the run id from #3

It runs from four call sites per request:

| Call site | |
|---|---|
| `lib/services/discovery/candidate-pool-builder.ts:242` | `orderPoolCandidates` |
| `lib/services/discovery/surf-discovery-orchestrator.ts:2189` | `rankBeaches` |
| `…/surf-discovery-orchestrator.ts:2209` | `enforceMajorEventHoldBeforeDiscoveryTruncation` |
| `lib/recommendations/canonical-decision/service.ts:64` (call) / `app/api/surf/discover/route.ts:287` (discover) | |

**= 16 water-quality round-trips per request.** Nothing memoises them — no request-scoped cache, no
module cache. `beach_water_quality` alone is queried 5× per request.

This is identical on both endpoints, which matches the volume-independent measurement exactly.

### 2. `/api/surf/call` builds a 65-beach pool and discards 100% of it

`app/api/surf/call/route.ts:339` passes `candidatePoolLimit: 1` and `includeBeachIds: [beachId]`.
But `canonical-decision/service.ts:46` **overrides `maxResults` to 60** — `candidatePoolLimit`
survives, `maxResults` does not. So `buildCandidatePool` runs unconditionally
(`surf-discovery-orchestrator.ts:1444`):

- `get_nearby_beaches` for 65 rows (`candidate-pool-builder.ts:167`)
- `beaches.select('*')` on all 65 — **full-width rows including `shoaling_factors` and terrain
  jsonb**, exactly the columns `route.ts:263` deliberately avoids
- the 4-query hold chain over 65 ids (`:242`)
- radius tiers `[25, 60, 100]` in a `for…await` (`:285-310`) → up to 6 serial hops if the 25 mi
  tier under-fills

Then `orchestrator.ts:1458`: `nearbyCandidateSlots = max(0, 1 − 1 − 0) = 0`. **All 65 discarded**
(`:1467`).

The forecast fetch itself is correctly scoped to the one included beach.

### 3. There is no caching between requests

Both routes are `dynamic = 'force-dynamic'` (`call/route.ts:38`, `discover/route.ts:24`), strip
`ETag`, and set `private, no-store`. No `unstable_cache`, no LRU, no Redis anywhere in
`app/api/surf`, `lib/services/discovery`, or `lib/recommendations`. `v_enhanced_forecast_latest` is
a plain view, not materialised.

**Two identical requests 10 seconds apart both do the full ~35 round-trips.**

### 4. Avoidable serial hops at the tails

- `getUserSurfPreferences` (`orchestrator.ts:1610`) awaited alone immediately before a `Promise.all`
  that could absorb it
- `getFavoriteBeachesFromDb` (`:2139`) awaited alone, independent of everything prior
- two sequential `enrichWithPhotos` (`:2271`, `:2275`) — same table
- `profiles` → `user_entitlements` sequential in both routes; independent

### 5. The server does not measure itself anywhere readable

Duration logs exist (`orchestrator.ts:2458`, `forecast-batch-fetcher.ts:159`) but go through
`log.debug`, and `lib/logger.ts:48` raises the minimum level to `warn` in deployed environments —
**so they never emit on `dev.quiversurf.app`.** Sentry is production-only
(`sentry-config.ts:99-102`), and even in production `/api/surf/*` matches none of the elevated
sampling patterns → 5% default. No PostHog server events, no `Server-Timing`.

## Ranked

| # | Cause | Est. | Effort |
|---|---|---|---|
| 1 | 16 serial water-quality round-trips | 1.2–2.0 s | low to confirm |
| 2 | Cold start (**inferred, not verified**) | 0.5–1.5 s first request | trivial to confirm |
| 3 | Discarded 65-beach pool on `/call` | 300–700 ms | low |
| 4 | Avoidable serial tail hops | 200–400 ms | low |
| 5 | `select('*')` incl. `raw_forecast` jsonb on `enhanced_forecasts` | scales with `/discover` only | medium |

**Not the problem** (verified, so nobody re-investigates): the forecast fetch is properly batched to
2 query groups regardless of beach count; `scoreBeachForDiscovery` is pure CPU with no DB; the rate
limiter is in-memory.

## Cheapest confirmation, before any fix

**Do this first — it decides whether the rest is worth chasing.** Fire 5 identical `/api/surf/call`
requests back to back. If #1 is ~1 s slower and #2-5 plateau, cold start sits on top of a query
floor; if all five are ~3 s, it is entirely serial round-trips. Read `x-vercel-id` and cross-check
the Vercel function log, which flags cold starts explicitly.

Second: count `resolveWaterQualityHolds` invocations in one request. A temporary `console.warn`
timer survives the prod log level where `log.debug` does not.

## Unknown without running the server

Per-round-trip latency depends on the Vercel function region vs the Supabase project region.
Neither is pinned in this repo — `vercel.json` has no `functions` block, and neither route sets
`runtime` or `preferredRegion`. Whether that is ~20 ms or ~120 ms per hop is a factor of 6 and it
decides the size of every item above. Also unknown: whether `MAJOR_EVENT_HOLD_MODE` is set on the
dev deployment, which would add an RPC to each of the four hold chains.
