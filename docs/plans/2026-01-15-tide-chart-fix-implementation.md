# Tide Chart Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the tide chart to display correct tide data and improve visual styling.

**Architecture:** Extract tide extrema from `raw_forecast.tide_schedule` (same source as "Next Tides" cards), use cosine interpolation to generate smooth curves, and apply bolder/cleaner styling.

**Tech Stack:** React, Recharts, TypeScript

---

## Task 1: Add Tide Schedule Extraction Function

**Files:**
- Modify: `components/forecast/tide-chart-recharts.tsx:200-225` (add after `normalizeEvents`)
- Test: `__tests__/components/forecast/tide-chart-recharts.test.ts` (create if needed)

**Step 1: Write the failing test**

Create test file if it doesn't exist:

```typescript
// __tests__/components/forecast/tide-chart-recharts.test.ts
import { normalizeTideSchedule } from "@/components/forecast/tide-chart-recharts";

describe("normalizeTideSchedule", () => {
  it("extracts tide extrema from raw_forecast.tide_schedule", () => {
    const forecasts = [
      {
        forecast_date: "2026-01-15",
        forecast_time: "12:00",
        raw_forecast: {
          tide_schedule: [
            { time: 1737003420, height: 3.6, type: "high" },
            { time: 1737030720, height: 2.5, type: "low" },
          ],
        },
      },
    ];

    const result = normalizeTideSchedule(forecasts);

    expect(result).toHaveLength(2);
    expect(result[0].h).toBe(3.6);
    expect(result[0].isHigh).toBe(true);
    expect(result[1].h).toBe(2.5);
    expect(result[1].isLow).toBe(true);
  });

  it("returns empty array when no tide_schedule exists", () => {
    const forecasts = [
      {
        forecast_date: "2026-01-15",
        forecast_time: "12:00",
        raw_forecast: null,
      },
    ];

    const result = normalizeTideSchedule(forecasts);
    expect(result).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern="tide-chart-recharts.test" --no-coverage`
Expected: FAIL with "normalizeTideSchedule is not exported"

**Step 3: Write minimal implementation**

Add to `components/forecast/tide-chart-recharts.tsx` after line ~222 (after `normalizeEvents`):

```typescript
/**
 * Extract tide extrema from raw_forecast.tide_schedule
 * This is the authoritative source - same data used by "Next Tides" cards
 */
export const normalizeTideSchedule = (
  forecasts?: EnhancedForecastEntity[]
): InternalPoint[] => {
  if (!Array.isArray(forecasts)) return [];

  // Find first forecast with tide_schedule
  for (const forecast of forecasts) {
    const schedule = forecast.raw_forecast?.tide_schedule;
    if (Array.isArray(schedule) && schedule.length > 0) {
      return schedule.map((tide) => ({
        t: new Date(tide.time * 1000),
        h: tide.height,
        isHigh: tide.type === "high",
        isLow: tide.type === "low",
        timestamp: tide.time * 1000,
      }));
    }
  }

  return [];
};
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit --testPathPattern="tide-chart-recharts.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add components/forecast/tide-chart-recharts.tsx __tests__/components/forecast/tide-chart-recharts.test.ts
git commit -m "feat(tide-chart): add normalizeTideSchedule function

Extracts tide extrema from raw_forecast.tide_schedule,
the same authoritative source used by Next Tides cards."
```

---

## Task 2: Update Data Flow to Use Tide Schedule

**Files:**
- Modify: `components/forecast/tide-chart-recharts.tsx:417-431` (rawLine useMemo)

**Step 1: Write the failing test**

Add to `__tests__/components/forecast/tide-chart-recharts.test.ts`:

```typescript
describe("TideChart data priority", () => {
  it("prefers tide_schedule over forecast fields when available", () => {
    // This is an integration test - we'll verify the chart renders correctly
    // by checking the data flow prioritizes tide_schedule
    const forecasts = [
      {
        forecast_date: "2026-01-15",
        forecast_time: "17:00",
        tide_height: "2.3 ft",
        next_tide_type: "High Tide", // This used to cause wrong marking
        raw_forecast: {
          tide_schedule: [
            { time: 1737003420, height: 3.6, type: "high" }, // 8:37 PM
            { time: 1737030720, height: 2.5, type: "low" },
          ],
        },
      },
    ];

    const tideScheduleData = normalizeTideSchedule(forecasts);

    // The 8:37 PM point should be marked as high, NOT the 5 PM forecast time
    expect(tideScheduleData[0].isHigh).toBe(true);
    expect(tideScheduleData[0].timestamp).toBe(1737003420 * 1000);
  });
});
```

