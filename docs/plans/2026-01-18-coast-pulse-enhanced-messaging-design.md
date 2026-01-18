# Coast Pulse Enhanced Messaging Design

**Date:** 2026-01-18
**Status:** Approved

## Overview

Transform bland NOAA/CDIP buoy data from raw numbers into interpretive, actionable surf commentary with a professional surf report tone.

### Before
```
1.6ft, @ 13s, 63°F
```

### After
```
Clean groundswell, 1.6ft @ 13s SW. Favorable for longboards. Water 63°F (mild).
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interpretation style | Rule-based | Fast, predictable, no API costs |
| Data points covered | All (height, period, direction, temp, tide) | Full interpretive layer |
| Tone | Surf report pro | Concise and authoritative like Surfline |
| Location awareness | Derive from coordinates | Already have lat/lon, no extra input needed |

## Message Structure

```
[Size Assessment], [Height]ft @ [Period]s [Direction]. [Condition Note]. [Water Temp Context]
```

## Interpretation Rules

### Wave Height

| Height Range | Size Label | Condition Note |
|--------------|------------|----------------|
| < 1.0ft | Flat | Minimal energy, SUP or prone conditions |
| 1.0 - 1.5ft | Ankle-to-knee | Best for patient longboarders |
| 1.5 - 2.5ft | Knee-to-waist | Favorable for longboards, fun for all |
| 2.5 - 4.0ft | Waist-to-chest | Good size for most surfers |
| 4.0 - 6.0ft | Head-high range | Solid conditions, intermediate+ |
| 6.0 - 8.0ft | Overhead | Powerful surf, experienced surfers |
| 8.0 - 12.0ft | Double overhead | Heavy conditions, experts only |
| > 12.0ft | XXL | Dangerous, big wave spots only |

### Wave Period

| Period Range | Energy Label | Quality Modifier |
|--------------|--------------|------------------|
| < 6s | Wind chop | Bumpy, disorganized |
| 6 - 9s | Short-period wind swell | Inconsistent, close-out prone |
| 9 - 12s | Mid-period swell | Decent shape, moderate power |
| 12 - 15s | Groundswell | Clean lines, good shape expected |
| 15 - 18s | Long-period groundswell | Solid energy, powerful waves |
| > 18s | Deep-water groundswell | Excellent organization, maximum power |

**Combined logic:** Period modifies the height assessment. Same height at different periods produces different commentary.

### Swell Direction (Location-Aware)

**Region Detection from Coordinates:**

| Region | Lat Range | Lon Range | Coast Faces |
|--------|-----------|-----------|-------------|
| SoCal | 32.5 - 34.5 | -120 to -117 | SW/W |
| Central CA | 34.5 - 37.5 | -123 to -120 | W/NW |
| NorCal | 37.5 - 42.0 | -125 to -122 | NW/W |
| Pacific NW | 42.0 - 49.0 | -125 to -122 | W/NW |
| Hawaii | 18.5 - 22.5 | -161 to -154 | Varies by island |
| East Coast FL | 24.5 - 30.5 | -81 to -80 | E/SE |
| East Coast SE | 30.5 - 36.5 | -82 to -75 | E/SE |
| East Coast Mid | 36.5 - 41.5 | -76 to -73 | E/ESE |
| East Coast NE | 41.5 - 45.0 | -71 to -69 | E/SE |
| Gulf Coast | 25.0 - 30.5 | -98 to -81 | S/SE |

**Direction interpretation adapts by region:**
- SoCal + SW swell → "Filling in south-facing reefs and points"
- NorCal + NW swell → "Direct hit for most breaks"
- East Coast + SE swell → "Clean lines for east-facing beaches"

### Water Temperature

**Base comfort thresholds:**

| Temp Range | Comfort Label | Gear Note |
|------------|---------------|-----------|
| < 50°F | Cold | Full suit + boots/hood |
| 50 - 55°F | Chilly | 4/3 full suit minimum |
| 55 - 60°F | Cool | 3/2 full suit |
| 60 - 65°F | Mild | 3/2 or spring suit |
| 65 - 70°F | Comfortable | Spring suit or trunk it |
| 70 - 75°F | Warm | Trunks, maybe rashguard |
| > 75°F | Tropical | Trunks only |

**Seasonal context:** Compare to regional monthly averages.
- 5°+ above average → "warm for [month]"
- 5°+ below average → "cool for [month]"
- Within range → no seasonal note

### Tide Status

**State interpretation:**

| Status | Enhanced Message Pattern |
|--------|--------------------------|
| Rising toward high | "Pushing in, high in Xh. Beach breaks may back off." |
| High (within 30min) | "Near high, X.Xft. Fat and slow at most spots." |
| Falling from high | "Draining out, dropping for Xh. Reefs and points improving." |
| Low (within 30min) | "Near low, X.Xft. Watch for shallow sections." |
| Rising from low | "Filling in, rising for Xh. Sandbars coming alive." |

**Extreme tide notes:**
- < 0ft → "Extremely low, exposed rocks likely"
- > 6ft → "King tide range, reduced beach access"
- > 5ft swing → "Big tidal swing today"

## Implementation

### New Module

`lib/utils/coast-pulse-formatter.ts`:

```typescript
// Core formatting functions
formatBuoyMessage(data, region): string
formatTideMessage(data, region): string

// Helper functions
detectCoastalRegion(lat, lon): CoastalRegion
getSeasonalTempContext(temp, region, month): string | null
getSwellDirectionContext(direction, region): string
```

### Integration Points

In `app/api/coast-pulse/route.ts`:
- Replace `formatBuoyConditions()` internals with `formatBuoyMessage()`
- Update tide message construction to use `formatTideMessage()`

### No Database Changes

Pure formatting layer on existing data. No schema modifications.

### Testing

Unit tests for each formatter:
- Boundary conditions (exactly 12s period, exactly 2.5ft)
- Missing data handling (no temp, no direction)
- All regions covered
- Seasonal context accuracy

## Example Transformations

| Source | Current | Enhanced |
|--------|---------|----------|
| NOAA | `1.6ft, @ 13s, 63°F` | `Clean groundswell, 1.6ft @ 13s. Favorable for longboards. Water 63°F (mild).` |
| CDIP | `2.4ft, @ 17s, W swell` | `Solid long-period lines, 2.4ft @ 17s W. Good shape expected, building energy.` |
| CDIP | `1.1ft, @ 12s, W swell` | `Modest groundswell, 1.1ft @ 12s W. Best for patient longboarders.` |
| Tide | `Low Tide in 1h 26m @ -1.0ft. Now: 0.4ft Falling` | `Draining fast, -1.0ft low in 1h 26m. Reefs and points improving.` |

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/utils/coast-pulse-formatter.ts` | Create - new formatting module |
| `lib/constants/coastal-regions.ts` | Create - region definitions and averages |
| `app/api/coast-pulse/route.ts` | Modify - integrate new formatters |
| `__tests__/utils/coast-pulse-formatter.test.ts` | Create - unit tests |
