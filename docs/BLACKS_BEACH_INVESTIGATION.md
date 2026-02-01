# Blacks Beach Missing from Surf Discovery - Investigation Summary

**Date:** 2026-01-30
**Status:** Root cause identified, fix in progress

## Problem Statement

Blacks Beach (5.5km away, advanced skill) was not appearing in surf discovery results despite being closer than beaches that ARE showing (like Torrey Pines at 9.5km).

## Initial Hypothesis

Based on API response metadata:
- `totalBeachesConsidered: 20`
- `successfulForecasts: 19` (Blacks IS included)
- `recommendations: 6` (Blacks doesn't appear)

Initial theory: `selectBestWindow()` was returning null for Blacks.

## Investigation - Phase 1: Debug Logging

Added comprehensive debug logging to:
1. `lib/services/discovery/window-selector/window-selector-core.ts`
2. `lib/services/discovery/surf-discovery-orchestrator.ts`

### Logging Points Added:
- Score vs threshold for each forecast
- Light/sunset constraint skips
- Session duration failures
- Fallback selection attempts
- Beaches with no viable window

## Key Finding: Window Selection is NOT the Problem

Log output shows Blacks Beach **successfully gets a window**:

```
[selectBestWindow] Blacks: 4 forecasts to evaluate, isMorning=false
[selectBestWindow] Blacks: Forecast 1 session too short (-0.1h < 1h)
[selectBestWindow] Blacks: No same-day sunset found for 2026-02-01, sunsets available: 2026-01-28, 2026-01-29, 2026-01-30, 2026-01-31
[selectBestWindow] Blacks: Main loop found window with score=76
```

**Blacks gets `window.score=76`** which is competitive with other beaches.

## Root Cause: Discovery Scoring Phase

The issue is in **`scoreBeachForDiscovery()`**, not window selection.

### Two Different Scores:
1. **`window.score`** - Raw forecast condition score (0-100) from window selector
2. **`score`** (discovery score) - Final ranking score from `scoreBeachForDiscovery()`

### Evidence:
Final recommendations show discovery scores: 75, 75, 70, 62, 46, 44

Blacks' `window.score=76` but its **discovery score** must be below 44 (the cutoff).

### Why Blacks Scores Low in Discovery:

The discovery score is calculated from subscores:
- `waveHeightFit` (0-25)
- `periodEnergyScore` (0-20)
- `windAlignment` (0-20)
- `tideFit` (0-15)
- `affinityBonus` (0)
- `distancePenalty` (-5 to -20)

**Blacks' likely penalties:**
1. **Tide penalty**: Blacks has `preferred_tide_ft_min: 0.5`, current tide is likely below that
2. **Wind penalty**: Blacks wants `wind_offshore_deg: 90` (East), but wind is N/NW (~315°)
3. **Distance penalty**: ~5.5km away

## Sun Times Data Issue (Secondary)

Logs show a recurring issue:
```
No same-day sunset found for 2026-02-01, sunsets available: 2026-01-28, 2026-01-29, 2026-01-30, 2026-01-31
```

The forecasts for 2026-02-01 don't have corresponding sunset data. This is handled by fallback logic but should be fixed.

## Files Modified

### Debug Logging Added:
- `lib/services/discovery/window-selector/window-selector-core.ts` (+52 lines)
- `lib/services/discovery/surf-discovery-orchestrator.ts` (+8 lines)

### TypeScript Fixes (unrelated):
- `actions/city/city-metadata-actions.ts` - undefined data check
- `components/media/session-photo-upload.tsx` - null guard
- `components/session-forms/SessionForm.tsx` - null guards (2 places)
- `components/location/location-map.tsx` - prop type fix

## Next Steps

1. **Add discovery score logging** - Show all 18 beach scores before top-6 filter (DONE)
2. **Run API again** - Confirm Blacks' exact subscores
3. **Fix options:**
   - **Option A:** Relax Blacks' tide preferences (`preferred_tide_ft_min: 0.5` → `0`)
   - **Option B:** Adjust wind scoring to be less punishing for offshore mismatch
   - **Option C:** Both

## Commit

```
10a4e322 fix: add debug logging for Blacks Beach window selection issue
```

Pushed to `main` on 2026-01-30.
