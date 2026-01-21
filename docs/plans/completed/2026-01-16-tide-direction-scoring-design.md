# Tide Direction Scoring Design

**Date:** 2026-01-16
**Status:** Approved
**Author:** Brainstorming session

---

## Problem Statement

### Current Behavior

The scoring system rates beaches based on wave height, swell direction, wind, and tide height - but tide **direction** (rising vs falling) only contributes ~1 point to the final score. A beach that closes out on falling tide can still score an 8 if everything else looks good.

### Real-World Impact

A user drove to a beach rated 8, but it was all closeouts because the tide was pulling back. The size was right, the swell direction was right, but the waves were unrideable.

### Root Cause

- The `trendPreferenceScorer` does check tide direction, but its penalty is too weak (-10 points on a 10% weighted scorer = -1 point final impact)
- There's no concept of tide direction **severity** - some beaches are slightly affected, others become completely unrideable

### Goal

When a beach has a strong tide direction preference and conditions don't match, the score should drop significantly (e.g., 8 → 5) and show a clear warning explaining why.

---

## Solution Overview

### Core Idea

Add a "tide direction sensitivity" factor per beach that amplifies the penalty when tide direction doesn't match the beach's preference.

### Sensitivity Levels

| Sensitivity | Break Type Default | Mismatch Penalty |
|-------------|-------------------|------------------|
| Low | Point breaks | -5 to -10 points |
| Medium | Beach breaks | -10 to -20 points |
| High | Reef breaks | -20 to -30 points |

### Example Scenario

- Beach rated 8 based on swell, wind, size
- Beach prefers rising tide, sensitivity = High (reef)
- Tide is falling → -25 point penalty
- Final score: **8 → 5.5** (rounds to 5 or 6)
- Warning shown: "Tide dropping - this spot works better on incoming"

### Override Capability

Each beach can have its sensitivity manually overridden. A beach break that's unusually tide-sensitive can be set to "high", or a forgiving reef can be set to "medium".

### Data Sources

1. `break_type` → determines default sensitivity
2. `preferred_tide_direction` → rising/falling/either (parsed from notes or manually set)
3. `tide_direction_sensitivity` → optional override column

---

## Data Model Changes

### New Database Column

```sql
ALTER TABLE beaches
ADD COLUMN tide_direction_sensitivity TEXT
CHECK (tide_direction_sensitivity IN ('low', 'medium', 'high', NULL));
```

When `NULL`, sensitivity is derived from `break_type`.

### Existing Columns (Already Present)

- `preferred_tide_direction` - already exists, parsed in `createTidePreferences()`
- `break_type` - already populated for most beaches

### Break Type → Sensitivity Mapping

| break_type value | Default Sensitivity |
|------------------|---------------------|
| 'reef break', 'cobblestone reef break' | high |
| 'beach break', 'river mouth break' | medium |
| 'point break' | low |
| NULL or unknown | medium |

### SpotProfile Type Update

```typescript
export interface TidePreferences {
  readonly minHeightFt: number;
  readonly maxHeightFt: number;
  readonly preferredDirection: 'rising' | 'falling' | 'either' | 'slack';
  readonly directionSensitivity: 'low' | 'medium' | 'high';  // NEW
}
```

The `directionSensitivity` is computed from `tide_direction_sensitivity` column if set, otherwise derived from `break_type`.

---

## Scoring Algorithm Changes

### Approach: Create Dedicated `tideDirectionScorer`

Separate tide direction from trend scoring for clarity and stronger impact.

New scorer with weight **0.15** (15% of total score):

```typescript
const DIRECTION_PENALTIES = {
  low: { match: 10, mismatch: -15 },
  medium: { match: 15, mismatch: -35 },
  high: { match: 20, mismatch: -60 },
};
```

### Scoring Logic

1. If `preferredDirection === 'either'` → return neutral score (70)
2. If tide direction matches preference → bonus (+10 to +20 based on sensitivity)
3. If tide direction opposite → penalty (-15 to -60 based on sensitivity)
4. If tide is slack → half penalty

### Impact on Final Score (15% weight)

| Sensitivity | Direction Match | Direction Mismatch |
|-------------|-----------------|-------------------|
| Low | +1.5 | -2 |
| Medium | +2 | -5 |
| High | +3 | **-9** |

A high-sensitivity beach with wrong tide direction loses **9 points** off the final score.

### Weight Rebalancing

