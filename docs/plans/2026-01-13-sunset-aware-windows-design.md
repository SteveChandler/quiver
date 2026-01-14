# Sunset-Aware Time Windows Design

**Date:** 2026-01-13
**Status:** Ready for Implementation

## Problem Statement

The current recommendation system has two issues:

1. **Ignores actual sunset** - Shows "4-7pm" even when sunset is 5:05pm
2. **Fixed 3-hour windows** - Arbitrary duration regardless of conditions

This erodes user trust when recommendations suggest surfing after dark.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sunset data source | Database (`sun_times` table) | Already populated by cron job via SunCalc |
| Caching strategy | Batch pre-fetch for all beaches | Matches existing pattern (`getBatchFreshForecastsFromCache`) |
| Short window handling | Skip if < 1 hour remains | Better to recommend earlier slot than a 30-min session |
| Window duration | Condition-driven, not fixed | Extend while conditions stay good, cap at sunset |
| Degradation precision | Linear interpolation | Simple, good enough given hourly data uncertainty |

## Data Flow

### Current Flow
```
getDiscoveryRecommendations()
  → getBatchFreshForecastsFromCache()
  → for each beach: selectBestWindow()
    → builds fixed 3-hour window from forecast start
```

### New Flow
```
getDiscoveryRecommendations()
  → getBatchFreshForecastsFromCache()
  → getBatchSunTimes()  // NEW
  → for each beach: selectBestWindow(sunTimesCache)
    → filters out slots where sunset leaves < 1 hour
    → extends window while conditions stay good
    → caps window.end at sunset
    → interpolates to find precise degradation time
```

## Implementation

### Part 1: Batch Sun Times Fetch

Add to `lib/services/surf-discovery-service.ts`:

```typescript
/**
 * Batch fetch sunset times for multiple beaches and dates.
 * Returns a Map keyed by `${beachId}_${YYYY-MM-DD}` → sunset Date (UTC).
 */
async function getBatchSunTimes(
  beachIds: string[],
  dates: string[] // Format: YYYY-MM-DD
): Promise<Map<string, Date>> {
  const supabase = createSupabaseServiceRoleClient();

  const uniqueBeachIds = [...new Set(beachIds)];
  const uniqueDates = [...new Set(dates)];

  const { data, error } = await supabase
    .from('sun_times')
    .select('beach_id, date, sunset_utc')
    .in('beach_id', uniqueBeachIds)
    .in('date', uniqueDates);

  if (error) {
    console.error('Error fetching sun times:', error);
    return new Map();
  }

  const sunMap = new Map<string, Date>();

  data?.forEach((row) => {
    if (row.sunset_utc) {
      const key = `${row.beach_id}_${row.date}`;
      sunMap.set(key, new Date(row.sunset_utc));
    }
  });

  return sunMap;
}
```

### Part 2: Modified selectBestWindow

Replace the existing `selectBestWindow` function:

```typescript
const MIN_SESSION_HOURS = 1.0;
const MIN_SCORE_THRESHOLD = 50; // Minimum score to consider "good" conditions
const MAX_WINDOW_HOURS = 4; // Maximum window even with great conditions

function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, Date>
): PersonalizedForecastWindow | null {
  if (forecasts.length === 0) return null;

  const now = new Date();
  const beachTz = getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);

  // Score all forecasts upfront
  const scoredForecasts = forecasts
    .map((forecast) => {
      const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
      const score = scoreForecastWindow(forecast, beach, userPrefs);
      return { forecast, forecastTime, score };
    })
    .filter(({ forecastTime }) => forecastTime > now)
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());

  if (scoredForecasts.length === 0) return null;

  let bestWindow: {
    forecast: EnhancedForecastEntity;
    start: Date;
    end: Date;
    score: number;
  } | null = null;
  let bestAdjustedScore = -1;

  for (let i = 0; i < scoredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore } = scoredForecasts[i];

    // Skip low-scoring start times
    if (startScore < MIN_SCORE_THRESHOLD) continue;

    // Get sunset for this date
    const dateKey = forecast.forecast_date;
    const sunset = sunTimesCache?.get(`${beach.id}_${dateKey}`);

    // Skip if too close to sunset
    if (sunset) {
      const hoursUntilSunset = (sunset.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      if (hoursUntilSunset < MIN_SESSION_HOURS) continue;
    }

    // Check horizon constraint
    const hoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (horizonHours && hoursAhead > horizonHours) continue;

    // Find window end based on conditions
    let endTime = new Date(startTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

    // Look ahead to find when conditions degrade
    for (let j = i; j < scoredForecasts.length - 1; j++) {
      const current = scoredForecasts[j];
      const next = scoredForecasts[j + 1];

      // Check if conditions drop below threshold
      if (current.score >= MIN_SCORE_THRESHOLD && next.score < MIN_SCORE_THRESHOLD) {
        // Linear interpolation to find precise degradation time
        const dropAmount = current.score - next.score;
        const thresholdDiff = current.score - MIN_SCORE_THRESHOLD;
        const fractionOfHour = dropAmount > 0 ? thresholdDiff / dropAmount : 0;

        const degradationTime = new Date(
          current.forecastTime.getTime() + fractionOfHour * 60 * 60 * 1000
        );

        if (degradationTime < endTime) {
          endTime = degradationTime;
        }
        break;
      }

      // Stop extending if we've gone past max window
      const windowDuration = (next.forecastTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      if (windowDuration >= MAX_WINDOW_HOURS) {
        endTime = new Date(startTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
        break;
      }
    }

    // Cap at sunset
    if (sunset && sunset < endTime) {
      endTime = sunset;
    }

    // Validate minimum session length
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_SESSION_HOURS) continue;

    // Apply time decay for ranking
    const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
    const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;
    const adjustedScore = startScore - timeDecay;

    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore;
      bestWindow = { forecast, start: startTime, end: endTime, score: startScore };
    }
  }

  if (!bestWindow) return null;

  // Build the PersonalizedForecastWindow
  return {
    start: bestWindow.start,
    end: bestWindow.end,
    tide: bestWindow.forecast.tide_status || 'Unknown',
    wind: `${bestWindow.forecast.wind_speed} ${bestWindow.forecast.wind_direction}`,
    waveHeight: bestWindow.forecast.wave_height || 'Unknown',
    wavePeriod: bestWindow.forecast.wave_period || 'Unknown',
    dataSource: bestWindow.forecast.data_source || 'FALLBACK',
    confidence: bestWindow.forecast.confidence_score || 50,
    timezone: beachTz,
  };
}
```

