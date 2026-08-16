# Wind Forecast Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken custom CSS wind timeline with a Recharts area chart showing wind speed, gusts, and a "now" marker — matching the tide chart's visual quality.

**Architecture:** New `WindForecastChart` component using Recharts `AreaChart` with two `Area` layers (speed fill + gust dashed line), custom tooltip, and a "now" `ReferenceLine`. Drops into the existing `WindCheckerClient` replacing the `WindTimeline` component.

**Tech Stack:** Recharts 2.15.0 (already installed), TypeScript, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `components/tools/wind-forecast-chart.tsx` | Recharts area chart for 24h wind data |
| Modify | `components/tools/wind-checker-client.tsx` | Replace `WindTimeline` with `WindForecastChart`, remove old component |

---

### Task 1: Create WindForecastChart component

**Files:**
- Create: `components/tools/wind-forecast-chart.tsx`

- [ ] **Step 1: Create the WindForecastChart component**

This component receives the wind data array + offshore orientation info, and renders a Recharts area chart. It includes:
- Speed area with blue gradient fill
- Gust dashed line
- X-axis with 3-hour time labels
- Y-axis with mph values
- Red "now" reference line
- Custom dark-themed tooltip showing speed, gust, direction, and quality

```tsx
"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { OpenMeteoWindPoint } from "@/lib/services/open-meteo-wind-service";
import { classifyWindQuality } from "@/lib/utils/wind-quality";
import { degreesToCardinal } from "@/lib/utils/geo-utils";

interface WindForecastChartProps {
  wind: OpenMeteoWindPoint[];
  offshoreDeg: number | null;
  toleranceDeg: number | null;
}

interface ChartPoint {
  ts: number; // epoch ms for Recharts numeric axis
  speed: number;
  gust: number;
  directionDeg: number | null;
  label: string; // quality label for tooltip
  qualityColor: string; // for tooltip badge
}

function formatHour(date: Date): string {
  const h = date.getHours();
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function WindForecastChart({
  wind,
  offshoreDeg,
  toleranceDeg,
}: WindForecastChartProps) {
  const gradId = React.useId().replace(/:/g, "");

  const chartData: ChartPoint[] = React.useMemo(() => {
    return wind.slice(0, 24).map((pt) => {
      const speed = pt.wind_speed_mph ?? 0;
      const gust = pt.wind_gust_mph ?? 0;
      let label = "";
      let qualityColor = "#7A8CC0";

      if (
        pt.wind_direction_deg != null &&
        offshoreDeg != null &&
        toleranceDeg != null
      ) {
        const q = classifyWindQuality(
          pt.wind_direction_deg,
          offshoreDeg,
          toleranceDeg
        );
        label = q.label;
        qualityColor =
          q.color === "green"
            ? "#4ade80"
            : q.color === "yellow"
              ? "#facc15"
              : "#f87171";
      }

      return {
        ts: new Date(pt.ts).getTime(),
        speed,
        gust,
        directionDeg: pt.wind_direction_deg,
        label,
        qualityColor,
      };
    });
  }, [wind, offshoreDeg, toleranceDeg]);

  const nowTs = React.useMemo(() => Date.now(), []);

  const [minTs, maxTs] = React.useMemo(() => {
    if (!chartData.length) return [0, 0];
    return [chartData[0].ts, chartData[chartData.length - 1].ts];
  }, [chartData]);

  const timeTicks = React.useMemo(() => {
    const ticks: number[] = [];
    if (!chartData.length) return ticks;
    const start = new Date(chartData[0].ts);
    // Round up to next hour divisible by 3
    const startHour = start.getHours();
    const nextTick = new Date(start);
    nextTick.setMinutes(0, 0, 0);
    const remainder = startHour % 3;
    if (remainder !== 0) {
      nextTick.setHours(startHour + (3 - remainder));
    }
    while (nextTick.getTime() <= maxTs) {
      ticks.push(nextTick.getTime());
      nextTick.setHours(nextTick.getHours() + 3);
    }
    return ticks;
  }, [chartData, maxTs]);

  const yMax = React.useMemo(() => {
    if (!chartData.length) return 20;
    const maxGust = Math.max(...chartData.map((d) => d.gust));
    const maxSpeed = Math.max(...chartData.map((d) => d.speed));
    const peak = Math.max(maxGust, maxSpeed);
    // Round up to next 5
    return Math.ceil((peak + 2) / 5) * 5;
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-sm text-[#7A8CC0]">
        No wind data available
      </div>
    );
  }

  return (
    <div className="h-48 w-full" role="img" aria-label="24-hour wind forecast chart showing wind speed and gusts over time">
      <ResponsiveContainer>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
        >
          <defs>
            <linearGradient
              id={`wind-fill-${gradId}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#4A70D9" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4A70D9" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="#404C92"
            strokeDasharray="0"
            strokeOpacity={0.3}
          />

          <XAxis
            dataKey="ts"
            type="number"
            domain={[minTs, maxTs]}
            ticks={timeTicks}
            tickFormatter={(v) => formatHour(new Date(v))}
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fontSize: 11, fill: "#7A8CC0", fontFamily: "var(--font-space-mono, monospace)" }}
            height={24}
          />

          <YAxis
            domain={[0, yMax]}
            axisLine={false}
            tickLine={false}
            width={32}
            tick={{ fontSize: 11, fill: "#7A8CC0", fontFamily: "var(--font-space-mono, monospace)" }}
            tickFormatter={(v) => `${v}`}
            unit=" mph"
          />

          {/* Gust line — dashed, behind speed area */}
          <Area
            type="monotone"
            dataKey="gust"
            stroke="#8AB5FF"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="none"
            isAnimationActive={false}
            connectNulls
          />

          {/* Speed area — solid fill */}
          <Area
            type="monotone"
            dataKey="speed"
            stroke="#8AB5FF"
            strokeWidth={2}
            fill={`url(#wind-fill-${gradId})`}
            isAnimationActive={false}
            connectNulls
          />

          {/* Now line */}
          {nowTs >= minTs && nowTs <= maxTs && (
            <ReferenceLine
              x={nowTs}
              stroke="#dc2626"
              strokeWidth={2}
              label={{
                value: "Now",
                position: "top",
                fill: "#dc2626",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}

          <Tooltip
            content={<WindTooltip offshoreDeg={offshoreDeg} toleranceDeg={toleranceDeg} />}
            cursor={{ stroke: "#606DA8", strokeDasharray: "2 2" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Custom Tooltip ───────────────────────────────────────────── */

function WindTooltip({
  active,
  payload,
  offshoreDeg,
  toleranceDeg,
}: {
  active?: boolean;
  payload?: any;
  offshoreDeg: number | null;
  toleranceDeg: number | null;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as ChartPoint;
  const time = new Date(pt.ts);
  const timeStr = time.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const cardinal =
    pt.directionDeg != null ? degreesToCardinal(pt.directionDeg) : "—";

  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-md backdrop-blur"
      style={{
        background: "rgba(26,33,88,0.95)",
        borderColor: "rgba(64,76,146,0.6)",
      }}
    >
      <div className="font-mono text-[10px] text-[#7A8CC0]">{timeStr}</div>
      <div className="mt-0.5 text-sm font-semibold text-[#E8ECF4]">
        {Math.round(pt.speed)} mph
        {pt.gust > pt.speed && (
          <span className="ml-1 text-xs font-normal text-[#8AB5FF]">
            gusts {Math.round(pt.gust)}
          </span>
        )}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-[#7A8CC0]">
        From {cardinal} ({pt.directionDeg ?? "?"}°)
      </div>
      {pt.label && (
        <div
          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: `${pt.qualityColor}20`,
            color: pt.qualityColor,
          }}
        >
          {pt.label}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver && yarn typecheck`
Expected: No errors related to `wind-forecast-chart.tsx`

---

### Task 2: Wire WindForecastChart into WindCheckerClient

**Files:**
- Modify: `components/tools/wind-checker-client.tsx`

- [ ] **Step 1: Add import for new chart component**

At the top of `wind-checker-client.tsx`, add the import (after the existing imports around line 17):

```ts
import { WindForecastChart } from "@/components/tools/wind-forecast-chart";
```

Remove the now-unused `classifyWindQuality` import from line 11 (it's only used by the old `WindTimeline`), BUT first check — it's also used at line 75 for `offshoreQuality`. So keep it.

Remove `degreesToCardinal` import from line 12 only if it's not used elsewhere in the file. Check: it's used at line 69 for `windCardinal`. So keep it.

- [ ] **Step 2: Replace WindTimeline usage with WindForecastChart**

In `wind-checker-client.tsx`, replace the `WindTimeline` invocation at lines 340-346:

```tsx
// OLD (remove):
            {data.wind.length > 1 && (
              <WindTimeline
                wind={data.wind}
                offshoreDeg={beach.wind_offshore_deg}
                toleranceDeg={beach.wind_offshore_tol_deg}
              />
            )}
```

```tsx
// NEW (replace with):
            {data.wind.length > 1 && (
              <div
                className="noise-texture rounded-2xl border p-5"
                style={{
                  background: "linear-gradient(135deg, rgba(37,45,107,0.9) 0%, rgba(26,33,88,0.95) 100%)",
                  borderColor: "rgba(64,76,146,0.4)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#7A8CC0]">
                    24-Hour Wind Forecast
                  </h3>
                  {bestWindows.length > 0 && beach.wind_offshore_deg != null && (
                    <span className="font-mono text-xs font-semibold" style={{ color: "#4ade80" }}>
                      Best: {bestWindows.join(", ")}
                    </span>
                  )}
                </div>
                <WindForecastChart
                  wind={data.wind}
                  offshoreDeg={beach.wind_offshore_deg}
                  toleranceDeg={beach.wind_offshore_tol_deg}
                />
              </div>
            )}
```

NOTE: The card wrapper + header + "Best:" annotation that were previously inside `WindTimeline` are now inline in the parent — this keeps the chart component focused on just the chart. The `bestWindows` variable is already computed in the parent component (around line 104-128 — we need to move this computation out of the old `WindTimeline` and into the parent).

**Wait** — actually `bestWindows` is currently computed INSIDE the old `WindTimeline` (lines 420-443). We need to move that computation into the parent `WindCheckerClient`, right before the JSX that uses it.

- [ ] **Step 3: Move bestWindows computation to parent**

Add the `bestWindows` computation in `WindCheckerClient`, after the `offshoreQuality` variable (around line 80), before the JSX return. This replaces the logic that was inside `WindTimeline`:

```ts
  const bestWindows = React.useMemo(() => {
    if (!data?.wind?.length || !beach?.wind_offshore_deg || !beach?.wind_offshore_tol_deg) return [];
    const hours = data.wind.slice(0, 24);
    const windows: string[] = [];
    let inGoodWindow = false;
    let windowStart = "";
    const fmtHour = (ts: string) => {
      const h = new Date(ts).getUTCHours();
      if (h === 0) return "12a";
      if (h === 12) return "12p";
      return h < 12 ? `${h}a` : `${h - 12}p`;
    };
    for (let i = 0; i < hours.length; i++) {
      const h = hours[i];
      const isGood =
        h.wind_direction_deg != null &&
        h.wind_speed_mph != null &&
        classifyWindQuality(h.wind_direction_deg, beach.wind_offshore_deg, beach.wind_offshore_tol_deg).color === "green";
      if (isGood && !inGoodWindow) {
        inGoodWindow = true;
        windowStart = fmtHour(h.ts);
      } else if (!isGood && inGoodWindow) {
        inGoodWindow = false;
        windows.push(`${windowStart}\u2013${fmtHour(hours[i].ts)}`);
        if (windows.length >= 2) break;
      }
    }
    if (inGoodWindow && hours.length > 0) {
      windows.push(`${windowStart}\u2013${fmtHour(hours[hours.length - 1].ts)}`);
    }
    return windows;
  }, [data?.wind, beach?.wind_offshore_deg, beach?.wind_offshore_tol_deg]);
```

Add `import { useMemo } from "react"` — actually `React` isn't imported as a namespace here. Update the existing import on line 2:

```ts
import { useState, useCallback, useTransition, useMemo } from "react";
```

Then change `React.useMemo` to `useMemo` above.

- [ ] **Step 4: Delete the old WindTimeline component**

Remove the entire `WindTimeline` component and its `WindTimelineProps` interface (lines 395-498 in the current file).

- [ ] **Step 5: Verify everything compiles**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver && yarn typecheck`
Expected: PASS, no errors

- [ ] **Step 6: Verify lint passes**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver && yarn lint`
Expected: PASS

- [ ] **Step 7: Manual verification**

1. Run `yarn dev`
2. Navigate to `localhost:3000/tools/wind-checker`
3. Click "La Jolla Shores" popular beach
4. Verify: Chart renders with blue area fill, gust dashed line, time labels, "Now" marker
5. Hover over chart — tooltip shows speed, gust, direction, quality badge
6. Verify "Best:" annotation still shows in header (if beach has orientation data)
7. Check mobile width — chart should be responsive

- [ ] **Step 8: Commit**

```bash
git add components/tools/wind-forecast-chart.tsx components/tools/wind-checker-client.tsx
git commit -m "feat(tools): replace broken wind timeline with Recharts area chart

The custom CSS bar chart rendered empty bars. New chart uses Recharts
AreaChart matching the tide chart's visual quality — shows wind speed
area, gust dashed line, now marker, and quality-aware tooltip."
```
