# Surf Discovery Time Priority Fix — Design Document

**Date**: 2026-01-15
**Status**: Ready for implementation
**Author**: Collaborative brainstorm session

---

## Problem Statement

The surf discovery algorithm is not correctly identifying the "best time to surf now" even when current conditions are strong. The system often recommends later-in-the-day or tomorrow windows over viable present windows.

### Symptoms

- "Surf now" windows are skipped or deprioritized
- Morning sessions (e.g., 8–11am) disappear shortly after the hour rolls over
- "Today bonus" doesn't reliably beat slightly better future windows
- Evening windows sometimes get truncated unexpectedly

---

## Root Causes Identified

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 2 | Current window filtered out (strict `>`) | Line 1257 | High — "surf now" impossible |
| 3 | Time decay too weak (0.5 pts/hr) | Line 172 | Medium — future beats present |
| 4 | UTC date boundary in extension | Line 1349 | Medium — evening truncation |
| 5 | Threshold inconsistency | Line 1352 | Low — morning edge cases |

Note: Issue #1 (UTC misinterpretation) was investigated and ruled out — forecast timestamps are correctly stored as UTC.

---

## Solution Design

### Issue #2: Allow Current Window with Lookback

**Problem**: `forecastTime > now` excludes any forecast block that has already started.

**Fix**: Allow windows that started within the last `WINDOW_HOURS` (3 hours):

```typescript
const lookbackMs = WINDOW_HOURS * 60 * 60 * 1000; // 3 hours
const minEligible = new Date(now.getTime() - lookbackMs);

const scoredForecasts = forecasts
  .map(...)
  .filter(({ forecastTime }) => forecastTime >= minEligible)
  .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());
```

**Also required**: Clamp `hoursAhead` to prevent past-start windows from getting a bonus:

```typescript
const rawHoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
const hoursAhead = Math.max(0, rawHoursAhead); // Clamp to zero
```

**Behavior**:
- At 9:20am, the 9:00am forecast block remains eligible
- Windows that already started get 0 time decay (not a bonus)
- Future windows get decayed normally

---

### Issue #3: Stronger Time Priority

**Problem**: `TIME_DECAY_PER_HOUR = 0.5` means a window 12 hours away only loses 6 points.

**Fix**: Increase decay and add tiered "soon" bonuses:

```typescript
// Constants
const TIME_DECAY_PER_HOUR = 1.0;      // was 0.5
const MAX_TIME_DECAY_HOURS = 24;       // unchanged
const SOON_BONUS_2HR = 8;
const SOON_BONUS_4HR = 4;
const UNDERWAY_BONUS = 4;

// Implementation
const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

// Start-soon bonus (smooth step)
let soonBonus = 0;
if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

// If this window already started recently (lookback-eligible), add bonus
const isUnderway = rawHoursAhead < 0;
const underwayBonus = isUnderway ? UNDERWAY_BONUS : 0;

const adjustedScore =
  startScore - timeDecay + todayBonus + morningTimeBonus + soonBonus + underwayBonus;
```

**Behavior comparison** (assuming base score ~70-75):

| Window | Old System | New System |
|--------|------------|------------|
| Now (underway) | 70 - 0 = 70 | 70 - 0 + 8 + 4 = 82 |
| 1 hour ahead | 70 - 0.5 = 69.5 | 70 - 1 + 8 = 77 |
| 4 hours ahead | 70 - 2 = 68 | 70 - 4 + 4 = 70 |
| 12 hours ahead | 75 - 6 = 69 | 75 - 12 = 63 |
| 24 hours ahead | 75 - 12 = 63 | 75 - 24 = 51 |

"Surf now" meaningfully preferred without killing tomorrow's forecast if conditions are genuinely much better.

---

### Issue #4: Local Date Boundary for Window Extension

**Problem**: Extension stops at UTC midnight (4-5pm Pacific) because it compares `forecast_date` strings.

**Fix**: Compare local dates in beach timezone:

```typescript
// Helper function
const getLocalDateStr = (time: Date): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(time);
  } catch {
    return time.toISOString().slice(0, 10); // Fallback to UTC
  }
};

// In extension loop (replacing line 1349):
const currentLocalDate = getLocalDateStr(current.forecastTime);
const nextLocalDate = getLocalDateStr(next.forecastTime);
if (currentLocalDate !== nextLocalDate) break;
```

**Behavior**:
- 6pm Pacific window can extend through 8pm (same local day)
- Extension only stops at local midnight, not UTC midnight

---

### Issue #5: Consistent Threshold During Extension

**Problem**: Window qualifies with `MIN_SCORE_THRESHOLD_MORNING` (35) but extension uses `MIN_SCORE_THRESHOLD` (50).

**Fix**: Use `effectiveThreshold` throughout the extension loop:

```typescript
// effectiveThreshold is already computed per window:
const effectiveThreshold = (isMorning && isToday)
  ? MIN_SCORE_THRESHOLD_MORNING
  : MIN_SCORE_THRESHOLD;

// Replace all MIN_SCORE_THRESHOLD in extension loop:

// Line 1352
if (current.score >= effectiveThreshold && next.score < effectiveThreshold) {

// Line 1356
const thresholdDiff = current.score - effectiveThreshold;
```

**Behavior**:
- Morning windows that qualified at 35–49 points extend properly
- No change for afternoon/evening windows (still use 50 threshold)

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/services/surf-discovery-service.ts` | All changes in `selectBestWindow()` and constants |

---

## Constants Summary

```typescript
// Time-priority window selection constants
const TIME_DECAY_PER_HOUR = 1.0;       // Changed from 0.5
const MAX_TIME_DECAY_HOURS = 24;       // Unchanged

// New: Start-soon bonuses
const SOON_BONUS_2HR = 8;
const SOON_BONUS_4HR = 4;
const UNDERWAY_BONUS = 4;

// Existing (unchanged)
const MIN_SESSION_HOURS = 1.0;
const MIN_SCORE_THRESHOLD = 50;
const MIN_SCORE_THRESHOLD_MORNING = 35;
const MAX_WINDOW_HOURS = 4;
const MORNING_CUTOFF_HOUR = 12;
const TODAY_BONUS_POINTS = 15;
const MORNING_TIME_BONUS = 15;
const EVENING_CUTOFF_HOUR = 17;
```

---

## Testing Considerations

1. **Unit tests** for `selectBestWindow()`:
   - Window that started 1 hour ago is eligible and gets underway bonus
   - Window 2 hours away gets soon bonus
   - Window 12+ hours away is significantly penalized
   - Evening window in Pacific extends past 5pm UTC

2. **Integration tests**:
   - At 9:20am, 9:00am window is recommended (not 12:00pm)
   - At 6pm Pacific, window extends to sunset (not truncated at UTC midnight)

3. **Manual QA**:
   - Check discovery recommendations at various times of day
   - Verify "surf now" windows appear when conditions are good

---

## Risk Assessment

**Low risk**: Changes are isolated to `selectBestWindow()` and don't affect:
- Database schema
- API contracts
- Other scoring logic (`scoreBeachForDiscovery` unchanged)

**Backward compatibility**: Output format unchanged; only ranking logic affected.

---

## Next Steps

1. Create implementation plan with specific code changes
2. Implement changes in `selectBestWindow()`
3. Add/update unit tests
4. Manual QA at various times of day
