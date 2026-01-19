# Time Slot Quality Indicators Design

**Date:** 2026-01-18
**Status:** Approved
**Problem:** Dawn patrol filter showing afternoon times (4-5:08pm) instead of tomorrow's dawn patrol with quality context

## Overview

When a user selects a time slot filter (Dawn patrol, Morning, Afternoon) and that window has passed for today, the system should show tomorrow's forecast for that slot with clear quality indicators rather than falling back to an unrelated time or showing nothing.

## Current Behavior

1. User selects "Dawn patrol" at 6:50pm
2. System filters to 6-9am forecasts
3. If tomorrow's 7am forecast has score < 50, returns `null`
4. UI shows "No great dawn patrol windows"

**Bug:** Before the fix, it showed "4-5:08pm" (wrong time slot entirely)

## New Behavior

1. User selects "Dawn patrol" at 6:50pm
2. System filters to 6-9am forecasts
3. Always returns best forecast in that slot, regardless of score
4. UI shows tomorrow's forecast with quality indicator: "Tomorrow's dawn patrol at Blacks — conditions are fair at 4.8/10"

## Headline Messaging

Four tiers based on score (0-100 internal, displayed as X/10):

| Score | Tier | Headline Template |
|-------|------|-------------------|
| 80+ | great | "{Beach} is your best bet at **{score}**." |
| 60-79 | good | "{Beach} is a good option at **{score}**." |
| 40-59 | fair | "Conditions are fair at {Beach} — **{score}**." |
| <40 | marginal | "Conditions are marginal at {Beach} — **{score}**." |

### Tomorrow Prefix

When showing next-day forecast (time slot has passed for today):

| Time Slot | Prefix |
|-----------|--------|
| Dawn patrol | "Tomorrow's dawn patrol at..." |
| Morning | "Tomorrow morning at..." |
| Afternoon | "Tomorrow afternoon at..." |

**Examples:**
- "Tomorrow's dawn patrol at Blacks is a good option at **6.5/10**."
- "Tomorrow morning — conditions are fair at Blacks — **4.8/10**."

## Visual Treatment

### Score Colors

| Tier | Color | Tailwind Class |
|------|-------|----------------|
| great | Orange | `text-accent-orange` |
| good | Orange | `text-accent-orange` |
| fair | Amber | `text-amber-400` |
| marginal | Gray | `text-white/60` |

### Condition Badges

| Tier | Badge | Style |
|------|-------|-------|
| great | "Great Conditions" | `bg-emerald-500/20 text-emerald-300 border-emerald-400/30` |
| good | (none) | — |
| fair | "Fair Conditions" | `bg-amber-500/20 text-amber-300 border-amber-400/30` |
| marginal | "Marginal" | `bg-white/10 text-white/60 border-white/20` |

**Note:** Replaces the existing "Perfect Match" badge (score >= 90).

### Badge Order

1. Time window badge ("Tomorrow 7-9am")
2. Wave height badge ("2-3ft")
3. Condition tier badge ("Great Conditions" / "Fair Conditions" / "Marginal")
4. Other condition badges ("Clean Swell", "Rising Tide") — only show for good+ tiers

## Logic Changes

### window-selector.ts

Remove score threshold when a specific time slot is selected:

```typescript
// When time slot is specified (not 'any'), skip score threshold
// Always return best window in that slot so UI can show quality indicator
const shouldApplyThreshold = !actualTimeSlot || actualTimeSlot === 'any';
const effectiveThreshold = shouldApplyThreshold
  ? (isMorning && isToday) ? MIN_SCORE_THRESHOLD_MORNING : MIN_SCORE_THRESHOLD
  : 0; // No threshold for specific time slots
```

### Data Flow

- `isTomorrow`: Derived in component by comparing `window.start` to current date (already exists)
- `timeSlot`: Passed as prop from `home-screen/index.tsx` to `HeroRecommendation`

```typescript
interface HeroRecommendationProps {
  // ... existing props
  timeSlot?: TimeSlot;
}
```

## Component Helpers

### hero-recommendation.tsx

```typescript
type ConditionTier = 'great' | 'good' | 'fair' | 'marginal';

function getConditionTier(score: number): ConditionTier {
  if (score >= 80) return 'great';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'marginal';
}

function getScoreColorClass(tier: ConditionTier): string {
  switch (tier) {
    case 'great':
    case 'good':
      return 'text-accent-orange';
    case 'fair':
      return 'text-amber-400';
    case 'marginal':
      return 'text-white/60';
  }
}

function getConditionBadge(tier: ConditionTier): { label: string; className: string } | null {
  switch (tier) {
    case 'great':
      return {
        label: 'Great Conditions',
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
      };
    case 'good':
      return null;
    case 'fair':
      return {
        label: 'Fair Conditions',
        className: 'bg-amber-500/20 text-amber-300 border-amber-400/30'
      };
    case 'marginal':
      return {
        label: 'Marginal',
        className: 'bg-white/10 text-white/60 border-white/20'
      };
  }
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No forecasts exist for time slot | Return best available in slot; UI shows "Marginal" |
| `timeSlot === 'any'` | Keep current behavior - apply score threshold |
| Score exactly on boundary (e.g., 80) | Use >= for upper tier (80 → "great") |
| User timezone differs from beach | Use beach timezone for all calculations |

## Files to Modify

| File | Changes |
|------|---------|
| `lib/services/discovery/window-selector.ts` | Remove score threshold when specific time slot selected |
| `components/home-screen/hero-recommendation.tsx` | Add tier logic, headline builder, score colors, condition badges |
| `components/home-screen/index.tsx` | Pass `timeSlot` prop to HeroRecommendation |

## Test Cases

1. `selectBestWindow` returns low-score window when time slot specified
2. `selectBestWindow` returns tomorrow's forecast when today's slot passed
3. `HeroRecommendation` renders correct headline for each tier
4. `HeroRecommendation` renders correct score color for each tier
5. `HeroRecommendation` renders correct condition badge for each tier
6. `HeroRecommendation` shows "Tomorrow" prefix correctly

## Implementation Order

1. Update `window-selector.ts` logic (remove threshold for specific slots)
2. Add helper functions to `hero-recommendation.tsx`
3. Update headline rendering
4. Update score color rendering
5. Update condition badge rendering
6. Pass `timeSlot` prop from parent
7. Add tests
