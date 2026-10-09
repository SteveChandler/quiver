# Vercel cost — October 5, 2026

On October 5 the team spend budget warned that about $5 was left. The suspicion was that frequent pushes over the weekend of October 3–4 caused it. They did not: builds were about 4% of spend. This document records where the money actually goes, what shipped, what turned out not to be a problem, and how to measure it again.

## Summary

- **Spend is runtime, not builds.** About $2.50 a day of effective usage on October 3–4. Builds were $0.08–0.10 of that.
- **Two changes raised the runtime cost:**
  - Moving every function to `sfo1` on October 2 (#917/#918) put the same work in a more expensive region. That move was deliberate (database latency and 504s) and stays.
  - Proxy (`proxy.ts`) and function invocations rose about 2.5×.
- **Shipped on October 5:**
  - Header prefetch for signed-out visitors removed and `/ingest/*` excluded from the proxy (#958).
  - Water-quality hold reads deduplicated per request (#959).
  - Both are on prod via #960. Footer prefetch removal (#961) is on `main` and ships with the next release.
- **Spend Management:** "pause projects" is now **off** and the amount was raised by $20. A tripped budget will no longer take the site and crons offline.

## Where the money goes

Source: `vercel usage --breakdown daily`. Figures are effective cost, before the Pro plan's included credit.

| Service | Sep 28–Oct 1 (per day) | Oct 3–4 (per day) |
|---|---|---|
| Fluid Active CPU | $0.28 | $0.63 |
| ISR writes | $0.22 | $0.46 |
| Function invocations | $0.06 | $0.15 |
| Build CPU minutes | $0.00–0.27 | $0.08–0.10 |
| Daily total | $1.6–1.9 | $2.5–2.8 |

- **September:** $53 effective, $19.50 billed after credit. Builds were $3.33 of that.
- **Deploy counts:** 14 and 11 deploys on October 3 and 4. That is no higher than September 13–16 or October 1.
- **What batching pushes can save:** at most about $3 a month. `vercel.json` already skips builds for docs, test, planning and script-only changes, and limits git deploys to `main`, `prod` and `preview/**`.
- **Region:** per-region usage (`vercel usage --group-by region`) shows the spend moving from Washington, D.C. to San Francisco on October 2.
- **Price versus volume:** with the move, CPU, memory and ISR costs rose by more than the volume increase alone explains. San Francisco has higher unit prices than D.C.

## What shipped

### Header and `/ingest` proxy traffic (#958)

Production log samples (30 minutes on October 4 afternoon and October 5 early morning) showed the same cluster on every page view: `/`, `/features`, `/cams`, `/tools`, `/roadmap`, `/whats-new` and `/about`. That is the logo and the signed-out desktop nav, prefetched by `next/link`.

Each prefetch is a proxy invocation. `/roadmap` is `force-dynamic`, so each of its prefetches was also a full server render with two Supabase reads (about 100 per 30 minutes, all cache misses). PostHog's `/ingest/*` rewrite also ran through the proxy. Together these were 34–36% of proxy invocations.

**Change:**
- `prefetch={false}` on the logo and desktop nav links for signed-out visitors. Signed-in navigation keeps default prefetch.
- `proxy.ts` matcher excludes `ingest/`. The `next.config.mjs` rewrite still applies.

**After deploy:** on the new deployment, `/ingest/*` hits on the proxy dropped to zero and the header bursts stopped.

### Footer prefetch (#961, on `main`)

After #958, the remaining bursts were about 30 footer links prefetching whenever the footer scrolled into view (`/vs/surfline`, `/download`, `/privacy`, `/terms` and others). That was 9 bursts in 6.5 minutes. The fix is `prefetch={false}` on every footer link.

### Water-quality hold reads (#959)

One `/api/surf/call` resolves water-quality holds at three layers:
- the nearby candidate pool (`lib/services/discovery/candidate-pool-builder.ts`);
- discovery ranking (`lib/services/discovery/surf-discovery-orchestrator.ts`);
- the canonical decision (`lib/recommendations/canonical-decision/service.ts`).

Each layer re-read `water_quality_held_beaches`, `beach_water_quality`, `county_beach_advisory_runs` and `county_beach_advisories`. Sentry showed about 4.5 reads of each table per request.

**Change:** `lib/recommendations/major-event-hold/read-scope.ts` shares rows within one request through `AsyncLocalStorage`. It never shares decisions or reads across requests:
- every layer still validates rows and applies the 120-minute County staleness limit;
- failed reads are never reused.

**After:** one read per table per request. The County run table is read twice when La Jolla Shores is in the pool, because the two reads select different runs.

## Investigated, not problems

- **`get_nowcast_anchors` "362 ms":**
  - The figure came from `pg_stat_statements`, which has not been reset since May 23, 2026, so it is a lifetime mean.
  - Since migration `20260622013217_mv_nowcast_anchors.sql`, the function reads a materialized view and takes about 0.4 ms (`EXPLAIN ANALYZE`).
  - No change needed.
- **"30-second" `enhanced_forecasts` reads in Sentry:** a span-timing artifact.
  - The parent requests finished in 130–320 ms.
  - The Postgres mean for that query is 44 ms over 198k calls.
  - A handful of late span ends were multiplied by Sentry's sample weight.
- **Web pageviews in PostHog:** almost no web `$pageview` events are recorded, so PostHog cannot measure web traffic volume.
- **Server request volume:** Sentry's server-side transaction counts did not rise over October 2–4. The invocation increase therefore came from the proxy and from cached responses, not from page renders or API calls.

## Test traffic reaching production

`/api/recommendations/pending-call-check` (about 30k a week) and `/api/cancellation-feedback` (about 16k a week) were among the busiest server routes in Sentry.

**Signs it was tests, not users:**
- the traffic arrived in hourly bursts;
- most responses were 403 (a test token) or 429;
- no request carried a user id.

**Source:** quiver-native Jest runs with `API_BASE_URL` defaulting to production.

**Fixed on native `main`:**
- 891079f0 points tests at `api.quiver.invalid`.
- #419 fails any unmocked non-local request.

Checkouts and branches older than October 5 still leak until they merge `main`.

## Remaining database load (not Vercel cost)

From `pg_stat_statements` (lifetime totals; re-measure before acting):

- **Seaside (Fly):**
  - `get_beach_observation_station`: about 11% of database time, from the backfill cron.
  - `cron_runs` updates: about 207 ms each.
  - These slow the shared database for Vercel functions, and waiting time is billed as provisioned memory.
- **`/api/surf/call`:** still reads `beaches`, `profiles`, `favorite_beaches` and `custom_spots` 2–4 times per request, across separate modules.
- **Beach pages (`/[intent]/[city]/[beachSlug]`):**
  - The page is `force-dynamic` with 15-minute CDN caching, so every crawler hit on an uncached URL is a full render of about 10 queries.
  - `generateMetadata` and the page both call `getSpotSurfReportPublic`. Whether React `cache()` deduplicates them is unverified.

## How to measure again

```bash
# Daily cost by service (effective vs billed)
vercel usage --breakdown daily --format json
# Per region, per project
vercel usage --group-by region --from <date> --to <date>
vercel usage --group-by project
```

- **Request logs:**
  - `vercel logs --json --environment production --since … --until …` repeats the same 50 rows when paginated. Page backward by setting `--until` to the oldest timestamp returned.
  - Runtime logs are kept for about a day.
  - Log rows show `source` (`serverless`, `serverless-middleware`, `static`) and `cache`. `requestPath` has no query string, so RSC prefetches look like page requests. Group by co-occurrence within about 1.5 s to spot prefetch bursts.
- **Per-route metrics:** Observability Plus is required (the API returns 402 on this plan).
  - Use Sentry instead (org `quiver-z4`): `transaction.op:http.server is_transaction:true` grouped by `transaction`.
  - For Supabase load per route, query `span.op:http.client` spans to `*supabase.co*`, grouped by `transaction` with `sum(span.duration)`.
  - Counts are already extrapolated from the trace sample rates in `lib/monitoring/sentry-config.ts`.
- **Database:** `pg_stat_statements` ordered by `total_exec_time`.
  - Check `pg_stat_statements_info.stats_reset` first.
  - Avoid queries in the `:57–:03` cron window.

## Open items

- [ ] Compare October 6 daily cost (Fluid Active CPU, function invocations) with October 3–4 to confirm the effect of #958/#959.
- [ ] Ship #961 (footer prefetch) with the next batched prod release.
- [ ] Consider removing the duplicate `beaches`/`profiles`/`favorite_beaches`/`custom_spots` reads in `/api/surf/call`, and applying the read scope to `/api/surf/discover` and bulk forecasts.
- [ ] Check the Seaside `cron_runs` update latency with a fresh `pg_stat_statements` window.