Adding a new 15% weight scorer requires rebalancing existing weights. Options:

1. Reduce `trendPreference` from 10% to 5% (since tide direction moves to new scorer)
2. Reduce `tideFit` from 10% to 5% (less emphasis on height alone)
3. Keep total at 100%

---

## Data Population Strategy

### Phase 1: Parse Existing Notes (Automated)

Write a one-time migration that scans `best_conditions->>'notes'` for keywords:

| Keywords Found | Set `preferred_tide_direction` to |
|----------------|-----------------------------------|
| 'incoming', 'rising', 'push' | 'rising' |
| 'outgoing', 'falling', 'dropping', 'pull' | 'falling' |
| No keywords found | Leave as NULL (defaults to 'either') |

Estimated coverage: ~20-30% of beaches based on existing notes.

### Phase 2: Break Type Defaults (Automatic)

No migration needed - the code derives sensitivity from `break_type` at runtime. Beaches without explicit `tide_direction_sensitivity` get their default from break type.

### Phase 3: Manual Refinement (Ongoing)

Update specific beaches via SQL or admin UI:

```sql
UPDATE beaches
SET preferred_tide_direction = 'rising',
    tide_direction_sensitivity = 'high'
WHERE slug = 'example-beach';
```

### Phase 4: Future - Crowdsourced Feedback (Optional)

After sessions, users could report "tide worked well" or "tide was wrong" - but this is out of scope for initial implementation.

---

## Warnings & User Experience

### Warning Display

When tide direction doesn't match preference, show a warning in the score breakdown:

| Sensitivity | Warning Text |
|-------------|--------------|
| Low | "Tide direction not ideal" |
| Medium | "Tide dropping - may affect wave shape" |
| High | "Tide dropping - this spot closes out on outgoing tide" |

### Where Warnings Appear

1. Beach score card in discovery results
2. Beach detail page conditions section
3. Score breakdown tooltip/modal

### Score Reasons (Already Supported)

The scoring engine already returns `reasons[]` and `warnings[]` arrays. The new scorer populates these:

```typescript
// On mismatch
warnings.push('Tide pulling back - spot prefers incoming');

// On match
reasons.push('Tide rising - good for this spot');
```

### No New UI Components Needed

The existing warning display system handles this - we just need to populate more meaningful messages.

---

## Testing Approach

### Unit Tests (`tide-direction-scorer.test.ts`)

1. Beach prefers rising, tide is rising → bonus applied
2. Beach prefers rising, tide is falling → penalty applied (scaled by sensitivity)
3. Beach prefers 'either' → neutral score
4. Beach prefers slack, tide is slack → bonus applied
5. Sensitivity override respected over break type default

### Integration Tests

1. Full scoring pipeline with new scorer registered
2. Verify high-sensitivity reef with wrong tide drops score by ~9 points
3. Verify warnings appear in composite score output

### Data Population Tests

1. Notes parser correctly extracts "incoming" → 'rising'
2. Notes parser handles edge cases ("mid-tide push" → 'rising')
3. NULL notes defaults to 'either'

### E2E Tests (Playwright)

1. Beach with tide mismatch shows warning in discovery results
2. Score breakdown displays tide direction reason/warning

---

## Implementation Summary

| Component | Change |
|-----------|--------|
| Database | Add `tide_direction_sensitivity` column |
| SpotProfile | Add `directionSensitivity` to TidePreferences |
| Scoring | New `tideDirectionScorer` (15% weight) |
| Data | Migration to parse notes for direction keywords |
| UX | Meaningful warnings via existing system |

---

## Files to Modify

1. `supabase/migrations/YYYYMMDDHHMMSS_add_tide_direction_sensitivity.sql` - new column
2. `supabase/migrations/YYYYMMDDHHMMSS_parse_tide_direction_from_notes.sql` - data backfill
3. `lib/domains/spot-profile/types.ts` - add `directionSensitivity` to TidePreferences
4. `lib/domains/spot-profile/spot-profile.ts` - compute sensitivity from break_type or override
5. `lib/domains/scoring/types.ts` - add weight for new scorer, rebalance existing
6. `lib/domains/scoring/scorers/tide-direction-scorer.ts` - new scorer (create)
7. `lib/domains/scoring/scorers/index.ts` - export new scorer
8. `lib/domains/scoring/index.ts` - register new scorer
9. `__tests__/lib/domains/scoring/tide-direction-scorer.test.ts` - unit tests (create)
