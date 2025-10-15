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

// --- Helpers ---------------------------------------------------------------

type InternalPoint = TidePoint & { timestamp: number };

const toDate = (t: TidePoint["t"]) => (t instanceof Date ? t : new Date(t));

const defaultDayFmt = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short" });

const metersToFeet = (m?: number | null) =>
  typeof m === "number" && Number.isFinite(m) ? m * 3.28084 : undefined;

const parseHeight = (value?: string | null) => {
  if (!value) return undefined;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match ? Number.parseFloat(match[0]) : undefined;
};

const parseForecastDateTime = (
  dateStr: string,
  timeStr: string
): Date | undefined => {
  const trimmedTime = (timeStr ?? "").trim();
  if (!dateStr) return undefined;
  const datePart = dateStr.includes("T")
    ? dateStr.split("T")[0]?.trim() ?? dateStr.trim()
    : dateStr.trim();

  const candidates: string[] = [];

  if (trimmedTime) {
    const timeUpper = trimmedTime.toUpperCase();

    if (/^\d{1,2}:\d{2}$/.test(trimmedTime)) {
      candidates.push(`${datePart}T${trimmedTime.padStart(5, "0")}:00`);
    } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmedTime)) {
      candidates.push(`${datePart}T${trimmedTime}`);
    } else if (/^\d{1,2}:\d{2}\s?[AP]M$/.test(timeUpper)) {
      const [hh, mm] = timeUpper.replace(/\s+/g, "").split(/[:APM]/);
      let hours = Number.parseInt(hh ?? "0", 10) % 12;
      if (timeUpper.includes("PM")) hours += 12;
      candidates.push(
        `${datePart}T${hours.toString().padStart(2, "0")}:${mm ?? "00"}:00`
      );
    } else if (/^\d{1,2}\s?[AP]M$/.test(timeUpper)) {
      const match = /^\d{1,2}/.exec(timeUpper);
      let hours = Number.parseInt(match?.[0] ?? "0", 10) % 12;
      if (timeUpper.includes("PM")) hours += 12;
      candidates.push(`${datePart}T${hours.toString().padStart(2, "0")}:00:00`);
    }

    candidates.push(`${datePart}T${trimmedTime}`);
    candidates.push(`${datePart} ${trimmedTime}`);
  }

  candidates.push(`${dateStr}T${trimmedTime}`);
  candidates.push(`${dateStr} ${trimmedTime}`);

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (!/^\d{1,2}$/.test(trimmedTime)) {
    const fallback = new Date(trimmedTime);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  return undefined;
};

const normalizeDirectData = (
  points?: TideChartProps["data"]
): InternalPoint[] => {
  if (!Array.isArray(points)) return [];
  return points
    .map((p) => {
      if (!p) return undefined;
      const dateValue = toDate((p as TidePoint).t ?? (p as any).time);
      if (Number.isNaN(dateValue.getTime())) return undefined;
      const height = (p as TidePoint).h ?? (p as any).height;
      if (!Number.isFinite(height)) return undefined;
      const legacyType = (p as any)?.type as string | undefined;
      const normalized: InternalPoint = {
        t: dateValue,
        h: Number(height),
        isHigh:
          (p as TidePoint).isHigh ??
          (typeof legacyType === "string" &&
            legacyType.toLowerCase() === "high"),
        isLow:
          (p as TidePoint).isLow ??
          (typeof legacyType === "string" &&
            legacyType.toLowerCase() === "low"),
        timestamp: dateValue.getTime(),
      };
      return normalized;
    })
    .filter(Boolean) as InternalPoint[];
};

const normalizeHourly = (
  hourly?: TideChartProps["hourly"]
): InternalPoint[] => {
  if (!Array.isArray(hourly)) return [];
  return hourly
    .map((h) => {
      if (!h || !h.ts) return undefined;
      const ts = new Date(h.ts);
      if (Number.isNaN(ts.getTime())) return undefined;
      const heightFt = h.height_ft ?? metersToFeet(h.height_m ?? undefined);
      if (!Number.isFinite(heightFt)) return undefined;
      return {
        t: ts,
        h: Number(heightFt),
        timestamp: ts.getTime(),
      } satisfies InternalPoint;
    })
    .filter(Boolean) as InternalPoint[];
};

