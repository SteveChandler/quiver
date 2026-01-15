# Morning Intel Improvements Design

**Date**: 2026-01-14
**Status**: Draft
**Author**: Steven Chandler + Claude

## Problem Statement

The Morning Surf Intel feature has two issues:

1. **Score/Recommendation Disconnect**: An 8/10 score displays as "Maybe" because the recommendation logic is categorical (any "acceptable" factor = Maybe), not score-based. This confuses users — 8/10 should feel like a good day.

2. **Arbitrary Time Windows**: The "Best" window shows fixed hour blocks like "06:00–09:00" rather than actual optimal times based on when conditions change (e.g., tide entering range at 6:15, wind picking up at 8:45).

## Goals

- Make the score and recommendation label feel consistent
- Calculate windows from actual condition transitions, not arbitrary hours
- Generate natural, contextual messages that explain the recommendation

## Non-Goals

- Populate tide direction preferences for all beaches (just Ocean Beach Pier for now)
- UI/design changes to the intel card
- Push notification delivery

---

## Design

### 1. Weighted Factor Logic

Current logic treats all factors equally and uses pure categorical matching:
- Worth it = ALL factors optimal
- Maybe = no poor factors, at least one acceptable
- Skip = any poor factor

**New approach**: Weight factors by surfability impact.

| Factor | Poor Threshold | Impact |
|--------|----------------|--------|
| Swell direction | >45° off window | Can't surf wrong swell → **Skip** |
| Wind | >threshold onshore | Choppy but surfable → **Maybe** at most |
| Tide | Outside range OR wrong direction | Timing-dependent → **Maybe** if close |

**New recommendation logic**:

```
1. If swell.status === 'poor':
   → Skip: "swell direction is off for this spot"

2. If wind.speed > beach.max_wind_any_mph:
   → Skip: "too windy"

3. If wind.speed > beach.max_wind_onshore_mph AND wind is onshore:
   → Skip: "onshore winds will chop it up"

4. If all factors optimal:
   → Worth it: highlight what's working

5. If swell optimal + (wind OR tide acceptable) + score >= 7:
   → Worth it: "swell is dialed, [acceptable factor] is manageable"

6. Otherwise:
   → Maybe: call out what to watch
```

This ensures:
- 8/10 with good swell + acceptable wind = **Worth it**
- 6/10 with poor swell = **Skip** (swell trumps everything)

### 2. Condition-Based Window Calculation

Current logic filters forecasts from 06:00-10:00 that pass basic thresholds, then returns first-to-last matching times. This produces generic windows.

**New approach**: Find the intersection of good conditions by tracking state transitions.

**Algorithm**:

```
Input: forecasts[], beach preferences
Output: { start: "06:15", end: "08:45", reason: "incoming tide before wind picks up" }

Steps:

1. Build condition timeline for each factor:
   - tide_in_range: true/false at each forecast time
   - tide_direction_ok: true/false (if beach has preference)
   - wind_ok: true/false based on speed + direction + beach thresholds

2. Find transition points (interpolate between hourly forecasts):
   - tide crosses min threshold → start candidate
   - tide crosses max threshold → end candidate
   - wind crosses threshold → end candidate

3. Compute intersection:
   - window_start = latest "good" start across all factors
   - window_end = earliest "bad" transition across all factors

4. Build reason string from what's driving each boundary:
   - "06:15" → "incoming tide hits 2ft"
   - "08:45" → "wind picks up"
   - Combined: "06:15–08:45; ride the incoming before wind picks up"
```

**Edge cases**:
- No good window → "Conditions don't line up this morning"
- Window < 30 min → "Brief window around 7:00, conditions are marginal"
- Window spans entire morning → "Good all morning; best around [peak score time]"

**Interpolation**: Forecasts are hourly. To find when tide crosses 2.0ft between 6:00 (1.8ft) and 7:00 (2.4ft):
```
crossing_time = 6:00 + (2.0 - 1.8) / (2.4 - 1.8) * 60min = 6:20
```

