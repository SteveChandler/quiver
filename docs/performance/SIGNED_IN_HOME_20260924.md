# Signed-in home performance — September 24, 2026

Follow-up to `SIGNED_IN_HOME_20260909.md`. Scope: time until the surf call appears on `/` for signed-in users, and the `/api/surf/discover` request that sets it. Native (`quiver-native`) calls the same route, so every server change here is response-identical.

## Baseline (production, before this change)

The numbers below are PostHog field data for the last 30 days. The sample is small: about 70 cold loads, because home events only fire after analytics consent.

| Metric | p50 | p75 / p90 |
|---|---|---|
| First contentful paint | 1.0 s | p75 1.3 s |
| Discovery request start → call rendered | 5.9 s | p90 8.0 s |
| LCP | 2.5 s | p75 7.1 s |
| INP | — | p75 64 ms |
| CLS | — | p75 0.075 |

- **Stable median:** the weekly time-to-call median sat between 5.5 s and 6.5 s from late August onward.
- **Background polling:** one open tab issued 205 discovery requests over 55 hours. That is the 15-minute decision expiry refetching while the tab was hidden.
- **Blur/focus loop:** other loads show 6 requests in about 50 s, from the loop fixed separately in `hooks/use-surf-discovery.ts`.

## Where the server time goes

A local profiler ran `discoverSurfSpots` against production data, read-only, with the founder's Pro account and a San Diego location (44 candidates). It used the new `onStageTiming` hook. Warm runs took about 3.0 s end to end, measured when a trivial query took 78 ms from the laptop:

- **Discovery stages:**
  - candidates ~0.55 s
  - forecasts ~0.5 s
  - context ~0.2 s
  - scoring (CPU) ~0.35 s
  - favorites ~0.1 s (on this release base, favorites are read before candidates for "My spots", so this time is counted in candidates)
  - similarity ~0.6–1.1 s
  - ranking ~0.2 s
  - photos ~0.1 s
- **Route steps outside discovery:** entitlement 60 ms, calibration 60 ms, profile read 50 ms, holds ~0.2 s.

The route is a chain of roughly 17–20 sequential database round trips. Total time tracked round-trip time directly: later runs, when a trivial query took 273 ms, came in at 3.6–4.0 s.

The database is in Northern California, and `/api/surf/week-scout` was already pinned to `sfo1` for that reason (#828/#829). `/api/surf/discover` had no region, so it ran on the default East Coast region and paid a cross-country round trip at every step. That explains most of the gap between about 3 s locally and about 5.5 s in production.

## Changes

Every change preserves the results and the response body.

1. **Colocation:** `vercel.json` pins `app/api/surf/discover/route.ts` to `sfo1`. A test in `__tests__/config/vercel-config.test.js` keeps discover and Week Scout colocated. This is a hosting change; it takes effect when deployed.
2. **Overlapped reads:**
   - **Profile read:** the route starts it alongside the entitlement read.
   - **Holds:** water-quality and major-event resolution run concurrently in `evaluateMajorEventHoldCandidates`. Each keeps its own fail-closed fallback, following the #829 pattern.
   - **Photos:** the two photo lookups run together.
3. **Redundant query removed:** calibration (`isCalibrated`) is now read from the beach rows discovery already loaded. Only rows that arrived without `shoaling_factors` are queried.
4. **Observability:**
   - **Server timing:** the route sends `Server-Timing` with every discovery stage and route step. Clients ignore the header, native included.
   - **Time to call:** home emits `home_call_rendered` with `ms_since_request`, `ms_since_navigation`, `request_number` and `recheck`, joined to `home_discovery_request` by `home_load_id`. It replaces `surf_window_impression` (surface `homepage`), which disappeared with the ranked module.
5. **Hidden-tab expiry:** when the 15-minute decision expiry fires in a hidden tab, the call is dropped instead of refetched. Returning to the tab rechecks it, so the tab stays fail-closed and stops polling in the background.
6. **Perceived wait:** the cold load shows the home beach's media card with native's "Checking the buoy" line instead of a grey block. Its map image downloads during the discovery wait.
7. **Hero images:** hero maps are sized per breakpoint (phone 400×500 @2x, `sm`+ 800×500 @2x), with the same framing as before.

   | Map | Before (every screen) | Phone now | `sm`+ now |
   |---|---|---|---|
   | Swell | 254 KB | 77 KB | 154 KB |
   | Sat | 1.03 MB | 291 KB | 591 KB |

## Verifying after release

- **Server:** read `Server-Timing` on a `/api/surf/discover` response in DevTools. `discover-*` stages should shrink by roughly the removed cross-region round trips.
- **Users:** time to call, from PostHog:

```sql
SELECT quantile(0.5)(toFloat(properties.ms_since_request)) AS p50,
       quantile(0.9)(toFloat(properties.ms_since_request)) AS p90,
       count() AS n
FROM events
WHERE event = 'home_call_rendered'
  AND properties.recheck = false
  AND timestamp >= now() - INTERVAL 14 DAY
```

- **Background polling:** requests per `home_load_id` (`max(request_number)`) should stop growing for tabs left open in the background.

## Native parity notes (not changed here)

- **Hero satellite image:** 800×600 @2x (`media-lifecycle.ts`), about 750 KB. A phone-sized equivalent is about 340 KB.
- **Swell hero backdrop:** 800×520 @2x. Its streak overlay is calibrated to that size and zoom (see the comment in `swell-field-hero.tsx`), so resizing it needs the overlay re-derived.
- **Cold load:** still a spinner ("Checking the buoy"). Web now shows the home beach during that wait.
- **No polling issue:** discovery uses React Query with `staleTime` 5 min and no refetch interval, so native has no hidden-tab polling problem.
- **Contract:** the `/api/surf/discover` response body is unchanged; the only addition is a header.

## Limits

- **Estimate, not measurement:** local timings vary with the laptop's network, and the database is shared and live. The production improvement from colocation is an estimate from round-trip counts until the release is measured with the queries above.
- **Similarity:** it stays bounded at ten concurrent RPCs per request. That limit is deliberate database protection (see the 09-09 report).
- **Payload size:** each response is about 162 KB of JSON, 44% of it full beach rows. Trimming fields would change a native-consumed contract, so it needs an additive, versioned approach.
