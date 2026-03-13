"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getQualityLabel } from "@/lib/utils/score-color-utils";
import { formatWaveRange } from "@/lib/utils/wave-formatters";
import { capitalize } from "@/lib/utils/text-utils";
import { TIER_COLOR_HEX } from "@/lib/utils/horizon-strip-utils";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";

interface OutlookBarChartProps {
  days: EnrichedDaySummary[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EnrichedDaySummary }>;
}) {
  if (!active || !payload?.[0]) return null;
  const day = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{day.date}</p>
      <p className="text-muted-foreground">
        Score: {day.score} &mdash; {getQualityLabel(day.score)}
      </p>
      <p className="text-muted-foreground">
        Waves: {formatWaveRange([day.minHeight, day.maxHeight], "integer")}
      </p>
      <p className="text-muted-foreground">
        Wind: {capitalize(day.windConditions)}
      </p>
      <p className="text-muted-foreground">
        Best time: {capitalize(day.bestTimeSlot)}
      </p>
    </div>
  );
}

export function OutlookBarChart({ days }: OutlookBarChartProps) {
  const [showYAxis, setShowYAxis] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    setShowYAxis(mql.matches);

    function handler(e: MediaQueryListEvent) {
      setShowYAxis(e.matches);
    }
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-6" role="img" aria-label={`Bar chart showing daily surf condition scores for the next ${days.length} days`}>
      <h3 className="text-lg font-semibold text-foreground">{days.length}-Day Outlook</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Daily surf condition scores
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: showYAxis ? 0 : -20 }}>
          <XAxis
            dataKey="dayName"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          {showYAxis && (
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
          )}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <ReferenceLine y={40} stroke="#606DA8" strokeDasharray="3 3" />
          <ReferenceLine y={60} stroke="#606DA8" strokeDasharray="3 3" />
          <ReferenceLine y={80} stroke="#606DA8" strokeDasharray="3 3" />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {days.map((day, i) => (
              <Cell
                key={i}
                fill={TIER_COLOR_HEX[day.tier]}
                stroke={day.isToday ? "#1e293b" : "none"}
                strokeWidth={day.isToday ? 2 : 0}
                fillOpacity={day.isToday ? 1 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