### 3. Natural Message Generation

Messages should read naturally based on what's driving the recommendation.

**Worth it examples**:
- "Worth it — offshore winds and tide in the sweet spot"
- "Worth it — swell direction is dialed, light winds"

**Maybe examples**:
- "Maybe — swell is good but wind picks up after 8"
- "Maybe — tide will be high, best on the drop before 7:30"

**Skip examples**:
- "Skip — swell is too south for this spot"
- "Skip — onshore winds all morning"

---

## Schema Changes

### New columns on `beaches` table

| Column | Type | Purpose |
|--------|------|---------|
| `preferred_tide_direction` | `text` | `'rising'`, `'falling'`, `'any'`, or `null` |
| `max_wind_onshore_mph` | `numeric` | Wind speed that degrades conditions when onshore |
| `max_wind_any_mph` | `numeric` | Wind speed that's too much regardless of direction |

**Note**: Existing `wind_onshore_bad_kt` column has unclear semantics and uses knots. Adding new columns with clear naming and mph units.

### Migration

```sql
ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS preferred_tide_direction text,
ADD COLUMN IF NOT EXISTS max_wind_onshore_mph numeric,
ADD COLUMN IF NOT EXISTS max_wind_any_mph numeric;

-- Populate Ocean Beach Pier
UPDATE beaches
SET
  preferred_tide_direction = 'any',
  max_wind_onshore_mph = 10,
  max_wind_any_mph = 18
WHERE lower(name) = 'ocean beach pier';
```

---

## Example Output

### Before (current)
```
Maybe (8/10) • Best: 06:00–09:00; cleaner before onshores
• Surf 1.7–2.8ft • Wind 0mph SW • Tide 2.9ft falling
• Maybe — keep an eye on the wind.
```

### After (proposed)
```
Worth it (8/10) • Best: 06:15–08:45
• Surf 1.7–2.8ft • Wind 0mph SW • Tide 2.9ft falling
• Worth it — offshore winds and tide in the sweet spot. Window ends when wind picks up around 9.
```

### Marginal conditions
```
Maybe (5/10) • Best: 07:00–07:45
• Surf 1.5–2.2ft • Wind 8mph W • Tide 4.8ft rising
• Maybe — brief window while tide is in range. Gets too high after 8.
```

### Skip day
```
Skip (3/10) • No good window
• Surf 2.0–3.0ft • Wind 15mph W • Tide 3.2ft falling
• Skip — onshore winds all morning.
```

---

## Implementation Plan

### Files to modify

1. **Database migration** (new file)
   - `supabase/migrations/YYYYMMDDHHMMSS_add_beach_condition_thresholds.sql`

2. **Conditions analyzer**
   - `lib/analyzers/conditions-analyzer.ts` — refactor `getConservativeRecommendation()`

3. **Session window scorer**
   - `lib/scorers/session-window-scorer.ts` — refactor `bestWindowHeuristic()` to condition-based calculation

4. **Types**
   - `types/morning-intel.ts` — add new beach preference fields

5. **Morning intel script**
   - `scripts/morningIntel.ts` — fetch new beach fields, pass to analyzers

6. **Tests**
   - `__tests__/lib/utils/morning-intel-recommendation.test.ts` — update for new logic
   - Add tests for window interpolation

### Out of scope

- Populating all beaches with new fields (just OB Pier for now)
- UI changes to intel card display
- Push notification delivery

---

## Open Questions

None — design is approved.

---

## Appendix: Current Beach Data (Ocean Beach Pier)

```
preferred_tide_ft_min: 2.0
preferred_tide_ft_max: 5.0
swell_window_min_deg: 200
swell_window_max_deg: 320
```

Will add:
```
preferred_tide_direction: 'any'
max_wind_onshore_mph: 10
max_wind_any_mph: 18
```
