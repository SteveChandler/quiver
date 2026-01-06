---
name: Fix forecast freshness UI
overview: Make ‘Last updated’ and tide staleness indicators use the latest enhanced forecast write time (not the oldest lookback row), so Scripps and other beaches show fresh status immediately after updates.
todos:
  - id: fix-api-metadata
    content: Update `/api/forecasts/update-enhanced` metadata to use `v_enhanced_forecast_latest.updated_at` (or max updated_at) rather than the first forecast row.
    status: pending
  - id: fix-tide-diagnostics-freshness
    content: Update `generateTideDiagnosticsFromForecasts()` to compute freshness from max(updated_at) so the tide outdated banner is accurate.
    status: pending
    dependencies:
      - fix-api-metadata
  - id: tests
    content: Add/adjust tests to cover mixed updated_at scenarios for API metadata and tide diagnostics freshness.
    status: pending
    dependencies:
      - fix-tide-diagnostics-freshness
  - id: local-validate
    content: Validate locally by regenerating Scripps and confirming metadata/banner update immediately; then verify in prod with cache-busting curl.
    status: pending
    dependencies:
      - tests
  - id: changelog
    content: Update `CHANGELOG.md` under `[Unreleased]` describing the freshness/staleness indicator fix.
    status: pending
    dependencies:
      - local-validate
---

# Fix Enhanced Forecast Freshness + Tide “Outdated” Banner

## Implementation Plan

### Scope
- Fix the beach page still showing **“Last updated 1/4 …”** even after a successful Scripps regen.
- Root cause: we include **yesterday** in `enhanced_forecasts` fetch for tide chart lookback and sort ASC, so `forecasts[0].updated_at` is often the **oldest row**, not the latest write.
- Update all freshness indicators to use **latest write time**:
  - Prefer `public.v_enhanced_forecast_latest.updated_at` (canonical).
  - Fallback to `max(forecasts[].updated_at)` when necessary.

### Files
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/app/api/forecasts/update-enhanced/route.ts]( /Users/stevenchandler/Desktop/quiver/quiver/app/api/forecasts/update-enhanced/route.ts ) – fix returned `metadata.lastUpdated/isStale/dataAge` to use latest-per-beach source, not `forecasts[0]`
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/lib/utils/forecast-service-utils.ts]( /Users/stevenchandler/Desktop/quiver/quiver/lib/utils/forecast-service-utils.ts ) – reuse the existing “latest metadata” approach (already uses `v_enhanced_forecast_latest`) as the reference pattern
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/lib/utils/tide-diagnostics-generator.ts]( /Users/stevenchandler/Desktop/quiver/quiver/lib/utils/tide-diagnostics-generator.ts ) – compute tide freshness from **max updated_at** (or accept an explicit updatedAt override)
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/components/forecast/tide-warning-banner.tsx]( /Users/stevenchandler/Desktop/quiver/quiver/components/forecast/tide-warning-banner.tsx ) and/or [components/forecast/tide-chart-enhanced.tsx]( /Users/stevenchandler/Desktop/quiver/quiver/components/forecast/tide-chart-enhanced.tsx ) – ensure the banner uses the corrected diagnostics fields (no UI logic changes if generator is fixed)
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/hooks/use-beach-detail-data.ts]( /Users/stevenchandler/Desktop/quiver/quiver/hooks/use-beach-detail-data.ts ) – optional: after admin “Update Forecast”, force SWR revalidation (but should be unnecessary once metadata is correct)
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/__tests__/components/forecast/tide-diagnostics.test.tsx]( /Users/stevenchandler/Desktop/quiver/quiver/__tests__/components/forecast/tide-diagnostics.test.tsx ) (or add a new unit test) – assert freshness uses latest updated_at
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/__tests__/app/api/forecasts/update-enhanced/route.test.ts]( /Users/stevenchandler/Desktop/quiver/quiver/__tests__/app/api/forecasts/update-enhanced/route.test.ts ) (or add) – assert `metadata.lastUpdated` matches `v_enhanced_forecast_latest.updated_at` (not the first forecast row)
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/CHANGELOG.md]( /Users/stevenchandler/Desktop/quiver/quiver/CHANGELOG.md ) – document fix under `[Unreleased]`

### Steps
1. **API metadata correctness**
   - In `GET /api/forecasts/update-enhanced`, stop deriving `metadata.lastUpdated` from `data.forecasts[0].updated_at`.
   - Instead:
     - Query `v_enhanced_forecast_latest` for `{ updated_at, data_source }` for `beachId`.
     - Use that for `metadata.lastUpdated`, staleness computation, and displayed age.
   - Keep response caching headers unchanged.

2. **Tide diagnostics freshness correctness**
   - In `generateTideDiagnosticsFromForecasts()`, compute freshness age from `max(forecasts[].updated_at)` rather than `forecasts[0].updated_at`.
   - This prevents the “Tide data may be outdated” banner from sticking just because we include a lookback day.

3. **(Optional) Admin/UX immediate refresh**
   - If the admin “Update Forecast” button is expected to immediately reflect on the beach page, add a lightweight cache-bust option:
     - either SWR `mutate()` in the beach page after update,
     - or append `&v=${Date.now()}` to the fetch URL in a manual refresh path.
   - This is optional because the corrected metadata should make the status accurate even if older lookback rows remain.

4. **Tests**
   - Add a unit test that constructs forecasts with mixed `updated_at` values and asserts:
     - tide freshness uses the latest timestamp
     - API metadata uses latest-per-beach timestamp (mock `v_enhanced_forecast_latest`)

5. **Validate locally, then prod**
   - Locally:
     - Trigger Scripps regen from Admin.
     - Fetch `/api/forecasts/update-enhanced?...&v=...` and confirm `metadata.lastUpdated` is ~now.
     - Confirm the Tide “outdated” banner disappears (or updates to ~now).
   - Prod:
     - Repeat the cache-busting curl.
     - Hard refresh the Scripps page; banner/last updated should match latest run.

### Testing Commands / Checks
- Manual curl (cache-busting):
  - `GET /api/forecasts/update-enhanced?beachId=<id>&days=2&v=<unix>`
  - Verify:
    - `max(forecasts[].updated_at)` ~ now
    - `metadata.lastUpdated` ~ now
    - `metadata.isStale` false (given CDIP thresholds)

### Expected Outcome
- After an admin regen, Scripps immediately shows **fresh last-updated** and the tide warning banner aligns with the latest forecast write time, even though older lookback rows may still exist in the returned range.
