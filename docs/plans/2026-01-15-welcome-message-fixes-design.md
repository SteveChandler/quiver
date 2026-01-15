# Welcome Message Fixes Design

**Date:** 2026-01-15
**Status:** Ready for implementation

## Problem

The welcome message card has three issues:

1. Score shows "10.0/10" - decimal formatting looks awkward, and 10/10 implies unattainable perfection
2. Only one badge ("Perfect Match") - doesn't explain why conditions are good
3. Time window "4-7:50am" starts before first light - unrealistic for surfing

## Solution

### 1. Score Display Formatting

**Cap at 9.9:** The scoring function clamps final scores to a maximum of 9.9, reflecting that theoretical perfection is unattainable in real conditions.

**Smart decimal formatting:**
- Whole numbers display without decimal (e.g., "8" not "8.0")
- Non-whole numbers show one decimal (e.g., "8.4", "9.9")

**Drop "/10" suffix:** Display just the number since the scale is understood in context.

**Examples:**
- "10.0/10" → "9.9"
- "8.0/10" → "8"
- "7.3/10" → "7.3"

**Implementation:** Apply 9.9 cap at scoring calculation level for consistency across all score displays.

### 2. Threshold-Based Condition Badges

**Badge definitions:**

| Badge | Condition | Threshold |
|-------|-----------|-----------|
| Glass | Wind speed | < 5 mph |
| Light Offshore | Wind direction + speed | Offshore AND < 10 mph |
| Clean Swell | Swell period | ≥ 12 seconds |
| Direct Swell | Swell angle vs beach | Within 20° of optimal |
| Rising Tide | Tide direction | Incoming + beach prefers incoming |
| Low Crowd | Crowd estimate | Below average for that spot |

**Display logic:**
1. Check all badges against thresholds
2. Rank qualifying badges by contribution to overall score
3. Show top 2-3 badges only

**Placement:** Badges appear as pills next to "Perfect Match" (which only shows when score ≥ 9.0).

**Visual style:** Same pill style as existing badges - dark background, white text.

### 3. Time Window Clamped to First Light

**Logic:**
1. Calculate civil twilight (sun 6° below horizon) for beach coordinates and date
2. Clamp: `displayStartTime = max(calculatedStartTime, civilTwilightTime)`
3. Preserve end time based on conditions

**Edge cases:**
- Entire window before first light → Start at first light or show next best window
- Window becomes < 30 min after clamping → Show next best window instead

**Example:**
- Calculated: 4:00am - 7:50am
- Civil twilight: 6:15am
- Displayed: 6:15am - 7:50am

## Files to Modify

- Score formatting: scoring utility functions
- Badge logic: welcome message component
- Time clamping: optimal window calculation logic

## Testing

- Verify scores cap at 9.9
- Verify whole number scores display without decimal
- Verify badges appear based on thresholds
- Verify time windows never start before civil twilight
