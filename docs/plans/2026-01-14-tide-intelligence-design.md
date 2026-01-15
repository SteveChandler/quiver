# Tide Intelligence Design

**Date:** 2026-01-14
**Status:** Ready for implementation

## Overview

A comprehensive feature that integrates rich tide preference data for San Diego surf spots into Quiver's scoring, recommendations, and UI. Enables surfers to understand when tide conditions are optimal for each beach.

## Problem

1. **Scoring ignores tide direction** - Current scoring only considers tide height (min/max ft), not whether the tide is rising or falling
2. **Missing local knowledge** - Beaches have tide preferences (e.g., "Windansea fires on incoming tide") but this isn't surfaced to users
3. **No predictive guidance** - Users can't see when conditions will become optimal

## Solution

Four interconnected parts:

| Part | Description |
|------|-------------|
| **D: Seed Database** | Populate 30 San Diego beaches with tide preferences, prose, and tips |
| **A: Scoring Integration** | Apply direction-based multiplier to beach scores |
| **C: Educational UI** | Display tide guidance and wave tips on beach detail pages |
| **B: Tide Window Alerts** | Show "optimal in Xh" predictions on beach detail pages |

## Implementation Sequence

```
D (Seed) ─────→ A (Scoring) ─────→ B (Alerts)
    │                               ↑
    └──────→ C (UI) ────────────────┘
```

---

## Part D: Database Seeding

### Schema

Uses existing columns only (no schema changes):

| Column | Type | Usage |
|--------|------|-------|
| `preferred_tide_direction` | text | 'rising' / 'falling' / 'slack' / 'either' |
| `best_conditions_prose` | text | Detailed tide/condition guidance |
| `wave_tips` | text | Practical surfing advice |
| `region` | text | Set to 'San Diego' for null entries |

### Data Operations

**27 UPDATEs** to existing beaches:

| JSON Name | Database Match |
|-----------|----------------|
| San Onofre | San Onofre State Beach |
| Lower Trestles | Lower Trestles |
| Oceanside Pier | Oceanside Pier |
| Terramar | Terramar Point |
| Ponto | Ponto |
| Grandview Beach | Grandview |
| Moonlight Beach | Moonlight State Beach |
| D Street | D Street |
| Swami's | Swami's |
| Cardiff Reef | Cardiff Reef |
| San Elijo (Pipes) | San Elijo State Beach |
| San Elijo (Pipes) | Pipes |
| Del Mar Rivermouth | Del Mar Rivermouth |
| Black's Beach | Blacks |
| Scripps Pier | Scripps |
| La Jolla Shores | La Jolla Shores |
| Windansea | Windansea |
| PB Point | PB Point |
| Tourmaline | Tourmaline |
| Crystal Pier | Crystal Pier |
| Pacific Beach | Pacific Beach |
| Mission Beach | Mission Beach |
| Ocean Beach Pier | Ocean Beach Pier |
| Sunset Cliffs (Garbage) | Sunset Cliffs – Garbage |
| Coronado | Hotel Del Coronado |
| Coronado | Coronado North Jetty |
| Imperial Beach | Imperial Beach |

**5 INSERTs** for missing beaches:

| Beach | Coordinates | Break Type |
|-------|-------------|------------|
| La Jolla Cove | 32.8503, -117.2729 | Reef |
| Bird Rock | 32.8135, -117.2739 | Reef |
| Pumphouse | 32.8098, -117.2728 | Reef |
| South Mission Jetty | 32.7549, -117.2534 | Jetty/Sand |
| Ocean Beach Jetty | 32.7516, -117.2489 | Jetty/Sand |

All new beaches:
- `state`: "CA"
- `region`: "San Diego"
- `timezone`: "America/Los_Angeles"

### Migration File

`supabase/migrations/YYYYMMDDHHMMSS_seed_san_diego_tide_preferences.sql`

---

## Part A: Scoring Integration

### Current Gap

`lib/surf/scoring.ts` only scores tide **height**:

```typescript
function computeTideScore(tideHeightM, tideMinFt, tideMaxFt) {
  const score = 1 - Math.abs(tideFt - center) / half;
  return clamp01(score);
}
```

### Solution

Add tide **direction** multiplier applied at display time.

#### 1. Extend `useDynamicTide` Hook

**File:** `hooks/useDynamicTide.ts`

Add to return type:

```typescript
interface DynamicTideResult {
  // ... existing fields ...

  // New fields for direction
  currentDirection: 'rising' | 'falling' | 'slack';
  minutesToDirectionChange: number | null;
}
```

**Logic:**
- If next extreme is "high" → tide is currently rising
- If next extreme is "low" → tide is currently falling
- If within 30 minutes of extreme → slack

#### 2. Direction Multiplier Helper

**File:** `lib/surf/tide-direction.ts` (new)

```typescript
export function getDirectionMultiplier(
  beachPref: 'rising' | 'falling' | 'slack' | 'either' | null,
  currentDir: 'rising' | 'falling' | 'slack'
): number {
  if (!beachPref || beachPref === 'either') return 1.0;
  if (beachPref === currentDir) return 1.0;
  if (beachPref === 'slack' && currentDir !== 'slack') return 0.85;
  return 0.7; // Mismatch penalty
}
```

#### 3. Apply at Display Time

In components displaying scores:

```typescript
const { currentDirection } = useDynamicTide(forecasts);
const multiplier = getDirectionMultiplier(
  beach.preferred_tide_direction,
  currentDirection
);
const adjustedScore = Math.round(baseScore * multiplier);
```

**Affected components:**
- Beach cards on home screen
- Beach detail page scores
- Recommendations/rankings

### Why Display-Time?

