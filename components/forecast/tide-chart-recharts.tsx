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
import { cn } from "@/lib/utils";
import { interpolateTideHeight } from "@/lib/utils/tide-interpolation";
import {
  calculateTideWindow,
  filterToWindow,
  generateTicks,
  formatWindowDuration,
} from "@/lib/utils/tide-window";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  type InternalPoint,
  toDate,
  defaultDayFmt,
  normalizeDirectData,
  normalizeHourly,
  normalizeEvents,
  normalizeTideSchedule as normalizeTideScheduleInternal,
  normalizeForecasts,
  sortAndUnique,
  isExtremaOnly,
  synthesizeFromExtrema,
  annotateWithExtrema,
} from "./tide-chart/tide-chart-helpers";
import { TideTooltip } from "./tide-chart/TideTooltip";

// Public types for the chart API
export type TidePoint = {
  /** JS date or ISO string */
  t: string | number | Date;
  /** tide height in feet */
  h: number;
  /** optional flags */
  isHigh?: boolean;
  isLow?: boolean;
};

export type TideChartProps = {
  /** direct data points for the line */
  data?: TidePoint[];
  /** legacy inputs kept for backwards compatibility */
  forecasts?: EnhancedForecastEntity[];
  hourly?: {
    ts: string;
    height_m?: number | null;
    height_ft?: number | null;
  }[];
  events?: {
    ts: string;
    type: "HIGH" | "LOW";
    height_m?: number | null;
    height_ft?: number | null;
  }[];
  /** label shown above x-axis ticks, e.g. Mon/Tue or Today/Tomorrow */
  dayFormatter?: (d: Date) => string;
  /** shows a dashed vertical "now" line if within the range */
  now?: Date;
  /** y-axis nice domain, default auto */
  yDomain?: [number, number] | "auto";
  /** unit label for tooltip */
  unit?: string; // default "ft"
  /** compact mode removes outer card styling */
  compact?: boolean;
  /** optional className for wrapper */
  className?: string;
  /** legacy flag retained for compatibility */
  showNowLine?: boolean;
  /** legacy flag retained for compatibility */
  isAnimationActive?: boolean;
  /** visible window hours (default: 18) */
  windowHours?: number;
  /** position of "now" marker (0=left, 1=right, default: 0.5 for centered) */
  nowBias?: number;
  /** buffer hours on each edge (default: 1) */
  bufferHours?: number;
};

// --- Backward Compatibility Re-export -------------------------------------

/**
 * Re-export normalizeTideSchedule for backward compatibility
 * External code imports this from tide-chart-recharts.tsx
 */
export const normalizeTideSchedule = normalizeTideScheduleInternal;

// Gradient id must be stable per instance
const useGradientId = () => React.useId().replace(/:/g, "");

