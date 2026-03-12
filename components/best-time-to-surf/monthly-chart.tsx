"use client";

/**
 * Monthly Surf Score Chart
 *
 * Recharts AreaChart showing month-by-month surf scores for a city.
 * Uses the shared ChartContainer pattern from components/ui/chart.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlySurfEntry } from "@/actions/city/best-time-actions";

interface MonthlySurfChartProps {
  monthly: MonthlySurfEntry[];
  className?: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlySurfEntry }>;
}) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-foreground">{data.monthName}</p>
      <p className="text-sm text-muted-foreground">
        Score: <span className="font-medium text-ocean-blue">{data.score}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {data.bestMonthCount} beach{data.bestMonthCount !== 1 ? "es" : ""} in peak season
      </p>
    </div>
  );
}

export function MonthlySurfChart({ monthly, className }: MonthlySurfChartProps) {
  const chartData = monthly.map((m) => ({
    ...m,
    abbrev: m.monthName.slice(0, 3),
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="surfScoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#404C92" />
          <XAxis
            dataKey="abbrev"
            tick={{ fontSize: 12, fill: "#B0BFDA" }}
            tickLine={false}
            axisLine={{ stroke: "#404C92" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "#B0BFDA" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#surfScoreGradient)"
            dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
