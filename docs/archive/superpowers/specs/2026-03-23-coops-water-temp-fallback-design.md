# CO-OPS Water Temperature Fallback

**Date:** 2026-03-23
**Status:** Draft

## Problem

Beaches without IOOS buoy coverage (e.g., Jacksonville Beach) display a flat-line water temperature chart because the system falls back to a latitude-based seasonal estimate. The estimate produces the same temperature for all 7 days, and the UI labels it "Updated hourly" — misleading users into thinking it's real observational data.

Meanwhile, NOAA CO-OPS stations already mapped to these beaches for tide data also report `water_temperature`. Station 8720218 (Mayport) is 7nm from Jacksonville Beach and currently reads 63.7°F, but we never query it.

## Solution

Add CO-OPS water temperature as Priority 2 in the fallback chain:

```
IOOS observation → CO-OPS observation → latitude estimation
```

Note: The NDBC buoy path (Priority 3 in `forecast-builder.ts`) is dead code — `buoyData` is hardcoded to `null` in `enhanced-forecast-service.ts` since NDBC was removed for lacking geographic filtering. The effective chain today is IOOS → latitude estimation. This change makes it IOOS → CO-OPS → latitude estimation.

## Architecture

### 1. CO-OPS API Client (`lib/services/noaa-coops/api-client.ts`)

Add `fetchWaterTemperature(stationId)` — mirrors the existing `fetchCurrentWaterLevel()` pattern:

- Calls `api.tidesandcurrents.noaa.gov` with `product=water_temperature`
- Uses `range=24` (last 24 hours) to find the most recent valid reading
- Returns `{ tempC: number; observedAt: string } | null`
- 5-second timeout (same as other optional requests)
- Silent failure — returns null on error
- Parses CO-OPS timestamp as UTC (append `Z` to `data[].t` before `new Date()` — CO-OPS returns `"2026-03-23 15:12"` without timezone indicator, but the query specifies `time_zone=gmt`)

API URL pattern:
```
https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
  ?station={stationId}
  &product=water_temperature
  &range=24
  &units=metric
  &time_zone=gmt
  &format=json
  &application=quiver-surf-app
```

Response shape:
```json
{
  "metadata": { "id": "8720218", "name": "Mayport", "lat": "30.3982", "lon": "-81.4279" },
  "data": [{ "t": "2026-03-23 15:12", "v": "17.6", "f": "0,0,0" }]
}
```

### 2. Enhanced Forecast Service (`lib/services/enhanced-forecast-service.ts`)

Add `fetchCOOPSWaterTemp(beach)` private method:

- Resolves CO-OPS station via `getStationForLocation(beach.name, beach.lat, beach.lon)`
- Calls `fetchWaterTemperature(stationId)` from the API client
- Applies staleness check: 48 hours, matching `IOOS_STALENESS_HOURS` constant
- Returns temperature in Celsius or null
- Added to the existing `Promise.allSettled` array alongside IOOS, wave, tide, weather, CDIP fetches

### 3. Forecast Builder (`lib/services/forecast/forecast-builder.ts`)

Update `ForecastInputs` interface and `getWaterTemperature()` method:

- Add `coopsWaterTempC: number | null` to `ForecastInputs`
- Insert CO-OPS check as Priority 2 in `getWaterTemperature()`:

```
Priority 1: IOOS observed water temperature
Priority 2: CO-OPS observed water temperature  ← NEW
Priority 3: NDBC buoy water temperature (dead code — buoyData always null)
Priority 4: Latitude-based estimation
```

### Data Flow

```
EnhancedForecastService.generateComprehensiveForecast(beach)
  ├── fetchIOOSWaterTemp(beach)          → ioos_stations + ioos_observations (DB)
  ├── fetchCOOPSWaterTemp(beach)         → CO-OPS API (HTTP)  ← NEW
  ├── fetchWaveDataWithRetry(beach)      → WaveWatch API
  ├── fetchTidalDataWithRetry(beach)     → CO-OPS API (tides)
  ├── fetchWeatherDataWithRetry(beach)   → NWS API
  └── fetchCDIPDataWithRetry(beach)      → CDIP API
      │
      ▼
  ForecastBuilder.getWaterTemperature(buoyData, beach, time, ioosTemp, coopsTemp)
      │
      ▼
  IOOS → CO-OPS → (NDBC dead code) → latitude estimate
```

## Files Changed

| File | Change |
|------|--------|
| `lib/services/noaa-coops/api-client.ts` | Add `fetchWaterTemperature()` function + export |
| `lib/services/enhanced-forecast-service.ts` | Add `fetchCOOPSWaterTemp()`, add to `Promise.allSettled`, thread through to builder |
| `lib/services/forecast/forecast-builder.ts` | Add `coopsWaterTempC` to `ForecastInputs`, update `getWaterTemperature()` fallback chain |
| `__tests__/lib/services/noaa-coops/api-client.test.ts` | Test `fetchWaterTemperature()` — mock API, verify parsing/null handling |
| `__tests__/lib/services/forecast/forecast-builder.test.ts` | Test updated fallback chain — verify CO-OPS is Priority 2 |

## Edge Cases

- **Station doesn't report water temp**: Some CO-OPS stations are predictions-only (e.g., 8720587 St. Augustine). The API returns `{ "error": { "message": "..." } }` — handled by null return.
- **Intermittent/seasonal sensors**: Some stations report water temp seasonally or go offline for maintenance. The `range=24` query may return an empty `data` array — handled by null return (no data points = no temp).
- **River stations**: Stations like JXUF1 (Jacksonville University) report river water temp, not ocean. The station resolver already maps beaches to the most appropriate coastal station (Mayport for Jax Beach), so this is handled by existing mappings.
- **Duplicate fetch with tides**: We already call CO-OPS for tide predictions. Water temperature is a separate product/endpoint — no conflict, and they run in parallel.
- **CO-OPS timestamp parsing**: Timestamps arrive as `"2026-03-23 15:12"` without timezone indicator. Must append `Z` before parsing to ensure UTC interpretation, since the query uses `time_zone=gmt`.
- **Rate limiting**: CO-OPS API has no documented rate limit. Per-cycle call count depends on `maxBeachesPerRun` batch config (typically 20-50 beaches per cycle, not all 186 at once). Combined with tide calls, this is well within reasonable bounds.

## Not in Scope

- Updating the chart attribution text ("Data from X · Updated hourly") — separate UI concern
- Adding new CO-OPS station mappings — existing mappings cover ~40+ beaches
- Caching CO-OPS water temp responses — the forecast builder already writes to `enhanced_forecasts`, so downstream reads are from DB, not API
- Quality flag filtering (`f` field in CO-OPS response) — consistent with existing `fetchCurrentWaterLevel` which also ignores flags

## Testing

- Unit test for `fetchWaterTemperature()` — mock CO-OPS API response, verify parsing, null handling, UTC timestamp parsing
- Unit test for updated `getWaterTemperature()` fallback chain — verify CO-OPS is Priority 2, fires when IOOS is null
- Integration: after deployment, verify Jacksonville Beach forecast shows ~64°F (actual Mayport reading) instead of flat 62°F
