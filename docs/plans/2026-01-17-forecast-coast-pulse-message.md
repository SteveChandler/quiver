# Forecast Message Improvement for Coast Pulse

**Date:** 2026-01-17
**Status:** Approved

## Problem

The Coast Pulse timeline shows forecast items with the unhelpful message "Forecast available" instead of actual surf conditions. This happens because `formatForecastConditions` fails to parse string-formatted fields like `"3.2 ft"` and falls back to a generic message.

## Solution

Rewrite the forecast message formatting to display surf-relevant conditions:

```
3-4ft @ 12s SW, light offshore, Rising
```

## Message Format

| Component | Source Field | Example |
|-----------|--------------|---------|
| Wave height | `wave_height` ("3.2 ft") | `3ft` |
| Period | `wave_period` ("12s") | `@ 12s` |
| Swell direction | `swell_1_direction` ("SW") | `SW` |
| Wind quality | Calculated from `wind_speed`, `wind_direction`, `wind_offshore_deg` | `light offshore` |
| Tide | `tide_status` ("Rising") | `Rising` |

## Wind Description Logic

| Wind Speed | Offshore? | Display |
|------------|-----------|---------|
| 0-4 mph | - | `calm` |
| 5-10 mph | Yes | `light offshore` |
| 5-10 mph | No | `light onshore` |
| 11+ mph | Yes | `offshore` |
| 11+ mph | No | `Xmph onshore` |

Offshore calculation uses existing `calculateOnOffshore` from `lib/analyzers/wind-analyzer.ts`.

## Changes Required

### 1. Update beaches cache query

In `app/api/coast-pulse/route.ts`, expand the beach query to include orientation:

```typescript
const { data: beaches } = await supabase
  .from("beaches")
  .select("id, name, lat, lon, wind_offshore_deg")
```

### 2. Update fetchEnhancedForecast function

Pass the beach's `wind_offshore_deg` to `formatForecastConditions`.

### 3. Rewrite formatForecastConditions

New implementation that:
- Parses string values (`"3.2 ft"` → `3`)
- Uses `swell_1_direction` for direction
- Calculates offshore/onshore using beach orientation
- Includes tide status
- Returns formatted string or `null` if no data

## Files Modified

- `app/api/coast-pulse/route.ts`

## Testing

- Verify forecast items show actual conditions
- Test with beaches that have/don't have `wind_offshore_deg`
- Test edge cases: missing wave data, missing wind data, missing tide