**Step 2: Run test to verify current state**

Run: `yarn test:unit --testPathPattern="tide-chart-recharts.test" --no-coverage`
Expected: PASS (the extraction function already works)

**Step 3: Update rawLine useMemo to prioritize tide_schedule**

Modify the `rawLine` useMemo in `components/forecast/tide-chart-recharts.tsx` (around line 425):

```typescript
const tideScheduleData = React.useMemo(
  () => normalizeTideSchedule(forecasts),
  [forecasts]
);

const rawLine = React.useMemo(() => {
  // Priority: direct data > tide_schedule > hourly > events > forecasts
  if (directData.length) return directData;
  if (tideScheduleData.length) return synthesizeFromExtrema(tideScheduleData);
  if (hourlyData.length) return hourlyData;
  if (eventData.length) return synthesizeFromExtrema(eventData);
  if (forecastData.length) return forecastData;
  return [] as InternalPoint[];
}, [directData, tideScheduleData, hourlyData, eventData, forecastData]);
```

**Step 4: Verify tests still pass**

Run: `yarn test:unit --testPathPattern="tide-chart" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add components/forecast/tide-chart-recharts.tsx __tests__/components/forecast/tide-chart-recharts.test.ts
git commit -m "feat(tide-chart): prioritize tide_schedule for chart data

Uses synthesizeFromExtrema with tide_schedule data to generate
smooth cosine-interpolated curves from actual tide extrema."
```

---

## Task 3: Update Visual Styling - Line and Fill

**Files:**
- Modify: `components/forecast/tide-chart-recharts.tsx:580-645` (Area and gradient defs)

**Step 1: Document current values**

Current styling:
- Line color: `#2563eb` (blue-600)
- Line width: 2.5px
- Gradient: 35% → 3% opacity

**Step 2: Update gradient definition**

Find the `<defs>` section (around line 581) and update:

```typescript
<defs>
  <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#1e40af" stopOpacity={0.2} />
    <stop offset="100%" stopColor="#1e40af" stopOpacity={0} />
  </linearGradient>
</defs>
```

**Step 3: Update Area component**

Find the `<Area>` component (around line 636) and update:

