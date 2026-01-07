---
name: Fix Surf Intel
overview: Fix Surf Intel showing as unavailable due to UTC date mismatch, standardize daily intel on per-beach local date, and make generation + reads reliable via an API route and Vercel cron.
todos:
  - id: tz-align
    content: Align Surf Intel forecast_date semantics to per-beach local date and update BestSurfWindow + intel generator accordingly.
    status: pending
  - id: api-gateway
    content: Add API route + client data gateway method for beach_daily_intel and remove direct Supabase client query from BestSurfWindow.
    status: pending
    dependencies:
      - tz-align
  - id: cron-gen
    content: Add /api/cron/daily-intel generation endpoint (beaches with prefs) and schedule it in vercel.json.
    status: pending
    dependencies:
      - tz-align
  - id: tests-docs
    content: Add targeted tests, update CHANGELOG, and update any impacted ARCHITECTURE.md docs.
    status: pending
    dependencies:
      - api-gateway
      - cron-gen
---

# Surf Intel Recovery Plan

## Scope

- Fix Surf Intel falsely showing “not available” after ~4pm PT by aligning `forecast_date` to **per-beach local date**.
- Make Surf Intel reads follow the repo’s **data gateway** pattern (avoid direct Supabase queries in client components).
- Ensure `beach_daily_intel` is **generated reliably** for **any beach with required preferences**.

## Files

- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/components/beach-detail/best-surf-window.tsx` – compute date in beach timezone; replace direct Supabase query with gateway/API call.
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/components/beach-detail/tabs/forecast-tab.tsx` – pass `beachTimezone` through to `BestSurfWindow` (already available as prop).
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/app/api/` (new route) – add a read API (e.g. `app/api/beach-daily-intel/route.ts`) returning latest record for `beachId + forecastDate` using `lib/api-utils.ts`.
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/lib/data/client.ts` – add `data.intel.getDaily(beachId, forecastDate)` that calls the new API route.
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/intel-generation-service.ts` – store `forecast_date` using **per-beach timezone** (fallback to `America/Los_Angeles`) instead of UTC.
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/app/api/cron/` (new route) – add a cron handler (e.g. `app/api/cron/daily-intel/route.ts`) that generates/upserts for beaches with required prefs (bounded batch).
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/vercel.json` – schedule the new intel cron 3x daily; include optional `maxBeaches` param.
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/CHANGELOG.md` – add an `[Unreleased]` entry.
- [ ] `/Users/stevenchandler/Desktop/quiver/quiver/components/beach-detail/ARCHITECTURE.md` + `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/ARCHITECTURE.md` (only if needed) – document the new daily intel API/cron integration.

## Steps

1. **Standardize date semantics**

- Define `forecast_date` as the beach’s **local date** (IANA timezone string), with fallback to `America/Los_Angeles` when unknown.
- Update `BestSurfWindow` to compute `todayLocal` using the beach timezone (not UTC).
- Update `IntelGenerationService.saveIntel()` to write `forecast_date` using the same rule.

2. **Replace direct client Supabase query** (per `/components` architecture guidance)

- Add an API route that returns the latest `beach_daily_intel` record for `beachId + forecastDate`.
- Use `lib/api-utils
- Use `lib/api-utils.ts.ts` helpers for envelopes + `handleApiError`.
- Update `BestSurfWindow` to fetch via `lib/data/client.ts` and continue to use `useDataFetcher`.

3. **Make generation reliable for “beaches with prefs”**

- Implement `/api/cron/daily-intel` to:
- Select candidate beaches that meet the “required prefs” criteria (same as `canGenerateIntel`).
- Generate + upsert intel for each beach with time-budgeting and logging.
- Accept `maxBeaches` (default conservative) so we stay under Vercel timeouts.

4. **Schedule + validate**

- Add Vercel cron entries for `/api/cron/daily-intel` at 6am/10am/2pm PT (or equivalent UTC schedules).
- Smoke test locally + in browser: check that Surf Intel appears at night for a beach that has intel.

5. **Tests + documentation**

- Add a unit test around the “local date string” helper (ensures no UTC flip).
- Add a lightweight API route test for `beach-daily-intel` response shape (and 400s for missing params).
- Update `CHANGELOG.md`.