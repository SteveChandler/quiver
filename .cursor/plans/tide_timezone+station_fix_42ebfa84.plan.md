---
name: Tide timezone+station fix
overview: Fix wrong “Next Tide” display by storing canonical UTC timestamps and consistently resolving the same NOAA CO-OPS station across tide pipelines, then formatting in the beach’s local timezone in the UI. Validate locally first (migration + regenerate Scripps + UI compare).
todos:
  - id: db-migration
    content: Add `next_tide_at` and `coops_station_id` columns to `enhanced_forecasts` via a new Supabase migration.
    status: pending
  - id: station-resolver
    content: Unify CO-OPS station resolution across `NOAACOOPSService` and NOAA hourly tide ingestion; add Scripps override → `9410230`.
    status: pending
    dependencies:
      - db-migration
  - id: hourly-parse-fix
    content: Fix `lib/services/noaa-tide-service.ts` to parse NOAA `YYYY-MM-DD HH:mm` timestamps as UTC explicitly.
    status: pending
    dependencies:
      - station-resolver
  - id: enhanced-forecast-write
    content: Update `EnhancedForecastService` to populate `next_tide_at` and `coops_station_id` and stop server-local formatted next tide time.
    status: pending
    dependencies:
      - hourly-parse-fix
  - id: ui-format-tz
    content: Update beach detail UI to format Next Tide using beach timezone (prefer `next_tide_at`, fallback to legacy fields).
    status: pending
    dependencies:
      - enhanced-forecast-write
  - id: tests-and-changelog
    content: Add/adjust tests for station resolution + timestamp parsing; update `CHANGELOG.md` under `[Unreleased]`.
    status: pending
    dependencies:
      - ui-format-tz
---

# Tide Timezone + Station Unification Plan

## Implementation Plan

### Scope
- Fix **Next Tide** showing in **UTC** (e.g., 6:37 PM instead of 10:37 AM PT) by storing a canonical UTC timestamp and formatting using the **beach timezone**.
- Unify tide station selection so **CO-OPS hilo**, **NOAA hourly tides**, and UI-derived displays all reference the **same CO-OPS station** for a beach (with overrides for known spots like Scripps).
- Fix NOAA hourly timestamp parsing (NOAA returns `YYYY-MM-DD HH:mm` without a TZ suffix even when `time_zone=gmt`).

### Files
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/supabase/migrations/]( /Users/stevenchandler/Desktop/quiver/quiver/supabase/migrations/ ) – add new columns to `enhanced_forecasts` for canonical tide time + station id
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/lib/services/noaa-coops-service.ts]( /Users/stevenchandler/Desktop/quiver/quiver/lib/services/noaa-coops-service.ts ) – centralize station resolution + add Scripps override
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/lib/services/noaa-tide-service.ts]( /Users/stevenchandler/Desktop/quiver/quiver/lib/services/noaa-tide-service.ts ) – fix hourly timestamp parsing + reuse station resolver
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/lib/services/enhanced-forecast-service.ts]( /Users/stevenchandler/Desktop/quiver/quiver/lib/services/enhanced-forecast-service.ts ) – populate new fields (`next_tide_at`, `coops_station_id`) and stop server-local `toLocaleTimeString()` output
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/components/beach-detail/tabs/forecast-tab.tsx]( /Users/stevenchandler/Desktop/quiver/quiver/components/beach-detail/tabs/forecast-tab.tsx ) – render Next Tide time using beach timezone from `beach.lat/lon`
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/lib/utils/timezone-utils.ts]( /Users/stevenchandler/Desktop/quiver/quiver/lib/utils/timezone-utils.ts ) – reuse `getTimezoneFromCoords()` for formatting
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/__tests__/]( /Users/stevenchandler/Desktop/quiver/quiver/__tests__/ ) – add/adjust unit tests for timestamp parsing + station resolver consistency
- [ ] [/Users/stevenchandler/Desktop/quiver/quiver/CHANGELOG.md]( /Users/stevenchandler/Desktop/quiver/quiver/CHANGELOG.md ) – document the fix under `[Unreleased]`

### Steps
1. **DB: add canonical tide fields**
   - Add columns to `public.enhanced_forecasts`:
     - `next_tide_at TIMESTAMPTZ NULL` (canonical UTC event time)
     - `coops_station_id TEXT NULL` (station used for next tide)
   - Keep existing `next_tide_time/next_tide_height/next_tide_type` for backwards compatibility.

2. **Unify station selection**
   - Create a single “resolve CO-OPS station id for beach” path used by:
     - `NOAACOOPSService.getStationForLocation()`
     - `getNearestTideStation()` / NOAA hourly tide ingestion
   - Add explicit override(s): `scripps`, `scripps-pier` → La Jolla station `9410230`.

3. **Fix NOAA hourly timestamp parsing**
   - In `lib/services/noaa-tide-service.ts`, parse `p.t` as UTC explicitly (same approach as `NOAACOOPSService`), rather than `new Date(p.t)`.
   - Ensure produced `ts` values are ISO with `Z` (UTC).

4. **Populate + use the new fields in enhanced forecasts**
   - In `EnhancedForecastService.getTideInfoForTime()`:
     - Compute `next_tide_at` as a UTC timestamp (from CO-OPS tide event unix seconds).
     - Store `coops_station_id` from the station resolver.
     - Set `next_tide_time` to a machine-parseable form (ISO) or leave as legacy; UI will prefer `next_tide_at`.

5. **UI: format in beach timezone**
   - In `ForecastTab`, prefer `next_tide_at` when present:
     - Determine beach TZ via `getTimezoneFromCoords(beach.lat, beach.lon)`.
     - Format with `Intl.DateTimeFormat({ timeZone: beachTz, hour, minute })`.
   - Fallback to existing `next_tide_time` if `next_tide_at` is missing.

### Testing (Local First)
- **DB migration (local Supabase)**: apply the new migration(s) locally.
- **Regenerate Scripps forecasts**:
  - Start the app locally.
  - Log in as an **admin** locally.
  - Call `POST /api/forecasts/update-enhanced` with JSON body `{ "beachId": "<scrippsBeachId>" }`.
- **Manual UI verification**:
  - Open the Scripps beach detail page.
  - Confirm Next Tide time matches Surfline within expected station tolerance (time should align in PT; height should be close for same station).
- **Automated tests**:
  - Add/adjust unit tests to assert:
    - NOAA hourly timestamps parse deterministically as UTC.
    - Station resolver returns `9410230` for Scripps.

### Notes / Expected Outcomes
- This removes dependence on server timezone and DST quirks.
- It also reduces “mysterious mismatches” by ensuring one station is used consistently.
