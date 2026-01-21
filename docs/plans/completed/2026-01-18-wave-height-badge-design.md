# Wave Height Badge Design

**Date:** 2026-01-18
**Status:** Approved

## Overview

Add a dedicated wave height badge to the hero recommendation that displays wave size as a range (e.g., "2-3ft"), positioned immediately after the time badge for prominent visibility.

## Problem

Current condition badges (Glass, Clean Swell, Rising Tide) don't communicate wave size. Users see conditions but lack context about how big the waves actually are.

## Solution

Add a wave height badge that:
- Shows wave height as a range (e.g., "2-3ft")
- Appears immediately after the time badge (before condition badges)
- Uses consistent styling with other badges

### Before
```
[4-5:09pm] [Perfect Match] [Glass] [Clean Swell] [Rising Tide]
```

### After
```
[4-5:09pm] [2-3ft] [Perfect Match] [Glass] [Clean Swell] [Rising Tide]
```

## Implementation

### 1. Wave Height Range Formatting

Generate a range by rounding down and adding a buffer:

```typescript
function formatWaveHeightRange(waveHeight: number): string | null {
  if (waveHeight < 0.5) return null; // Don't show for flat conditions
  const lower = Math.max(0.5, Math.floor(waveHeight * 2) / 2);
  const upper = Math.ceil((waveHeight + 0.5) * 2) / 2;
  return `${lower}-${upper}ft`;
}
```

Examples:
- 1.5ft → "1-2ft"
- 2.3ft → "2-3ft"
- 4.0ft → "4-5ft"

### 2. Type Changes

**File:** `types/personalization.ts`

Add `waveHeightBadge` to `SurfDiscoveryRecommendation`:

```typescript
interface SurfDiscoveryRecommendation {
  // ... existing fields
  waveHeightBadge?: string;  // e.g., "2-3ft"
  conditionBadges: ConditionBadge[];
}
```

### 3. Orchestrator Changes

**File:** `lib/services/discovery/surf-discovery-orchestrator.ts`

- Extract `wave_height` from forecast data
- Generate `waveHeightBadge` using the formatting function
- Include in the recommendation object

### 4. Component Changes

**File:** `components/home-screen/hero-recommendation.tsx`

Render the wave height badge immediately after the time badge:

```tsx
{/* Time badge */}
<Badge>...</Badge>

{/* Wave height badge - positioned before condition badges */}
{waveHeightBadge && (
  <Badge
    variant="outline"
    className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
  >
    {waveHeightBadge}
  </Badge>
)}

{/* Perfect Match badge */}
{score >= 90 && <Badge>Perfect Match</Badge>}

{/* Condition badges */}
{conditionBadges?.slice(0, 3).map(...)}
```

## Edge Cases

| Condition | Wave Height | Badge Display |
|-----------|-------------|---------------|
| Flat | < 0.5ft | No badge shown |
| Very small | 0.5ft | "0.5-1ft" |
| Typical | 2ft | "2-3ft" |
| Large | 8ft | "8-9ft" |

## Files to Modify

1. `types/personalization.ts` - Add type
2. `lib/services/discovery/surf-discovery-orchestrator.ts` - Generate badge
3. `components/home-screen/hero-recommendation.tsx` - Render badge

## Testing

- Verify badge appears after time badge
- Verify range calculation produces expected values
- Verify flat conditions don't show badge
- Visual check on mobile and desktop breakpoints
