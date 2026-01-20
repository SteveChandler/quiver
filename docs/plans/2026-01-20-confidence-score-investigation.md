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

## Root Cause (CONFIRMED)

**Scale mismatch between confidence scorer and weighting service:**

| System | Scale | Example |
|--------|-------|---------|
| `calculateConfidenceScore()` | 0-100 | 70 means 70% |
| Weighting service | 0-1 | 0.7 means 70% |

In `lib/services/enhanced-forecast-service.ts`:

```typescript
// Line 403: Passes 0-100 scale value to 0-1 scale system
confidence: forecast.confidence_score || 0.7,  // If confidence_score=70, confidence=70

// In weighting service, line 196:
confidence: Math.min(1.0, forecast.confidence + calibration.confidenceBoost),
// Math.min(1.0, 70 + 0.1) = 1.0 (caps at 1.0!)

// Line 432: Writes 1.0 back as confidence_score
confidence_score: weightedForecast.confidence,  // Stores 1, displays as "1%"
```

**The bug:** A 70% confidence score gets passed as 70 (not 0.7) to the weighting service, which caps at 1.0, resulting in "1% confidence" display

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

## Fix (IMPLEMENTED)

Convert between scales at the boundary in `lib/services/enhanced-forecast-service.ts`:

```typescript
// Line 397-398: Convert 0-100 to 0-1 before passing to weighting service
const confidenceDecimal = (forecast.confidence_score ?? 70) / 100;
const automatedForecast = {
  // ...
  confidence: confidenceDecimal,
};

// Line 435: Convert 0-1 back to 0-100 when storing
const updatedForecast = {
  // ...
  confidence_score: Math.round(weightedForecast.confidence * 100),
};
```

**Before fix:**
- `confidence_score: 70` → `confidence: 70` → `Math.min(1.0, 70.1)` = 1.0 → stored as 1 → **"1% confidence"**

**After fix:**
- `confidence_score: 70` → `confidence: 0.7` → `Math.min(1.0, 0.8)` = 0.8 → stored as 80 → **"80% confidence"**

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
