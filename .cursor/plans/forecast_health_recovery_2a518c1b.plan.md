---
name: Forecast health recovery
overview: Make enhanced forecast health checks reliable by replacing the latest-per-beach view with an index-probe plan, and reduce marine staleness to under 6h by increasing refresh throughput while keeping the existing semantics.
todos:
  - id: db-fast-latest-view
    content: Add concurrent index + replace v_enhanced_forecast_latest with LATERAL+LIMIT definition; verify with EXPLAIN ANALYZE.
    status: pending
  - id: marine-cron-throughput
    content: Update vercel.json marine cron (maxBeaches and/or frequency) to cycle all beaches under 6h.
    status: pending
    dependencies:
      - db-fast-latest-view
  - id: log-noise-guard
    content: Optionally guard tide grouping/logs so marine-only runs don't emit tide station grouping noise.
    status: pending
  - id: validate-health
    content: Validate forecast health endpoint reports enhancedAvailable=true and marine staleness drops under 6h after a cycle.
    status: pending
    dependencies:
      - db-fast-latest-view
      - marine-cron-throughput
  - id: changelog
    content: Update CHANGELOG.md under [Unreleased] with monitoring DB + cron changes.
    status: pending
    dependencies:
      - validate-health
---

# Forecast Health Recovery Plan

## Scope

- Fix enhanced forecast health check failing due to DB statement timeout.
- Reduce marine staleness so the existing **>6h critical** threshold is realistically met.

## Files

- [supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql](supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql) – replace view definition to avoid table scans; add a supporting index (done as a new migration to allow `CONCURRENTLY`).
- [supabase/migrations/](supabase/migrations/) – add a new migration that creates the index **CONCURRENTLY** (cannot run inside a transaction).
- [vercel.json](vercel.json) – increase marine cron throughput (raise `maxBeaches` and/or increase frequency) so all 261 beaches are refreshed within <6h.
- [app/api/cron/forecasts/refresh/route.ts](app/api/cron/forecasts/refresh/route.ts) – (optional) prevent confusing tide logs during marine-only runs (guard tide grouping behind `runTide`).
- [CHANGELOG.md](CHANGELOG.md) – record monitoring/cron changes.

## Steps

1. **DB: Make `v_enhanced_forecast_latest` fast under load**

- Create a new partial index on `enhanced_forecasts` optimized for “latest row by beach” lookups.
- Replace the view with a `beaches` + `LATERAL (ORDER BY updated_at DESC LIMIT 1)` pattern to turn the query into ~261 index probes instead of scanning/sorting the entire `enhanced_forecasts` table.
- Verify with `EXPLAIN ANALYZE` that it uses index scans and completes within the statement timeout.

2. **Cron: Increase marine refresh throughput to meet the 6h threshold**

- Update `vercel.json` marine cron to increase `maxBeaches` so the full cycle finishes comfortably under 6h.
- Recommended starting point: `maxBeaches=160` (cycle time \(261/160 * 3h \approx 4.9h\)).
- Keep the existing selection window (`windowHours=3`) unless logs show the job frequently hits time budgets.

3. **(Optional) Reduce log noise**

- In `app/api/cron/forecasts/refresh/route.ts`, only run/log tide station grouping when `runTide` is true (avoids misleading “beachesConsidered: 261, stations: 0” during marine runs).

4. **Validate**

- Hit `GET /api/monitoring/forecast-health` and confirm:
    - `enhancedAvailable: true`
    - no “statement timeout” issues
    - marine `critical` count trends down after one full cycle (<6h oldest)

5. **Document**

- Update `CHANGELOG.md` under `[Unreleased]` with the view/index change and cron throughput update.

## Testing