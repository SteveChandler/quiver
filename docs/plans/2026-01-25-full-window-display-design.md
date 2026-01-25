# Full Window Display Design

**Date:** 2026-01-25
**Status:** Ready for implementation

## Problem

The "best window" timing is showing overly narrow 30-minute windows (e.g., "10-10:30am") across multiple beaches. This feels artificially precise and unrealistic. A surfer would say "morning glass" or "get there by 10," not a 30-minute slot.

### Root Cause

The `applySubHourRefinement` function in `window-selector.ts` (lines 471-526) performs aggressive "peak centering":

1. Finds the highest-scoring time within a surfable window
2. Creates a ±30 minute buffer around that peak
3. Snaps to 15-minute boundaries

So even if conditions are good from 8am-2pm, if 10am scores highest, it displays "10-10:30am."

## Solution

Show the full surfable window with the peak time noted separately as a tag.

**Before:** "10:00 AM - 10:30 AM"
**After:** "8:00 AM - 1:00 PM" with tag "Best at 10am"

## Design

### Algorithm Changes

Remove the peak-centering step in `applySubHourRefinement`. Return the full surfable window as determined by:

- Score threshold (conditions above 50/100)
- Tide boundaries (if beach has tide preferences)
- Sunset cap
- Time slot boundaries (if user selected dawn-patrol, morning, etc.)

The `peakTime` field already exists in the return value - we stop shrinking the window around it.

**Code change:** In `applySubHourRefinement` (lines 471-526), remove the peak-centering logic that creates `peakWindowStart`/`peakWindowEnd`. Return `refinedStart`/`refinedEnd` directly after the score/tide/light refinement step. This is ~40 lines to remove, no new logic needed.

### Tag Logic

#### "Short Window" Tag (existing)

- **Trigger:** Window duration < 2 hours
- **Change:** None - keep as-is
- Now meaningful: shows when tide/conditions actually constrain the session

#### "Best at [Time]" Tag (new)

- **Trigger:** Window duration > 3 hours
- **Format:** Casual style - "Best at 10am" (not "10:00 AM")
- **Rationale:**
  - Space efficient (4 chars vs 8)
  - Differentiates from primary time window (data vs hint)
  - Fits surfer persona better

### Frontend Display

**Primary text:** Full range - "8:00 AM - 1:00 PM"
**Tag:** Peak indicator - "Best at 10am" (when applicable)

## Edge Cases

| Scenario | Window Display | Tags |
|----------|---------------|------|
| Good conditions 6am-12pm, peak at 9am | 6:00 AM - 12:00 PM | "Best at 9am" |
| Tide-constrained 7:30am-9:00am | 7:30 AM - 9:00 AM | "Short window" |
| Borderline 8am-11am (3hr), peak at 9:30am | 8:00 AM - 11:00 AM | *(no tags)* |
| Conditions degrade quickly, 10am-11:30am | 10:00 AM - 11:30 AM | "Short window" |
| All-day glass, 6am-sunset (5pm) | 6:00 AM - 5:00 PM | "Best at 10am" |

## Implementation

### Files to Modify

| File | Change |
|------|--------|
| `lib/services/discovery/window-selector.ts` | Remove peak-centering logic (~40 lines in `applySubHourRefinement`) |
| `components/beach-detail/unified-surf-card.tsx` | Add "Best at X" tag for windows > 3 hours |
| `components/home-screen/` (spot cards) | Same tag logic for discovery cards |

### Data Flow

- `peakTime` already exists in `PersonalizedForecastWindow` - no API changes needed
- Frontend formats `peakTime` as casual "10am" style

### Testing

- [ ] Verify windows show full duration (not peak-centered)
- [ ] Verify "Short window" still appears for < 2 hour windows
- [ ] Verify "Best at X" appears for > 3 hour windows
- [ ] Check multiple beaches to ensure variety (not all showing identical times)
- [ ] Verify tide-driven boundaries still work correctly
- [ ] Verify sunset capping still works correctly
