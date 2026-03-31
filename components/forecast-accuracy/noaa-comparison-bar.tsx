"use client";

/**
 * NOAAComparisonBar
 *
 * Client component — when time-series data is available, renders a line chart
 * showing daily MAE over the last 30 days comparing NOAA baseline vs Quiver ML.
 * Falls back to the original horizontal bar chart when no time-series data exists.
 */

import {
  Bar,
  BarChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Area,
  ComposedChart,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DailyAccuracyPoint } from "@/actions/ml/forecast-accuracy-actions";

interface NOAAComparisonBarProps {
  rawMae: number;
  correctedMae: number;
  timeSeries?: DailyAccuracyPoint[];
}

const chartConfig = {
  mae: {
    label: "Wave Height Error (m)",
  },
  rawMae: {
    label: "NOAA Baseline",
    color: "#fb923c",
  },
  correctedMae: {
    label: "Quiver ML",
    color: "#34d399",
  },
} satisfies ChartConfig;

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TimeSeriesPayloadEntry {
  color: string;
  name: string;
  value: number;
  dataKey: string;
  payload: {
    date: string;
    rawMae: number;
    correctedMae: number;
    count: number;
  };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TimeSeriesPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length < 2) return null;

  const rawMae = payload.find((p) => p.dataKey === "rawMae")?.value ?? 0;
  const correctedMae = payload.find((p) => p.dataKey === "correctedMae")?.value ?? 0;
  const improvement = rawMae > 0 ? ((rawMae - correctedMae) / rawMae) * 100 : 0;
  const count = payload[0]?.payload?.count ?? 0;

  return (
    <div className="rounded-lg border border-white/20 bg-[#1a2150] px-3 py-2.5 shadow-xl">
      <p className="text-xs font-medium text-white/70 mb-1.5">
        {label ? formatDateShort(label) : ""}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "#fb923c" }} />
          <span className="text-xs text-white/80">NOAA:</span>
          <span className="text-xs font-semibold text-white">{rawMae.toFixed(3)}m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
          <span className="text-xs text-white/80">Quiver:</span>
          <span className="text-xs font-semibold text-white">{correctedMae.toFixed(3)}m</span>
        </div>
        <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-xs text-white/60">{count} predictions</span>
          <span className="text-xs font-semibold text-emerald-400">
            {improvement > 0 ? `${improvement.toFixed(1)}% better` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimeSeriesChart({
  timeSeries,
  rawMae,
  correctedMae,
}: {
  timeSeries: DailyAccuracyPoint[];
  rawMae: number;
  correctedMae: number;
}) {
  const improvementPct =
    rawMae > 0 ? ((rawMae - correctedMae) / rawMae) * 100 : 0;

  return (
    <section aria-label="Quiver vs NOAA — 30 Day Accuracy Trend">
      <div className="rounded-2xl border border-white/15 p-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          Quiver vs NOAA — 30 Day Accuracy Trend
        </h2>
        <p className="text-sm text-medium mb-6">
          Daily Mean Absolute Error comparing NOAA marine baseline against
          Quiver&apos;s ML-corrected forecasts. Lower is better.
        </p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={timeSeries}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="improvementGap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.08)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => `${v.toFixed(2)}m`}
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Area fill between the two lines to show the improvement gap */}
              <Area
                type="monotone"
                dataKey="rawMae"
                stroke="none"
                fill="url(#improvementGap)"
                fillOpacity={1}
              />

              {/* NOAA Baseline line */}
              <Line
                type="monotone"
                dataKey="rawMae"
                name="NOAA Baseline"
                stroke="#fb923c"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#fb923c",
                  stroke: "#1a2150",
                  strokeWidth: 2,
                }}
              />

              {/* Quiver ML line */}
              <Line
                type="monotone"
                dataKey="correctedMae"
                name="Quiver ML"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#34d399",
                  stroke: "#1a2150",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full" style={{ background: "#fb923c" }} />
            <span className="text-xs text-white/70">NOAA Baseline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full" style={{ background: "#34d399" }} />
            <span className="text-xs text-white/70">Quiver ML</span>
          </div>
        </div>

        {/* Summary stat */}
        <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-center">
          <p className="text-sm text-white/70">
            Overall improvement:{" "}
            <span className="font-semibold text-emerald-400">
              {improvementPct.toFixed(1)}%
            </span>
            {" "}lower error — from{" "}
            <span className="font-medium text-white">{rawMae.toFixed(3)}m</span>
            {" "}to{" "}
            <span className="font-medium text-white">{correctedMae.toFixed(3)}m</span>
            {" "}MAE
          </p>
        </div>
      </div>
    </section>
  );
}

function FallbackBarChart({
  rawMae,
  correctedMae,
}: {
  rawMae: number;
  correctedMae: number;
}) {
  const data = [
    { name: "NOAA Baseline", mae: rawMae, key: "rawMae" },
    { name: "Quiver", mae: correctedMae, key: "correctedMae" },
  ];

  return (
    <section aria-label="NOAA Baseline vs Quiver accuracy comparison">
      <div className="rounded-2xl border border-white/15 p-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          NOAA Baseline vs. Quiver
        </h2>
        <p className="text-sm text-medium mb-6">
          Quiver reduces wave height error from{" "}
          <strong className="text-white">{rawMae.toFixed(3)}m</strong> to{" "}
          <strong className="text-white">{correctedMae.toFixed(3)}m</strong> — measured as Mean Absolute
          Error (MAE) against live buoy readings.
        </p>

        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              type="number"
              domain={[0, Math.ceil(rawMae * 1.2 * 100) / 100]}
              tickFormatter={(v: number) => `${v.toFixed(2)}m`}
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fontWeight: 500, fill: "rgba(255,255,255,0.8)" }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [
                    `${(value as number).toFixed(3)}m`,
                    "MAE",
                  ]}
                />
              }
            />
            <Bar dataKey="mae" radius={[0, 6, 6, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={`var(--color-${entry.key})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <p className="text-xs text-medium mt-4 text-center">
          Lower is better. Values are average MAE across all tracked beaches (14-day
          rolling window).
        </p>
      </div>
    </section>
  );
}

export function NOAAComparisonBar({ rawMae, correctedMae, timeSeries }: NOAAComparisonBarProps) {
  if (timeSeries && timeSeries.length > 0) {
    return (
      <TimeSeriesChart
        timeSeries={timeSeries}
        rawMae={rawMae}
        correctedMae={correctedMae}
      />
    );
  }

  return <FallbackBarChart rawMae={rawMae} correctedMae={correctedMae} />;
}
