"use client";

/**
 * NOAAComparisonBar
 *
 * Client component — side-by-side horizontal bar chart comparing NOAA baseline
 * (raw MAE) against Quiver corrected (corrected MAE) using Recharts + ChartContainer.
 */

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface NOAAComparisonBarProps {
  rawMae: number;
  correctedMae: number;
}

const chartConfig = {
  mae: {
    label: "Wave Height Error (m)",
  },
  rawMae: {
    label: "NOAA Baseline",
    color: "#fb923c", // orange-400 — colorblind-safe vs emerald
  },
  correctedMae: {
    label: "Quiver",
    color: "#34d399", // emerald-400 — green = good
  },
} satisfies ChartConfig;

export function NOAAComparisonBar({ rawMae, correctedMae }: NOAAComparisonBarProps) {
  const data = [
    {
      name: "NOAA Baseline",
      mae: rawMae,
      key: "rawMae",
    },
    {
      name: "Quiver",
      mae: correctedMae,
      key: "correctedMae",
    },
  ];

  return (
    <section aria-label="NOAA Baseline vs Quiver accuracy comparison">
      <div className="rounded-2xl border border-white/15 bg-white p-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          NOAA Baseline vs. Quiver
        </h2>
        <p className="text-sm text-white/70 mb-6">
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

        <p className="text-xs text-white/50 mt-4 text-center">
          Lower is better. Values are average MAE across all tracked beaches (14-day
          rolling window).
        </p>
      </div>
    </section>
  );
}
