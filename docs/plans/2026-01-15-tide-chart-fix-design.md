# Tide Chart Fix Design

**Date**: 2026-01-15
**Status**: Approved
**Author**: Claude + Steven

## Problem Statement

The tide chart on the Forecast tab displays incorrect data. The chart shows the tide heading toward a low around 7 PM, but the "Next Tides" cards correctly show a HIGH TIDE at 8:37 PM.

Additionally, the chart's visual appearance needs improvement:
- Curve is too angular/jagged instead of smooth wave-like
- Styling is too light/faded, needs more contrast and a cleaner modern look

## Root Cause Analysis

### Data Source Mismatch

The chart and "Next Tides" cards use different data sources:

| Component | Data Source | Accuracy |
|-----------|-------------|----------|
| Next Tides cards | `raw_forecast.tide_schedule` | Correct - actual tide extrema from NOAA |
| The chart | `forecast.next_tide_type` misinterpreted | Wrong - marks regular forecast points as extrema |

**The bug**: In `tide-chart-recharts.tsx`, the `normalizeForecasts` function incorrectly interprets forecast fields:

```typescript
const type = forecast.tide_status ?? forecast.next_tide_type ?? "";
const isHigh = typeof type === "string" && /high/i.test(type);
const isLow = typeof type === "string" && /low/i.test(type);
```

When a forecast entry has `next_tide_type: "High Tide"`, this means "the next tide extreme will be a high" - but the code marks the current forecast time as the high tide point. The actual high is at `next_tide_time`.

## Solution Design

### 1. Data Fix: Use `tide_schedule`

Use `raw_forecast.tide_schedule` - the same authoritative data source that powers the "Next Tides" cards. This contains an array of actual tide extrema:

```typescript
tide_schedule: [
  { time: 1737003420, height: 3.6, type: "high" },  // 8:37 PM
  { time: 1737030720, height: 2.5, type: "low" },   // 12:52 AM
  ...
]
```

**Implementation**: Add a new normalization path that extracts tide extrema from `tide_schedule` when available, falling back to existing logic only when `tide_schedule` is not present.

### 2. Smoother Curve Shape

Use **cosine interpolation** between tide extrema. Tides naturally follow this pattern due to gravitational forces:

```
height = prevHeight + (nextHeight - prevHeight) * (1 - cos(π * t)) / 2
```

This produces:
- Gradual slopes near slack tide (highs/lows)
- Steeper slopes during mid-tide
- Perfectly smooth, wave-like curves

**Implementation**: The existing `synthesizeFromExtrema` function already implements this. We just need to feed it the correct extrema data from `tide_schedule`.

### 3. Visual Styling: Bolder & Cleaner

| Element | Current | Proposed |
|---------|---------|----------|
| Line color | `#2563eb` (blue-600) | `#1e40af` (blue-800) - deeper contrast |
| Line weight | 2.5px | 3px - bolder presence |
| Fill gradient | 35% → 3% opacity | 20% → 0% - subtler |
| Grid lines | Dashed, visible | Lighter or remove vertical |
| Now marker | Red dashed line + label | Solid red line, cleaner label |
| Legend | Colored dots with text | Remove or simplify |
| Axes | Default Recharts | Lighter ticks, bolder labels |

## Files to Modify

1. **`components/forecast/tide-chart-recharts.tsx`**
   - Add `normalizeTideSchedule()` function to extract extrema from `raw_forecast.tide_schedule`
   - Update data flow to prefer `tide_schedule` when available
   - Update styling constants (colors, stroke widths, gradients)
   - Clean up legend and grid styling

2. **`components/forecast/tide-chart-enhanced.tsx`**
   - Pass `forecasts` to the chart so it can access `raw_forecast.tide_schedule`
   - Ensure data flow supports the new normalization

## Testing Strategy

1. Visual verification on Ocean Beach Pier (the beach from the screenshot)
2. Verify "Next Tides" cards and chart now show consistent data
3. Test beaches with and without `tide_schedule` data (fallback behavior)
4. Check mobile responsiveness of updated styling

## Success Criteria

- [ ] Chart curve matches the tide extrema shown in "Next Tides" cards
- [ ] Curve is smooth and wave-like (sinusoidal)
- [ ] Visual styling is bolder with better contrast
- [ ] Cleaner, less cluttered appearance
- [ ] Existing tests pass
- [ ] Fallback works for forecasts without `tide_schedule`