const normalizeEvents = (
  events?: TideChartProps["events"]
): InternalPoint[] => {
  if (!Array.isArray(events)) return [];
  return events
    .map((event) => {
      if (!event || !event.ts) return undefined;
      const ts = new Date(event.ts);
      if (Number.isNaN(ts.getTime())) return undefined;
      const heightFt =
        event.height_ft ?? metersToFeet(event.height_m ?? undefined);
      if (!Number.isFinite(heightFt)) return undefined;
      const isHigh = event.type === "HIGH";
      return {
        t: ts,
        h: Number(heightFt),
        isHigh,
        isLow: !isHigh,
        timestamp: ts.getTime(),
      } satisfies InternalPoint;
    })
    .filter(Boolean) as InternalPoint[];
};

const normalizeForecasts = (
  forecasts?: EnhancedForecastEntity[]
): InternalPoint[] => {
  if (!Array.isArray(forecasts)) return [];
  return forecasts
    .map((forecast) => {
      if (!forecast?.forecast_date || !forecast.forecast_time) return undefined;
      const date =
        parseForecastDateTime(forecast.forecast_date, forecast.forecast_time) ??
        new Date(`${forecast.forecast_date}T${forecast.forecast_time}`);
      if (Number.isNaN(date.getTime())) return undefined;
      const heightFt =
        parseHeight(forecast.tide_height) ??
        parseHeight(forecast.next_tide_height);
      if (!Number.isFinite(heightFt)) return undefined;
      const type = forecast.tide_status ?? forecast.next_tide_type ?? "";
      const isHigh = typeof type === "string" && /high/i.test(type);
      const isLow = typeof type === "string" && /low/i.test(type);
      return {
        t: date,
        h: Number(heightFt),
        isHigh,
        isLow,
        timestamp: date.getTime(),
      } satisfies InternalPoint;
    })
    .filter(Boolean) as InternalPoint[];
};

const sortAndUnique = (points: InternalPoint[]): InternalPoint[] => {
  const byTs = new Map<number, InternalPoint>();
  for (const point of points) {
    if (!point) continue;
    const existing = byTs.get(point.timestamp);
    if (!existing) {
      byTs.set(point.timestamp, point);
    } else {
      byTs.set(point.timestamp, {
        ...existing,
        ...point,
        isHigh: existing.isHigh || point.isHigh,
        isLow: existing.isLow || point.isLow,
      });
    }
  }
  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
};

const synthesizeFromExtrema = (extrema: InternalPoint[]): InternalPoint[] => {
  if (extrema.length < 2) return extrema;
  const sorted = sortAndUnique(extrema);
  const result: InternalPoint[] = [];
  const step = 60 * 60 * 1000; // 1 hour granularity for smoothing

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const dt = next.timestamp - current.timestamp;
    if (dt <= 0) continue;
    for (let t = current.timestamp; t < next.timestamp; t += step) {
      const u = (t - current.timestamp) / dt;
      const h =
        current.h + ((next.h - current.h) * (1 - Math.cos(Math.PI * u))) / 2;
      result.push({
        t,
        h,
        timestamp: t,
        isHigh: u === 0 ? current.isHigh : undefined,
        isLow: u === 0 ? current.isLow : undefined,
      });
    }
  }
  // include final point explicitly
  result.push(sorted[sorted.length - 1]);
  return sortAndUnique(result);
};

const annotateWithExtrema = (
  data: InternalPoint[],
  extrema: InternalPoint[]
): InternalPoint[] => {
  if (!extrema.length || !data.length) return data;

  const emphasisLookup = new Map<
    number,
    { isHigh?: boolean; isLow?: boolean }
  >();
  extrema.forEach((point) => {
    emphasisLookup.set(point.timestamp, {
      isHigh: point.isHigh,
      isLow: point.isLow,
    });
  });

  return data.map((point) => {
    const emphasis = emphasisLookup.get(point.timestamp);
    if (!emphasis) return point;
    return { ...point, ...emphasis };
  });
};

// Gradient id must be stable per instance
const useGradientId = () => React.useId().replace(/:/g, "");