- Materialized view (`mv_beach_hourly_scores`) precomputes hourly scores
- Tide direction changes throughout the day
- Applying at render time keeps cache fast, adjustment real-time

---

## Part C: Educational UI

### Content Placement

| Content | Location | Component |
|---------|----------|-----------|
| `best_conditions_prose` | Tides tab, below chart | New `TideConditionsCard` |
| `wave_tips` | Overview section | New `WaveTipsCard` |

### Component: TideConditionsCard

**Location:** `components/beach-detail/tabs/tides-tab.tsx`

```
┌─────────────────────────────────────────┐
│  🌊 Best Tide Conditions                │
│                                         │
│  "Windansea thrives on an incoming      │
│  tide. The push of the ocean helps      │
│  the swell mount over the slab reef,    │
│  creating steep, hollow A-frames..."    │
│                                         │
│  ○ Rising tide preferred                │
└─────────────────────────────────────────┘
```

**Elements:**
- Icon: 🌊
- Title: "Best Tide Conditions"
- Body: `best_conditions_prose` text
- Pill: Direction indicator (Rising/Falling/Slack/Any tide)

### Component: WaveTipsCard

**Location:** `components/beach-detail/spot-overview.tsx`

```
┌─────────────────────────────────────────┐
│  💡 Wave Tips                           │
│                                         │
│  "Localism is a factor here. Observe    │
│  the peak before paddling out and       │
│  respect the rotation."                 │
└─────────────────────────────────────────┘
```

**Elements:**
- Icon: 💡
- Title: "Wave Tips"
- Body: `wave_tips` text

### Styling

- Match existing card patterns in beach detail
- Subtle background (gray-50 light / gray-800 dark)
- No heavy borders
- Consistent padding with other sections

---

## Part B: Tide Window Alerts

### Location

Beach detail page, Forecast tab hero or Tides tab header.

### Alert States

| Current Direction | Beach Preference | Alert |
|-------------------|------------------|-------|
| Rising | Rising | ✓ "Optimal now - tide is rising" |
| Rising | Falling | ⏱ "Better in ~Xh when tide falls" |
| Falling | Falling | ✓ "Optimal now - tide is falling" |
| Falling | Rising | ⏱ "Better in ~Xh when tide rises" |
| Any | Either | ✓ "Good on any tide" |
| Slack (near high) | Rising | ⏱ "Wait ~30min for falling tide" |

### Visual Design

```
┌─────────────────────────────────────────┐
│  Windansea                    Score: 78 │
│  ─────────────────────────────────────  │
│  ┌─────────────────────────────────┐    │
│  │ ⏱ Better in 2h (rising tide)   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Forecast content...]                  │
└─────────────────────────────────────────┘
```

### Color Coding

| State | Color | Example |
|-------|-------|---------|
| Optimal now | Green (emerald-500) | "Optimal now - tide is rising" |
| Better later | Amber (amber-500) | "Better in 2h (rising tide)" |
| Any tide | Gray (gray-400) | "Good on any tide" |

### Calculation

```typescript
function getTideAlert(
  beachPref: string | null,
  currentDir: 'rising' | 'falling' | 'slack',
  minutesToChange: number | null
): TideAlert {
  if (!beachPref || beachPref === 'either') {
    return { status: 'neutral', message: 'Good on any tide' };
  }

  if (beachPref === currentDir) {
    return {
      status: 'optimal',
      message: `Optimal now - tide is ${currentDir}`
    };
  }

  const hours = minutesToChange ? Math.round(minutesToChange / 60) : null;
  const timeStr = hours ? `in ${hours}h` : 'soon';

  return {
    status: 'waiting',
    message: `Better ${timeStr} (${beachPref} tide)`
  };
}
```

---

## Files Changed

| Part | File | Change |
|------|------|--------|
| D | `supabase/migrations/YYYYMMDDHHMMSS_seed_san_diego_tide_preferences.sql` | New migration |
| A | `hooks/useDynamicTide.ts` | Add `currentDirection`, `minutesToDirectionChange` |
| A | `lib/surf/tide-direction.ts` | New file - direction multiplier helper |
| A | `components/beach-detail/tabs/forecast-tab.tsx` | Apply direction multiplier |
| A | `components/home-screen/beach-card.tsx` | Apply direction multiplier |
| C | `components/beach-detail/tabs/tides-tab.tsx` | Add TideConditionsCard |
| C | `components/beach-detail/spot-overview.tsx` | Add WaveTipsCard |
| B | `components/beach-detail/tide-alert.tsx` | New component |
| B | `lib/surf/tide-alerts.ts` | New file - alert logic |

---

## Testing

### Part D
- Verify all 27 beaches updated with correct data
- Verify 5 new beaches inserted with valid coordinates
- Verify region set to 'San Diego' for all affected beaches

### Part A
- Unit test `getDirectionMultiplier()` with all combinations
- Verify scores adjust correctly when tide direction changes
- Verify fallback behavior when `preferred_tide_direction` is null

### Part C
- Verify cards render when prose/tips exist
- Verify cards hidden when prose/tips are null
- Visual regression test for card styling

### Part B
- Unit test `getTideAlert()` with all state combinations
- Verify alert updates when tide direction changes
- Verify time estimates are reasonable

---

## Future Enhancements

1. **Home screen badges** - Show tide status on beach cards
2. **Push notifications** - "Head to Windansea now - tide is rising"
3. **Morning intel** - Include tide timing in daily digest
4. **Expand to other regions** - Apply same pattern to OC, LA, etc.

---

## Data Source

Tide preference data extracted from local knowledge research covering 30 San Diego County surf spots from San Onofre to Imperial Beach. Each entry includes:
- Preferred tide direction with confidence level
- Evidence citations from primary sources
- Prose descriptions and practical wave tips
