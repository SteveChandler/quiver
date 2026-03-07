"use client";

/**
 * RegionalAccuracyChart
 *
 * Client component — grouped bar chart showing NOAA baseline vs Quiver corrected
 * MAE by US state, sorted by improvement %. Uses Recharts + ChartContainer.
 */

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface RegionalAccuracyRow {
  state: string;
  avgRawMae: number;
  avgCorrectedMae: number;
  avgImprovementPct: number;
  beachCount: number;
}

interface RegionalAccuracyChartProps {
  data: RegionalAccuracyRow[];
}

const chartConfig = {
  avgRawMae: {
    label: "NOAA Baseline",
    color: "#fb923c", // orange-400 — colorblind-safe vs emerald
  },
  avgCorrectedMae: {
    label: "Quiver",
    color: "#34d399", // emerald-400
  },
} satisfies ChartConfig;

export function RegionalAccuracyChart({ data }: RegionalAccuracyChartProps) {
  if (data.length === 0) return null;

  // Sort by improvement descending (already sorted from action, but enforce here too)
  const sorted = [...data].sort((a, b) => b.avgImprovementPct - a.avgImprovementPct);

  const chartData = sorted.map((row) => ({
    state: row.state,
    avgRawMae: parseFloat(row.avgRawMae.toFixed(3)),
    avgCorrectedMae: parseFloat(row.avgCorrectedMae.toFixed(3)),
    avgImprovementPct: parseFloat(row.avgImprovementPct.toFixed(1)),
    beachCount: row.beachCount,
  }));

  return (
    <section aria-label="Regional forecast accuracy breakdown">
      <div className="rounded-2xl border border-white/15 bg-white p-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          Accuracy by Region
        </h2>
        <p className="text-sm text-white/70 mb-6">
          Wave height MAE (meters) by state — lower is better. Regions sorted by
          improvement over NOAA.
        </p>

        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="state"
              tick={{ fontSize: 12, fill: "rgba(255,255,255,0.8)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(2)}m`}
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    `${(value as number).toFixed(3)}m`,
                    name === "avgRawMae" ? "NOAA Baseline" : "Quiver",
                  ]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as typeof chartData[0] | undefined;
                    return row
                      ? `${label} — ${row.avgImprovementPct}% improvement (${row.beachCount} beaches)`
                      : String(label);
                  }}
                />
              }
            />
            <Legend
              formatter={(value) =>
                value === "avgRawMae" ? "NOAA Baseline" : "Quiver"
              }
            />
            <Bar
              dataKey="avgRawMae"
              fill="var(--color-avgRawMae)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="avgCorrectedMae"
              fill="var(--color-avgCorrectedMae)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ChartContainer>

        <p className="text-xs text-white/50 mt-4 text-center">
          Only regions with 3+ validated beaches shown. 14-day rolling evaluation
          window.
        </p>
      </div>
    </section>
  );
}
