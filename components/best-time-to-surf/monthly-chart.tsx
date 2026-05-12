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

function getScoreLabel(score: number): string {
  if (score >= 80) return "Prime window";
  if (score >= 60) return "Solid season";
  if (score >= 40) return "Worth watching";
  return "Quiet stretch";
}

function getScoreHint(data: MonthlySurfEntry): string {
  if (data.score >= 80) {
    return "Plan around this month if you want the most consistent odds.";
  }
  if (data.score >= 60) {
    return "Good fallback window with enough beaches in season.";
  }
  if (data.score >= 40) {
    return "Pick your days carefully and lean on live conditions.";
  }
  return "Usually between prime seasons. Watch for short-lived windows.";
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
    <div className="max-w-[250px] rounded-lg border border-[#252D6B]/20 bg-[#FBF6E8] px-4 py-3 text-[#11100D] shadow-[0_16px_34px_rgba(37,45,107,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#655C4C]">
            {data.monthName}
          </p>
          <p className="mt-0.5 text-lg font-bold leading-none">
            {getScoreLabel(data.score)}
          </p>
        </div>
        <span className="rounded-full bg-[#252D6B] px-2.5 py-1 text-sm font-bold text-white">
          {data.score}
        </span>
      </div>
      <p className="mt-3 text-sm leading-snug text-[#655C4C]">
        {getScoreHint(data)}
      </p>
      <p className="mt-2 text-xs font-medium text-[#252D6B]">
        {data.bestMonthCount} peak-season beach
        {data.bestMonthCount !== 1 ? "es" : ""}
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
