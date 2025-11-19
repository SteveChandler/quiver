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

- Inputs: marine (wave height/period/direction, wind speed/direction), tide (height), per‑beach preferences/weights.
- Relies on database view `public.v_beach_hourly_scores` which encapsulates weight application.
- Weights default: wind .30, tide .20, swell .25, period .15, height .10 (stored on `public.beaches`).

## Windows (`windows.ts`)

- `topWindowsInRange(beach, marine, tide, startUtc, endUtc, windowMinutes)`
  - Builds rolling windows (typically 120 minutes), computes mean scores, and returns ranked windows.
- `windowBlurbDetailed(window)`
  - Produces concise, user-facing descriptions (time range, score/grade, notes like “Advanced only”).

## Sun Utilities (`sun.ts`)

- `sunForLatLon(dateLocal, lat, lon, tz)` → `{ sunriseLocal, sunsetLocal }`
- `isDark(nowLocal, sunriseLocal, sunsetLocal)` → boolean

## Usage Patterns

- Beach Detail and Forecast UX
  - Uses best-times APIs (MV/RPC) first; falls back to computing from `v_beach_hourly_scores` within daylight bounds. A "why" breakdown is derived by querying the peak hour inside a selected window.

## Transparency & Freshness

- Marine data prioritizes observed sources (NDBC/CDIP). Short-horizon persistence fills gaps up to 12h to ensure window availability.
- Tides prefer hourly NOAA; a CO‑OPS hilo interpolation fallback is explicitly labeled via `source`.
- Sun times are computed locally with `SunCalc` and persisted in `sun_times` to avoid external dependencies.
