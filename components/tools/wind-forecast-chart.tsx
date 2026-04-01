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
  ts: number;
  speed: number;
  gust: number;
  directionDeg: number | null;
  label: string;
  qualityColor: string;
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
    const now = Date.now();
    const threeHoursAgo = now - 3 * 60 * 60 * 1000;
    const twentyOneHoursAhead = now + 21 * 60 * 60 * 1000;

    // Window: ~3h past to ~21h future, centered on now
    const windowed = wind.filter((pt) => {
      const t = new Date(pt.ts).getTime();
      return t >= threeHoursAgo && t <= twentyOneHoursAhead;
    });

    return windowed.map((pt) => {
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
          margin={{ top: 20, right: 12, bottom: 4, left: 4 }}
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
            content={<WindTooltip />}
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
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  offshoreDeg?: number | null;
  toleranceDeg?: number | null;
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
