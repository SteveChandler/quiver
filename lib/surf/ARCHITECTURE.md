# Surf Utilities Architecture

## Overview

The `lib/surf/` folder contains domain utilities for surf data retrieval, window scoring, and solar calculations used by forecast UI and recommendation APIs.

```
lib/surf/
├── data.ts      # Data access helpers for beaches and normalized forecasts
├── scoring.ts   # Scoring helpers and types for best-time windows
├── sun.ts       # Timezone-aware sunrise/sunset and darkness utils
└── windows.ts   # Window building, labeling, and blurb formatting
```

## Data Access (`data.ts`)

- `getBeachesNear(lat, lon, radiusKm)`
  - Returns nearby beaches within `radiusKm` using indexed geospatial queries or precomputed distances.
- `getMarineForecastRange(beachId, startUtc, endUtc)`
  - Reads `marine_forecasts` between timestamps; values may originate from observed (`cdip`/`ndbc`) or projected (`*_persistence`).
- `getTideForecastRange(beachId, startUtc, endUtc)`
  - Reads `tide_forecasts`; may be hourly NOAA or `noaa_hilo_interpolated` fallback.
- `getSunTimes(beachId, localDateStr, lat, lon)`
  - Returns or computes sunrise/sunset for a beach/day; computation populated by cron if missing.

## Scoring (`scoring.ts`)

- Inputs: marine (wave height/period/direction, wind speed/direction), tide (height), per-beach preferences/weights.
- Relies on database view `public.v_beach_hourly_scores` which encapsulates weight application.
- Weights default: wind .40, tide .20, swell .40 (stored on `public.beaches`).

### Base Scoring Formula

```typescript
total = 0.4 * windScore + 0.4 * swellDirScore + 0.2 * tideScore  // 0-1
total100 = Math.round(100 * total)  // 0-100
```

### Terrain-Aware Scoring

When terrain analysis data is available and enabled, the scoring formula is modified to account for beach-specific wind shelter and swell accessibility.

**Reference**: See [Terrain Analysis Architecture](/Users/stevenchandler/Desktop/quiver/scripts/terrain/ARCHITECTURE.md) for full details.

#### Enablement Check

Terrain factors are applied when ALL conditions are met:
1. Global env var `TERRAIN_SCORING_ENABLED` is not `'false'`
2. Beach `terrain_enabled` flag is `true`
3. Both `wind_exposure_factors` and `swell_access_factors` arrays exist with 72 elements

```typescript
const useTerrainFactors = (beach: Beach): boolean => {
  if (process.env.TERRAIN_SCORING_ENABLED === 'false') return false
  if (!beach.terrain_enabled) return false
  if (!beach.wind_exposure_factors?.length === 72) return false
  if (!beach.swell_access_factors?.length === 72) return false
  return true
}
```

#### Bin Selection

Directions are mapped to 72 bins (5-degree resolution):

```typescript
const toBin5 = (deg: number): number => {
  const norm = ((deg % 360) + 360) % 360
  return Math.floor((norm + 2.5) / 5) % 72
}
// Examples: 0 -> bin 0, 90 -> bin 18, 180 -> bin 36, 270 -> bin 54
```

#### Modified Formula

```typescript
// Look up terrain factors for current wind/swell directions
const windBin = toBin5(windDirectionDeg)
const swellBin = toBin5(swellDirectionDeg)
const windExposure = clamp01(beach.wind_exposure_factors[windBin])
const swellAccess = clamp01(beach.swell_access_factors[swellBin])

// Min exposure cap (prevents "perfect wind" in extreme shelter)
const MIN_EXPOSURE = 0.15
const effectiveExposure = MIN_EXPOSURE + (1 - MIN_EXPOSURE) * windExposure

// Wind: exposure REDUCES the penalty of bad wind
// Low exposure (sheltered) = less penalty from onshore wind
const rawWindScore = computeWindScore(...)        // 0-1
const rawWindPenalty = 1 - rawWindScore
const adjustedWindPenalty = rawWindPenalty * effectiveExposure
const windScore = 1 - adjustedWindPenalty         // 0-1

// Swell: access GATES how much the swell direction score counts
// Low access (blocked) = lower overall swell contribution
const rawSwellScore = computeSwellDirScore(...)   // 0-1
const swellDirScore = rawSwellScore * swellAccess // 0-1

// Tide unchanged
const tideScore = computeTideScore(...)           // 0-1

// Final calculation same as before
const total01 = 0.4 * windScore + 0.4 * swellDirScore + 0.2 * tideScore
const total100 = Math.round(100 * total01)
```

#### Behavior Example

| Scenario | Wind Exposure | Effect |
|----------|---------------|--------|
| Open beach, onshore wind | 1.0 (exposed) | Full wind penalty applied |
| Sheltered beach, onshore wind | 0.3 (sheltered) | 70% of wind penalty removed |
| Sheltered beach, offshore wind | 0.3 (sheltered) | Good score (no penalty to reduce) |

| Scenario | Swell Access | Effect |
|----------|--------------|--------|
| Open beach, good swell direction | 1.0 (full access) | Full swell score |
| Headland, wrapped swell | 0.7 (wrap access) | 70% of swell score |
| Blocked direction | 0.2 (blocked) | Only 20% of swell score |

#### Fallback Behavior

When terrain factors are disabled or unavailable:
- `windExposure` defaults to `1.0` (fully exposed)
- `swellAccess` defaults to `1.0` (fully accessible)
- Scores are identical to the non-terrain formula

This ensures backward compatibility and safe rollout.

#### Types Reference

See `types/terrain.ts` for:
- `BeachTerrainFields` - Database fields interface
- `TerrainAnalysisParams` - Algorithm parameters
- `toBin5()` - Direction to bin conversion
- `useTerrainFactors()` - Enablement check
- `DEFAULT_TERRAIN_PARAMS` - Default analysis parameters

## Windows (`windows.ts`)

- `topWindowsInRange(beach, marine, tide, startUtc, endUtc, windowMinutes)`
  - Builds rolling windows (typically 120 minutes), computes mean scores, and returns ranked windows.
- `windowBlurbDetailed(window)`
  - Produces concise, user-facing descriptions (time range, score/grade, notes like "Advanced only").

## Sun Utilities (`sun.ts`)

- `sunForLatLon(dateLocal, lat, lon, tz)` -> `{ sunriseLocal, sunsetLocal }`
- `isDark(nowLocal, sunriseLocal, sunsetLocal)` -> boolean

## Usage Patterns

- Beach Detail and Forecast UX
  - Uses best-times APIs (MV/RPC) first; falls back to computing from `v_beach_hourly_scores` within daylight bounds. A "why" breakdown is derived by querying the peak hour inside a selected window.

## Transparency and Freshness

- Marine data prioritizes observed sources (NDBC/CDIP). Short-horizon persistence fills gaps up to 12h to ensure window availability.
- Tides prefer hourly NOAA; a CO-OPS hilo interpolation fallback is explicitly labeled via `source`.
- Sun times are computed locally with `SunCalc` and persisted in `sun_times` to avoid external dependencies.

## Related Documentation

- [Terrain Analysis Architecture](/Users/stevenchandler/Desktop/quiver/scripts/terrain/ARCHITECTURE.md) - Full terrain system documentation
- [Forecast Scoring](/Users/stevenchandler/Desktop/quiver/docs/architecture/FORECAST_SCORING.md) - Scoring algorithm details
- [Types: terrain.ts](/Users/stevenchandler/Desktop/quiver/types/terrain.ts) - Terrain type definitions