### Part 3: Integration in getDiscoveryRecommendations

Update the main function to fetch and pass sun times:

```typescript
export async function getDiscoveryRecommendations(options: DiscoveryOptions) {
  // ... existing code to get beaches and forecasts ...

  const batchResults = await getBatchFreshForecastsFromCache(
    beaches.map(b => b.id),
    FORECAST_WINDOW_HOURS
  );

  // NEW: Collect all dates from forecasts and fetch sun times
  const allDates = new Set<string>();
  const allBeachIds = new Set<string>();

  for (const { beach, forecasts } of batchResults) {
    allBeachIds.add(beach.id);
    for (const f of forecasts) {
      allDates.add(f.forecast_date);
    }
  }

  const sunTimesCache = await getBatchSunTimes(
    Array.from(allBeachIds),
    Array.from(allDates)
  );

  // ... existing scoring loop, now passing sunTimesCache ...
  for (const { beach, forecasts } of beachForecasts) {
    const bestWindow = selectBestWindow(
      forecasts,
      beach,
      userPrefs,
      horizonHours,
      sunTimesCache  // NEW parameter
    );
    // ... rest of loop ...
  }
}
```

### Part 4: Cleanup

Remove the hardcoded night hour check from `selectBestWindow` since sunset logic now handles it:

```typescript
// REMOVE this block:
// const localHour = getLocalHour(forecastTime, beachTz);
// if (isNightHour(localHour)) {
//   continue;
// }
```

The `isNightHour` function in `timezone-utils.server.ts` can remain for other uses but is no longer needed in window selection.

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_SESSION_HOURS` | 1.0 | Minimum viable session length |
| `MIN_SCORE_THRESHOLD` | 50 | Score below which conditions are "poor" |
| `MAX_WINDOW_HOURS` | 4 | Maximum window even with perfect conditions |

## Edge Cases

1. **No sunset data** - Fall back to existing behavior (hardcoded night hours)
2. **All windows too short** - Return null, UI shows "no recommendation"
3. **Conditions never degrade** - Cap at `MAX_WINDOW_HOURS` or sunset
4. **Cross-midnight forecasts** - Each forecast date fetches its own sunset

## Testing Plan

1. **Unit tests for `getBatchSunTimes`**
   - Empty inputs return empty Map
   - Deduplicates beach IDs and dates
   - Handles missing sunset data gracefully

2. **Unit tests for `selectBestWindow`**
   - Caps at sunset when conditions extend past dark
   - Skips windows with < 1 hour of daylight
   - Interpolates correctly when conditions degrade mid-hour
   - Respects MAX_WINDOW_HOURS even with great conditions

3. **Integration test**
   - E2E test that the home screen never shows windows extending past sunset

## Migration

No database changes required. The `sun_times` table already exists and is populated.

## Future Enhancements

1. **Factor-aware interpolation** - Interpolate wind/tide/swell separately for more precise degradation detection
2. **User session length preference** - Let users set preferred session duration in settings
3. **Dawn patrol awareness** - Similar logic for sunrise to cap early morning windows