export function TideChart({
  data,
  forecasts,
  hourly,
  events,
  dayFormatter = defaultDayFmt,
  now,
  yDomain = "auto",
  unit = "ft",
  compact,
  className,
  showNowLine = true,
  isAnimationActive,
  windowHours = 18,
  nowBias = 0.5,
  bufferHours = 1,
}: TideChartProps) {
  const gradId = useGradientId();
  const animationEnabled =
    typeof isAnimationActive === "boolean"
      ? isAnimationActive
      : process.env.NODE_ENV !== "production";

  const [isCompactViewport, setIsCompactViewport] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 480px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompactViewport(event.matches);
    };

    handleChange(query);
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handleChange);
      return () => query.removeEventListener("change", handleChange);
    } else {
      query.addListener(handleChange);
      return () => query.removeListener(handleChange);
    }
  }, []);

  // Calculate window bounds using utility
  const windowBounds = React.useMemo(
    () =>
      calculateTideWindow({
        windowHours,
        nowBias,
        bufferHours,
        now: now ?? new Date(),
      }),
    [windowHours, nowBias, bufferHours, now]
  );

  const directData = React.useMemo(() => normalizeDirectData(data), [data]);
  const hourlyData = React.useMemo(() => normalizeHourly(hourly), [hourly]);
  const eventData = React.useMemo(() => normalizeEvents(events), [events]);
  const forecastData = React.useMemo(
    () => normalizeForecasts(forecasts),
    [forecasts]
  );
  const tideScheduleData = React.useMemo(
    () => normalizeTideSchedule(forecasts),
    [forecasts]
  );

  const rawLine = React.useMemo(() => {
    // Priority: direct data > tide_schedule > hourly > events > forecasts
    if (directData.length) {
      return isExtremaOnly(directData)
        ? synthesizeFromExtrema(directData)
        : directData;
    }
    if (tideScheduleData.length) return synthesizeFromExtrema(tideScheduleData);
    if (hourlyData.length) return hourlyData;
    if (eventData.length) return synthesizeFromExtrema(eventData);
    if (forecastData.length) return forecastData;
    return [] as InternalPoint[];
  }, [directData, tideScheduleData, hourlyData, eventData, forecastData]);

  const emphasizedLine = React.useMemo(() => {
    if (!rawLine.length) return rawLine;
    if (eventData.length) return annotateWithExtrema(rawLine, eventData);
    if (forecastData.length)
      return annotateWithExtrema(
        rawLine,
        forecastData.filter((p) => p.isHigh || p.isLow)
      );
    return rawLine;
  }, [rawLine, eventData, forecastData]);

  // Filter to window with buffer
  const chartData = React.useMemo(() => {
    const sorted = sortAndUnique(emphasizedLine);
    const filtered = filterToWindow(
      sorted.map((p) => ({ ...p, time: p.timestamp })),
      windowBounds,
      true // include buffer
    );
    return filtered.map((point) => ({
      t: new Date(point.timestamp),
      h: point.h,
      isHigh: point.isHigh,
      isLow: point.isLow,
    }));
  }, [emphasizedLine, windowBounds]);

  // Interpolate tide height at "now"
  const nowHeight = React.useMemo(() => {
    if (!chartData.length) return null;
    return interpolateTideHeight(
      chartData.map((p) => ({ time: p.t, height: p.h })),
      windowBounds.nowTs
    );
  }, [chartData, windowBounds.nowTs]);

  const [minTs, maxTs] = React.useMemo(() => {
    return [windowBounds.windowStart, windowBounds.windowEnd] as [
      number,
      number
    ];
  }, [windowBounds]);

  const days = React.useMemo(() => {
    const map = new Map<string, Date>();
    const startDate = new Date(minTs);
    const endDate = new Date(maxTs);
    let currentDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );

    while (currentDate <= endDate) {
      const key = currentDate.toDateString();
      if (!map.has(key)) {
        map.set(key, new Date(currentDate));
      }
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
    return Array.from(map.values());
  }, [minTs, maxTs]);

  const baseTimeTicks = React.useMemo(() => {
    const totalHours =
      (windowBounds.windowEnd - windowBounds.windowStart) / (60 * 60 * 1000);
    let intervalHours = 3; // default for today
    if (totalHours > 120) intervalHours = 12; // 7-day: every 12 hours
    else if (totalHours > 48) intervalHours = 6; // 3-day: every 6 hours
    return generateTicks(windowBounds, intervalHours);
  }, [windowBounds]);

  const timeTicks = React.useMemo(() => {
    if (!baseTimeTicks.length) return baseTimeTicks;
    if (!isCompactViewport) return baseTimeTicks;
    const uniqueTicks = Array.from(new Set(baseTimeTicks));
    if (uniqueTicks.length <= 3) return uniqueTicks;
    const first = uniqueTicks[0];
    const last = uniqueTicks[uniqueTicks.length - 1];
    if (first === last) return [first];
    const middle = uniqueTicks[Math.round((uniqueTicks.length - 1) / 2)];
    return [first, middle, last].filter(
      (tick, index, arr) => arr.indexOf(tick) === index
    );
  }, [baseTimeTicks, isCompactViewport]);

  const computedYDomain: [number, number] = React.useMemo(() => {
    if (yDomain !== "auto") return yDomain;
    if (!chartData.length) return [0, 1];
    const vals = chartData.map((d) => d.h);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max(0.5, (max - min) * 0.15);
    const low = Math.floor((min - pad) * 2) / 2;
    const high = Math.ceil((max + pad) * 2) / 2;
    return [low, high];
  }, [yDomain, chartData]);

  const windowDurationLabel = React.useMemo(
    () => formatWindowDuration(windowBounds),
    [windowBounds]
  );

  if (!chartData.length) {
    return (
      <div
        className={cn(
          compact ? "" : "rounded-3xl border bg-white p-4 shadow-sm",
          className
        )}
      >
        {!compact && (
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-lg font-semibold tracking-tight">
              Tide Forecast
            </h3>
            <span className="text-xs text-slate-500">Heights in {unit}</span>
          </div>
        )}
        <div className="flex h-48 w-full items-center justify-center text-sm text-slate-500">
          No tide data available
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact ? "" : "rounded-3xl border bg-white p-4 shadow-sm",
        className
      )}
    >
      {!compact && (
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-lg font-semibold tracking-tight">
            {windowDurationLabel} Tide Forecast
          </h3>
          <span className="text-xs text-slate-500">Heights in {unit}</span>
        </div>
      )}

      <div
        role="img"
        aria-label={`${windowDurationLabel} tide forecast showing high and low tide heights over time`}
        className="h-64 w-full"
      >
        <ResponsiveContainer>
          <AreaChart
            data={chartData}
            margin={{ top: 24, right: 12, bottom: 24, left: 12 }}
          >
            <defs>
              <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e40af" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1e40af" stopOpacity={0.06} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="#e2e8f0"
              strokeDasharray="0"
              strokeOpacity={0.5}
            />

            {/** Top axis: day labels (non-default, tooltip ignores) */}
            <XAxis
              xAxisId="days"
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

            {/** Bottom axis: time (default — tooltip tracks this axis) */}
            <XAxis
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

            <Area
              type="monotone"
              dataKey="h"
              stroke="#1e40af"
              strokeWidth={3}
              fill={`url(#fill-${gradId})`}
              isAnimationActive={animationEnabled}
              connectNulls={true}
            />

            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />

            {showNowLine && (
              <ReferenceLine
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

            <Tooltip
              content={<TideTooltip unit={unit} />}
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "2 2" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

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
    </div>
  );
}

