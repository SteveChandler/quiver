"use client";

import React, { useMemo, useEffect } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  TideTooltipContent,
  getTideChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedForecastEntity } from "@/types/forecast";

// Tide data structure
export interface TideDataPoint {
  time: Date;
  height: number;
  type: "high" | "low";
}

interface TideEvent {
  time: Date;
  height: number;
  type: "high" | "low";
  day: string;
  dayLabel: string;
}

interface TideChartProps {
  data?: TideDataPoint[];
  forecasts?: EnhancedForecastEntity[];
  hourly?: { ts: string; height_m?: number; height_ft?: number }[];
  events?: {
    ts: string;
    type: "HIGH" | "LOW";
    height_m?: number;
    height_ft?: number;
  }[];
  className?: string;
  showNowLine?: boolean;
  isAnimationActive?: boolean;
}

// Helper functions for data extraction (from old component)
function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayLabel(dateString: string): string {
  const today = getNormalizedDateString(new Date());
  const tomorrow = getNormalizedDateString(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  );

  if (dateString === today) return "Today";
  if (dateString === tomorrow) return "Tomorrow";

  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function parseTideHeight(tideHeight: string | null): number {
  if (!tideHeight) return 0;
  const cleanHeight = tideHeight.replace(/ft|'|"/g, "").trim();
  return parseFloat(cleanHeight) || 0;
}

// Extract tide events from forecast data
function extractTideEvents(forecasts: EnhancedForecastEntity[]): TideEvent[] {
  const tideEvents: TideEvent[] = [];
  const seenTides = new Set<string>();

  forecasts.forEach((forecast) => {
    if (
      !forecast.next_tide_time ||
      !forecast.next_tide_type ||
      forecast.next_tide_time === "Unknown"
    ) {
      return;
    }

    const forecastDate = new Date(
      forecast.forecast_date + "T" + forecast.forecast_time
    );
    let tideTime: Date;

    // Handle different time formats
    if (forecast.next_tide_time.includes(":")) {
      const timeString = forecast.next_tide_time;
      const datePart = forecast.forecast_date.includes("T")
        ? forecast.forecast_date.split("T")[0]
        : forecast.forecast_date;

      if (/^\d{1,2}:\d{2}$/.test(timeString)) {
        tideTime = new Date(`${datePart}T${timeString.padStart(5, "0")}:00`);
      } else {
        tideTime = new Date(`${datePart} ${timeString}`);
      }
    } else {
      return;
    }

    if (isNaN(tideTime.getTime())) {
      return;
    }

    const height = parseTideHeight(forecast.next_tide_height);
    const type = forecast.next_tide_type.toLowerCase().includes("high")
      ? "high"
      : "low";
    const tideKey = `${tideTime.getTime()}-${type}`;

    if (!seenTides.has(tideKey)) {
      seenTides.add(tideKey);

      const dayString = getNormalizedDateString(tideTime);
      tideEvents.push({
        time: tideTime,
        height,
        type,
        day: dayString,
        dayLabel: getDayLabel(dayString),
      });
    }
  });

  return tideEvents.sort((a, b) => a.time.getTime() - b.time.getTime());
}

// Custom label component for tide markers
const TideLabel = (props: any) => {
  const { payload, x, y, value } = props;
  if (!payload || value === undefined) return null;

  const isHigh = payload.type === "high";
  const labelY = isHigh ? y - 15 : y + 20; // Above for high, below for low

  return (
    <text
      x={x}
      y={labelY}
      textAnchor="middle"
      className="fill-gray-700 text-xs font-medium"
      dominantBaseline={isHigh ? "auto" : "hanging"}
    >
      {Math.abs(value).toFixed(1)}ft
    </text>
  );
};

export function TideChart({
  data,
  forecasts,
  hourly,
  events,
  className,
  showNowLine = true,
  isAnimationActive = process.env.NODE_ENV !== "production",
}: TideChartProps) {
  const chartConfig = getTideChartConfig();

  // Helpers per requirements
  const toFt = (m?: number, ft?: number) =>
    Number.isFinite(ft as number)
      ? (ft as number)
      : ((m ?? NaN) as number) * 3.28084;

  // Cosine-easing fallback between extrema
  const synthesizeFromExtrema = (ext: { t: number; h: number }[]) => {
    const pts = [...ext]
      .filter((p) => Number.isFinite(p.h))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) return pts;
    const out: { t: number; h: number }[] = [];
    const step = 60 * 60 * 1000; // 1h
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dt = b.t - a.t;
      if (!(dt > 0)) {
        // skip zero/negative intervals to avoid NaN
        if (out.length === 0) out.push({ t: a.t, h: a.h });
        continue;
      }
      for (let t = a.t; t <= b.t; t += step) {
        const u = (t - a.t) / dt;
        const h = a.h + ((b.h - a.h) * (1 - Math.cos(Math.PI * u))) / 2;
        out.push({ t, h });
      }
    }
    return out.length ? out : pts;
  };

  // Process and normalize to shared shapes: line[{t,h}], extrema[{t,h,type}]
  const normalized = useMemo(() => {
    // Derive extrema from priority: events → data → forecasts
    let extrema: { t: number; h: number; type: "HIGH" | "LOW" }[] = [];
    if (Array.isArray(events) && events.length) {
      extrema = events
        .map((e) => ({
          t: +new Date(e.ts),
          h: toFt(e.height_m, e.height_ft),
          type: e.type,
        }))
        .filter((d) => Number.isFinite(d.h));
    } else if (data && data.length > 0) {
      extrema = data
        .map((d) => ({
          t: d.time.getTime(),
          h: toFt(undefined, d.height),
          type: d.type.toLowerCase() === "high" ? "HIGH" : "LOW",
        }))
        .filter((d) => Number.isFinite(d.h));
    } else if (forecasts && forecasts.length > 0) {
      const tideEvents = extractTideEvents(forecasts);
      extrema = tideEvents
        .map((e) => ({
          t: e.time.getTime(),
          h: toFt(undefined, e.height),
          type: (e.type as string).toLowerCase().includes("high")
            ? "HIGH"
            : "LOW",
        }))
        .filter((d) => Number.isFinite(d.h));
    }

    // Prefer hourly for line; else synthesize from extrema
    let line: { t: number; h: number }[] = [];
    if (Array.isArray(hourly) && hourly.length) {
      line = hourly
        .map((d) => ({ t: +new Date(d.ts), h: toFt(d.height_m, d.height_ft) }))
        .filter((d) => Number.isFinite(d.h))
        .sort((a, b) => a.t - b.t);
    } else {
      line = synthesizeFromExtrema(extrema.map((e) => ({ t: e.t, h: e.h })));
    }

    if (line.length === 0) {
      return {
        line: [] as { t: number; h: number }[],
        extrema: [] as { t: number; h: number; type: "HIGH" | "LOW" }[],
        domain: [-8, 8] as [number, number],
        ticks: [] as number[],
      };
    }

    // Limit to 5 days from first point
    const firstT = line[0].t;
    const fiveDaysLater = new Date(firstT);
    fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
    const endT = fiveDaysLater.getTime();
    const line5 = line.filter((p) => p.t <= endT);
    const extrema5 = extrema.filter((p) => p.t <= endT);

    const allH = [...line5.map((d) => d.h), ...extrema5.map((d) => d.h)].filter(
      (n) => Number.isFinite(n)
    );
    let minH = Math.min(...allH);
    let maxH = Math.max(...allH);
    if (!Number.isFinite(minH) || !Number.isFinite(maxH)) {
      minH = -1;
      maxH = 1;
    }
    if (minH === maxH) {
      minH -= 0.5;
      maxH += 0.5;
    }
    const domain: [number, number] = [minH - 0.5, maxH + 0.5];

    // Day ticks from line points
    const seenDays = new Set<string>();
    const ticks: number[] = [];
    for (const p of line5) {
      const d = new Date(p.t);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!seenDays.has(key)) {
        seenDays.add(key);
        ticks.push(p.t);
      }
    }

    return { line: line5, extrema: extrema5, domain, ticks };
  }, [data, forecasts, hourly, events]);

  const {
    line: lineData,
    extrema: extremaData,
    domain: yDomain,
    ticks: dayTicks,
  } = normalized;

  // Dev-only: flag inversions where LOW >= HIGH within a day
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const byDay = new Map<string, { high: number[]; low: number[] }>();
    extremaData.forEach((p) => {
      const d = new Date(p.t);
      d.setHours(0, 0, 0, 0);
      const k = d.toISOString();
      const v = byDay.get(k) ?? { high: [], low: [] };
      (p.type === "HIGH" ? v.high : v.low).push(p.h);
      byDay.set(k, v);
    });
    const issues: string[] = [];
    byDay.forEach((v, k) => {
      const maxLow = Math.max(...(v.low.length ? v.low : [-Infinity]));
      const minHigh = Math.min(...(v.high.length ? v.high : [Infinity]));
      if (maxLow >= minHigh)
        issues.push(
          `${k}: maxLow ${maxLow.toFixed(1)} ≥ minHigh ${minHigh.toFixed(1)}`
        );
    });
    if (issues.length) console.warn("Tide inversion detected:", issues);
  }, [extremaData]);

  // Get current timestamp for "Now" line
  const nowTimestamp = Date.now();

  // Custom tick formatter for Today/Tomorrow/Day names
  const formatXAxisTick = useMemo(
    () => (tickItem: any) => {
      const date = new Date(tickItem);
      const dayString = getNormalizedDateString(date);
      return getDayLabel(dayString);
    },
    []
  );

  // Filter ticks to show one per day (derived above from normalized data)
  const xTicks = dayTicks && dayTicks.length ? dayTicks : undefined;

  if (lineData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>5-Day Tide Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No tide data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>5-Day Tide Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label="5-day tide chart showing high and low tide heights over time"
          className="w-full"
        >
          <ChartContainer config={chartConfig} className="aspect-[8/3] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={lineData}
                margin={{ top: 50, right: 30, left: 30, bottom: 50 }}
              >
                {/* Minimal, subtle grid */}
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="#E5E7EB"
                  strokeOpacity={0.3}
                  horizontal={true}
                  vertical={false}
                />

                {/* Zero baseline reference line - subtle */}
                <ReferenceLine
                  y={0}
                  stroke="#D1D5DB"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  strokeOpacity={0.6}
                />

                {/* X-axis with Today/Tomorrow labels and visible axis lines */}
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  ticks={xTicks as any}
                  tickFormatter={formatXAxisTick}
                  interval={0}
                  axisLine={{ stroke: "#9CA3AF" }}
                  tickLine={{ stroke: "#9CA3AF" }}
                  label={{
                    value: "Day",
                    position: "bottom",
                    offset: -5,
                    fill: "#4B5563",
                  }}
                />

                {/* Y-axis with tide height label and visible axis lines */}
                <YAxis
                  yAxisId="y"
                  domain={yDomain}
                  tickCount={7}
                  axisLine={{ stroke: "#9CA3AF" }}
                  tickLine={{ stroke: "#9CA3AF" }}
                  label={{
                    value: "Tide (ft)",
                    angle: -90,
                    position: "insideLeft",
                    offset: 0,
                    fill: "#4B5563",
                  }}
                />

                {/* "Now" reference line - subtle */}
                {showNowLine && (
                  <ReferenceLine
                    x={nowTimestamp}
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.8}
                  />
                )}

                {/* Area chart with zero baseline split */}
                <Area
                  yAxisId="y"
                  type="monotone"
                  dataKey="h"
                  stroke="#0077B6"
                  strokeWidth={2}
                  fill="#0077B6"
                  fillOpacity={0.1}
                  dot={false}
                  connectNulls={true}
                  baseValue={0}
                  isAnimationActive={isAnimationActive}
                />

                {/* Main line - clean and prominent */}
                <Line
                  yAxisId="y"
                  type="monotone"
                  dataKey="h"
                  stroke="#0077B6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: "#0077B6",
                    strokeWidth: 2,
                    fill: "#FFFFFF",
                  }}
                  isAnimationActive={isAnimationActive}
                />

                {/* High tide scatter points with labels above */}
                <Scatter
                  yAxisId="y"
                  data={extremaData.filter((e) => e.type === "HIGH")}
                  dataKey="h"
                  fill="#FF7F11"
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  r={5}
                  fillOpacity={0.9}
                  isAnimationActive={isAnimationActive}
                >
                  <LabelList dataKey="h" content={TideLabel} position="top" />
                </Scatter>

                {/* Low tide scatter points with labels below */}
                <Scatter
                  yAxisId="y"
                  data={extremaData.filter((e) => e.type === "LOW")}
                  dataKey="h"
                  fill="#6B7280"
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  r={5}
                  fillOpacity={0.8}
                  isAnimationActive={isAnimationActive}
                >
                  <LabelList
                    dataKey="h"
                    content={TideLabel}
                    position="bottom"
                  />
                </Scatter>

                {/* Enhanced, accessible tooltip */}
                <ChartTooltip
                  content={<TideTooltipContent />}
                  formatter={(v: any) =>
                    typeof v === "number" ? `${v.toFixed(1)} ft` : v
                  }
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    });
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
