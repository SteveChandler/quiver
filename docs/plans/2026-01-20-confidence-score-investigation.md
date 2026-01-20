# Fix 2: Confidence Score Calculation Investigation

## Problem

Beach detail pages display "1% confidence" even when showing "CDIP Buoy Data + NOAA Weather & Tide" as data sources. This contradicts the expected behavior where having multiple data sources should yield 85-100% confidence.

Example: Sunset Cliffs / Garbage (San Diego) shows:
- "CDIP Buoy Data" with "Live Data" badge
- "+ NOAA Weather & Tide"
- But confidence displays as "1%"

## How Confidence Is Calculated

In `lib/services/forecast/confidence-scorer.ts`:

```typescript
export function calculateConfidenceScore({
  hasWaveData,
  hasTideData,
  hasWeatherData,
  hasBuoyData,
  hasCDIPData,
  forecastHoursAhead,
}: ConfidenceParams): number {
  let score = 50; // Base score

  if (hasCDIPData) score += 25;      // Premium CDIP data
  else if (hasWaveData) score += 20; // Standard wave model

  if (hasTideData) score += 15;
  if (hasWeatherData) score += 10;
  if (hasBuoyData) score += 15;

  // Time penalty
  const timePenalty = hasCDIPData
    ? Math.min(20, forecastHoursAhead * 0.3)
    : Math.min(30, forecastHoursAhead * 0.5);
  score -= timePenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

**Expected scores:**
- All flags false + 0 hours = 50
- CDIP + tide + weather + 0 hours = 50 + 25 + 15 + 10 = 100
- All false + 100 hours penalty = 50 - 30 = 20

**To get 1%:** All flags must be false AND forecastHoursAhead > 98 hours (impossible with our data)

## Root Cause Hypothesis

The confidence is calculated in `lib/services/forecast/forecast-builder.ts:98-105`:

```typescript
const wavePoint = this.getWaveDataForTime(waveData, forecastTime);
const tideInfo = this.getTideInfo(tideData, forecastTime);
const weatherPoint = this.getWeatherDataForTime(weatherData, forecastTime);
const cdipPoint = this.getCDIPDataForTime(cdipData, forecastTime);

const confidenceScore = calculateConfidenceScore({
  hasWaveData: !!wavePoint,      // <-- These are returning null!
  hasTideData: !!tideInfo,
  hasWeatherData: !!weatherPoint,
  hasBuoyData: useBuoyData,
  hasCDIPData: useCDIPData,
  forecastHoursAhead: i * 3,
});
```

**The issue:** The time-lookup functions (`getWaveDataForTime`, `getTideInfo`, etc.) are returning `null` even though the raw data exists. This creates a mismatch:
- `data_source` field shows "CDIP" (data was fetched)
- But `hasWaveData` is false (time alignment failed)

## Investigation Steps

### Step 1: Add Logging to Time Lookup Functions

Add debug logging to understand why lookups fail:

```typescript
// In forecast-builder.ts
const wavePoint = this.getWaveDataForTime(waveData, forecastTime);
if (!wavePoint && waveData) {
  log.warn(`[ForecastBuilder] Wave data exists but no match for time ${forecastTime.toISOString()}`);
}
```

### Step 2: Examine Time Alignment Logic

Check these functions in `forecast-builder.ts`:
- `getWaveDataForTime()`
- `getTideInfo()`
- `getWeatherDataForTime()`
- `getCDIPDataForTime()`

Look for:
- Timezone mismatches (UTC vs local)
- Time range matching issues (exact vs nearest)
- Data format inconsistencies

### Step 3: Query Database for Sample Beach

```sql
-- Check confidence scores for Sunset Cliffs
SELECT
  forecast_date,
  forecast_time,
  data_source,
  confidence_score,
  wave_height,
  tide_status
FROM enhanced_forecasts
WHERE beach_id = '<sunset-cliffs-id>'
ORDER BY forecast_date, forecast_time
LIMIT 20;
```

### Step 4: Compare Raw Data vs Stored Forecast

Check if the raw_forecast JSON contains data that wasn't used:
- Does `raw_forecast.cdip_data` have values?
- Does `raw_forecast.data_sources` list multiple sources?
- Why didn't these translate to high confidence?

## Likely Fixes

### Option A: Fix Time Alignment in Lookup Functions

The lookup functions may use exact time matching when they should use nearest-neighbor:

```typescript
// Current (hypothetical):
getWaveDataForTime(waveData, forecastTime) {
  return waveData.find(d => d.time === forecastTime); // Exact match fails
}

// Fixed:
getWaveDataForTime(waveData, forecastTime) {
  return findNearest(waveData, forecastTime, maxGapHours: 1); // Nearest within 1 hour
}
```

### Option B: Fix Timezone Handling

CDIP/NOAA data may use different timezone conventions:

```typescript
// Current (hypothetical):
const forecastTime = new Date(dateString + 'T' + timeString); // Local time?

// Fixed:
const forecastTime = new Date(dateString + 'T' + timeString + 'Z'); // Explicit UTC
```

### Option C: Inherit Confidence from Data Source

If data_source shows "CDIP", ensure minimum confidence:

```typescript
// Fallback if time lookups fail
const minConfidence = useCDIPData ? 70 : hasWaveData ? 60 : 50;
const confidenceScore = Math.max(
  minConfidence,
  calculateConfidenceScore({ ... })
);
```

## Files to Investigate

1. `lib/services/forecast/forecast-builder.ts` - Main build logic
2. `lib/services/enhanced-forecast-service.ts` - Data fetching
3. `lib/services/forecast/data-source-manager.ts` - Raw data handling
4. Time utility functions used for alignment

## Testing Plan

1. **Add logging** - Deploy with verbose time-alignment logging
2. **Monitor specific beach** - Track Sunset Cliffs forecasts for 24 hours
3. **Compare before/after** - Run forecast regeneration and compare confidence
4. **Unit tests** - Add tests for time alignment edge cases:
   - Exact time match
   - Off-by-minutes match
   - Timezone boundary conditions

## Success Criteria

- All beaches with CDIP data show confidence >= 70%
- All beaches with NOAA data show confidence >= 60%
- Confidence display matches data source indicators
- No regression in forecast accuracy

## Priority

High - This affects user trust in the forecast data. A beach showing "1% confidence" with "Live Data" badge creates confusion and undermines the transparency feature.