```typescript
<Area
  xAxisId="time"
  type="monotone"
  dataKey="h"
  stroke="#1e40af"
  strokeWidth={3}
  fill={`url(#fill-${gradId})`}
  isAnimationActive={animationEnabled}
  connectNulls={true}
/>
```

**Step 4: Visual verification**

Run: `yarn dev`
Navigate to: `http://localhost:3001/ca/san-diego/ocean-beach-pier` → Forecast → Tides tab
Expected: Darker blue line (3px), subtler gradient fill

**Step 5: Commit**

```bash
git add components/forecast/tide-chart-recharts.tsx
git commit -m "style(tide-chart): bolder line and subtler fill

- Line color: #2563eb → #1e40af (blue-800)
- Line width: 2.5px → 3px
- Gradient: 35%→3% → 20%→0% opacity"
```

---

## Task 4: Clean Up Grid and Axes

**Files:**
- Modify: `components/forecast/tide-chart-recharts.tsx:588-634` (CartesianGrid, XAxis, YAxis)

**Step 1: Update CartesianGrid**

Find CartesianGrid (around line 588) and update:

```typescript
<CartesianGrid
  vertical={false}
  stroke="#e2e8f0"
  strokeDasharray="0"
  strokeOpacity={0.5}
/>
```

**Step 2: Update axis tick styling**

Update the XAxis components to have bolder, cleaner text:

```typescript
{/* Top axis: days */}
<XAxis
  dataKey={(p: TidePoint) => +toDate(p.t)}
  type="number"
  domain={[minTs, maxTs]}
  tickFormatter={(v) => dayFormatter(new Date(v))}
  ticks={days.map((d) => +d)}
  axisLine={false}
  tickLine={false}
  interval={0}
  tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
  height={22}
  orientation="top"
/>

{/* Bottom axis: time */}
<XAxis
  xAxisId="time"
  dataKey={(p: TidePoint) => +toDate(p.t)}
  type="number"
  domain={[minTs, maxTs]}
  ticks={timeTicks}
  tickFormatter={(v) =>
    new Date(v).toLocaleTimeString(undefined, { hour: "numeric" })
  }
  axisLine={false}
  tickLine={false}
  interval={0}
  tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
  height={28}
  orientation="bottom"
/>

<YAxis
  domain={computedYDomain}
  axisLine={false}
  tickLine={false}
  width={36}
  tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
  tickFormatter={(v) => v.toFixed(0)}
/>
```

**Step 3: Visual verification**

Run: `yarn dev`
Expected: Cleaner grid (solid light lines), bolder axis labels

**Step 4: Commit**

```bash
git add components/forecast/tide-chart-recharts.tsx
git commit -m "style(tide-chart): cleaner grid and bolder axis labels

- Grid: solid lines at 50% opacity (less visual noise)
- Axis labels: #475569 (slate-600), font-weight 500"
```

---

## Task 5: Update Now Marker Styling

**Files:**
- Modify: `components/forecast/tide-chart-recharts.tsx:649-667` (ReferenceLine for now)

**Step 1: Update Now marker**

Find the now ReferenceLine (around line 649) and update:

```typescript
{showNowLine && (
  <ReferenceLine
    xAxisId="time"
    x={windowBounds.nowTs}
    stroke="#dc2626"
    strokeDasharray="0"
    strokeWidth={2}
    label={{
      value:
        nowHeight !== null
          ? `Now · ${nowHeight.toFixed(1)} ${unit}`
          : "Now",
      position: "top",
      fill: "#dc2626",
      fontSize: 12,
      fontWeight: 600,
    }}
  />
)}
```

**Step 2: Visual verification**

Expected: Solid red line (not dashed), bolder label

**Step 3: Commit**

```bash
git add components/forecast/tide-chart-recharts.tsx
git commit -m "style(tide-chart): solid now marker with bolder label

- Solid line instead of dashed
- Stroke width: 1.5px → 2px
- Label: font-weight 600, dot separator"
```

---

## Task 6: Simplify Legend

**Files:**
- Modify: `components/forecast/tide-chart-recharts.tsx:677-694` (legend section)

**Step 1: Simplify the legend**

Find the legend section (around line 677) and simplify:

```typescript
{!compact && (
  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
    <div className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full bg-blue-800" />
      <span>Tide</span>
    </div>
    {showNowLine && (
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 rounded-full bg-red-600" />
        <span>Now</span>
      </div>
    )}
    <div className="flex items-center gap-1.5">
      <span className="h-px w-4 bg-slate-400" />
      <span>Sea level</span>
    </div>
  </div>
)}
```

**Step 2: Visual verification**

Expected: Cleaner legend with line indicators instead of dots

**Step 3: Commit**

```bash
git add components/forecast/tide-chart-recharts.tsx
git commit -m "style(tide-chart): simplified legend with line indicators

Replaced colored dots with line indicators that match
the actual chart elements for better visual consistency."
```

---

## Task 7: Manual Verification and Final Commit

**Step 1: Run all tide chart tests**

```bash
yarn test:unit --testPathPattern="tide-chart" --no-coverage
```

Expected: All tests pass

**Step 2: Visual verification on Ocean Beach Pier**

Run: `yarn dev`
Navigate to: `http://localhost:3001/ca/san-diego/ocean-beach-pier`
Go to: Forecast tab → Tides sub-tab

Verify:
- [ ] Chart curve matches "Next Tides" cards (high at 8:37 PM shows as peak)
- [ ] Curve is smooth and wave-like
- [ ] Line is darker blue (#1e40af), 3px width
- [ ] Gradient fill is subtle
- [ ] Grid lines are cleaner
- [ ] Now marker is solid red line
- [ ] Legend is simplified

**Step 3: Test a beach without tide_schedule (fallback)**

Find a beach that might not have tide_schedule and verify the chart still renders using the fallback path.

**Step 4: Final commit if all looks good**

```bash
git add -A
git status
# If there are any remaining changes:
git commit -m "chore(tide-chart): final cleanup"
```

---

## Summary

| Task | Description | Time |
|------|-------------|------|
| 1 | Add normalizeTideSchedule function | 5 min |
| 2 | Update data flow to prioritize tide_schedule | 5 min |
| 3 | Update line and fill styling | 3 min |
| 4 | Clean up grid and axes | 3 min |
| 5 | Update now marker styling | 2 min |
| 6 | Simplify legend | 2 min |
| 7 | Manual verification | 5 min |
| **Total** | | **~25 min** |
