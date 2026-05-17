"use client";

/**
 * NOAAComparisonBar
 *
 * Client component: when time-series data is available, renders a line chart
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
  improvementPct: {
    label: "Forecast lift",
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
    improvementPct: number;
    count: number;
    rawMae: number;
    correctedMae: number;
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
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  const improvement = point?.improvementPct ?? 0;
  const count = payload[0]?.payload?.count ?? 0;

  return (
    <div className="rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-2.5 shadow-[3px_3px_0_#11100D]">
      <p className="mb-1.5 text-xs font-black text-[#5F5646]">
        {label ? formatDateShort(label) : ""}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
          <span className="text-xs font-bold text-[#5F5646]">Lift:</span>
          <span className="text-xs font-black text-[#11100D]">
            {improvement.toFixed(1)}% better than NOAA
          </span>
        </div>
        <div className="mt-1 border-t border-[#11100D]/15 pt-1">
          <span className="text-xs font-bold text-[#5F5646]">
            {count} predictions
          </span>
        </div>
      </div>
    </div>
  );
}

interface PositiveAccuracyPoint extends DailyAccuracyPoint {
  improvementPct: number;
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
  const chartData: PositiveAccuracyPoint[] = timeSeries
    .map((point) => ({
      ...point,
      improvementPct:
        point.rawMae > 0
          ? Math.max(0, ((point.rawMae - point.correctedMae) / point.rawMae) * 100)
          : 0,
    }))
    .filter((point) => Number.isFinite(point.improvementPct));

  return (
    <section aria-label="Quiver forecast lift over NOAA by day">
      <div className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_4px_0_#11100D] md:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex rotate-[-1.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#F78E42] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
              The receipts
            </p>
            <h2 className="font-heading text-2xl font-black text-[#11100D]">
              Quiver lift, day by day
            </h2>
          </div>
          <p className="max-w-sm text-sm font-semibold leading-6 text-[#5F5646]">
            How much better Quiver performed than the NOAA baseline against buoy
            checks.
          </p>
        </div>

        <div className="h-72 w-full rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-3 shadow-[3px_3px_0_#11100D]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="improvementLift" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(244,235,216,0.15)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fontSize: 11, fill: "rgba(244,235,216,0.72)" }}
                axisLine={{ stroke: "rgba(244,235,216,0.2)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v)}%`}
                tick={{ fontSize: 11, fill: "rgba(244,235,216,0.72)" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="improvementPct"
                stroke="none"
                fill="url(#improvementLift)"
                fillOpacity={1}
              />

              <Line
                type="monotone"
                dataKey="improvementPct"
                name="Forecast lift"
                stroke="#34d399"
                strokeWidth={3}
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
        <div className="mb-3 mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full" style={{ background: "#34d399" }} />
            <span className="text-xs font-bold text-[#5F5646]">
              Improvement over NOAA
            </span>
          </div>
        </div>

        {/* Summary stat */}
        <div className="rotate-[-0.5deg] rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 text-center shadow-[3px_3px_0_#11100D]">
          <p className="text-sm font-bold text-[#11100D]">
            Latest sample:{" "}
            <span className="font-mono font-black text-[#008A7A]">
              {improvementPct.toFixed(1)}%
            </span>
            {" "}better than the NOAA baseline.
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
      <div className="rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-6 shadow-[4px_4px_0_#11100D]">
        <h2 className="mb-1 font-heading text-xl font-black text-[#11100D]">
          NOAA Baseline vs. Quiver
        </h2>
        <p className="mb-6 text-sm font-semibold text-[#5F5646]">
          Quiver reduces wave height error from{" "}
          <strong className="text-[#11100D]">{rawMae.toFixed(3)}m</strong> to{" "}
          <strong className="text-[#11100D]">{correctedMae.toFixed(3)}m</strong>, measured as Mean Absolute
          Error (MAE) against live buoy readings.
        </p>

        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(17,16,13,0.12)" />
            <XAxis
              type="number"
              domain={[0, Math.ceil(rawMae * 1.2 * 100) / 100]}
              tickFormatter={(v: number) => `${v.toFixed(2)}m`}
              tick={{ fontSize: 11, fill: "#5F5646" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fontWeight: 700, fill: "#11100D" }}
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

        <p className="mt-4 text-center text-xs font-semibold text-[#5F5646]">
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