// Tooltip
const TideTooltip: React.FC<{
  active?: boolean;
  payload?: any;
  label?: any;
  unit: string;
}> = ({ active, payload, unit }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as TidePoint & { t: any };
  const d = toDate(p.t);
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-3 py-2 shadow-md">
      <div className="text-[11px] text-slate-500">
        {day} • {time}
      </div>
      <div className="text-sm font-semibold text-slate-900">
        {p.h.toFixed(1)} {unit}
      </div>
      {p.isHigh && (
        <div className="text-[11px] text-emerald-600">High tide</div>
      )}
      {p.isLow && <div className="text-[11px] text-rose-600">Low tide</div>}
    </div>
  );
};

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

  const rawLine = React.useMemo(() => {
    if (directData.length) return directData;
    if (hourlyData.length) return hourlyData;
    if (eventData.length) return synthesizeFromExtrema(eventData);
    if (forecastData.length) return forecastData;
    return [] as InternalPoint[];
  }, [directData, hourlyData, eventData, forecastData]);

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
    // For 18-hour window, show ticks every 3 hours
    return generateTicks(windowBounds, 3);
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

  // Debug logging for tide chart data
  React.useEffect(() => {
    console.log("🌊 TideChart Debug - Window Bounds:");
    console.log("  Window Start:", new Date(windowBounds.windowStart).toLocaleString(), windowBounds.windowStart);
    console.log("  Window End:", new Date(windowBounds.windowEnd).toLocaleString(), windowBounds.windowEnd);
    console.log("  Buffer Start:", new Date(windowBounds.bufferStart).toLocaleString(), windowBounds.bufferStart);
    console.log("  Buffer End:", new Date(windowBounds.bufferEnd).toLocaleString(), windowBounds.bufferEnd);
    
    console.log("\n🌊 First 10 Raw Data Points:");
    rawLine.slice(0, 10).forEach((d, i) => {
      const inWindow = d.timestamp >= windowBounds.bufferStart && d.timestamp <= windowBounds.bufferEnd;
      console.log(`  [${i}] ${new Date(d.timestamp).toLocaleString()} (${d.timestamp}) - ${d.h} ft - ${inWindow ? '✅ IN WINDOW' : '❌ OUTSIDE'}`);
    });
    
    console.log("\n🌊 Summary:");
    console.log("  Input forecasts:", forecasts?.length || 0);
    console.log("  Raw line points:", rawLine.length);
    console.log("  Chart data points:", chartData.length);
    console.log("  Chart data times:", chartData.map((d) => new Date(d.t).toLocaleString()));
  }, [
    forecasts,
    rawLine.length,
    emphasizedLine.length,
    chartData,
    windowBounds,
  ]);

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
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />

            {/** Top axis: days */}
            <XAxis
              dataKey={(p: TidePoint) => +toDate(p.t)}
              type="number"
              domain={[minTs, maxTs]}
              tickFormatter={(v) => dayFormatter(new Date(v))}
              ticks={days.map((d) => +d)}
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={{ fontSize: 12, fill: "#64748b" }}
              height={22}
              orientation="top"
            />

            {/** Bottom axis: time (every 3 hours) */}
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
              tick={{ fontSize: 12, fill: "#64748b" }}
              height={28}
              orientation="bottom"
            />

            <YAxis
              domain={computedYDomain}
              axisLine={false}
              tickLine={false}
              width={36}
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickFormatter={(v) => v.toFixed(0)}
            />

            <Area
              xAxisId="time"
              type="monotone"
              dataKey="h"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill={`url(#fill-${gradId})`}
              isAnimationActive={animationEnabled}
              connectNulls={true}
            />

            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />

            {showNowLine && (
              <ReferenceLine
                xAxisId="time"
                x={windowBounds.nowTs}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value:
                    nowHeight !== null
                      ? `Now • ${nowHeight.toFixed(1)} ${unit}`
                      : "Now",
                  position: "top",
                  fill: "#ef4444",
                  fontSize: 11,
                  fontWeight: 500,
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
        <div className="mt-3 flex gap-3 text-xs text-slate-600">
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
            Tide height
          </div>
          {showNowLine && (
            <div className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Current time
            </div>
          )}
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
            Sea level (0)
          </div>
        </div>
      )}
    </div>
  );
}

// --- Example usage (remove in prod)
export function Example() {
  const start = new Date();
  start.setHours(start.getHours() - 6); // Start 6 hours ago
  const pts: TidePoint[] = [];
  for (let i = 0; i < 8; i++) {
    // 8 points over ~21 hours
    const d = new Date(start.getTime() + i * 2.5 * 60 * 60 * 1000);
    const wave =
      Math.sin((i / 3) * Math.PI) * 2.2 + 2.0 + (Math.random() - 0.5) * 0.2;
    pts.push({
      t: d.toISOString(),
      h: Number(wave.toFixed(2)),
      isHigh: i % 4 === 1,
      isLow: i % 4 === 3,
    });
  }
  return (
    <TideChart data={pts} now={new Date()} windowHours={18} nowBias={1 / 3} />
  );
}
