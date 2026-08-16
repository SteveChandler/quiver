"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

const TideChart = dynamic(
  () =>
    import("@/components/forecast").then((m) => ({ default: m.TideChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-2xl bg-blue-50/50" />
    ),
  }
);

type TimeRange = "today" | "3day" | "7day";

const TAB_CONFIG: Array<{ key: TimeRange; label: string; hours: number }> = [
  { key: "today", label: "Today", hours: 18 },
  { key: "3day", label: "3-Day", hours: 72 },
  { key: "7day", label: "7-Day", hours: 168 },
];

interface TideChartSectionProps {
  forecasts: EnhancedForecastEntity[];
}

export function TideChartSection({ forecasts }: TideChartSectionProps) {
  const [activeRange, setActiveRange] = React.useState<TimeRange>("today");
  const activeConfig = TAB_CONFIG.find((t) => t.key === activeRange)!;
  const now = React.useMemo(() => new Date(), []);

  if (forecasts.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-3xl border border-blue-100/60 bg-white/95 p-4 md:p-6 shadow-lg"
      data-testid="tide-chart-section"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-dark-grey">
          Tide Forecast
        </h2>
        <div
          role="tablist"
          aria-label="Tide chart time range"
          className="flex rounded-lg bg-blue-100/60 p-0.5"
        >
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeRange === tab.key}
              onClick={() => setActiveRange(tab.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeRange === tab.key
                  ? "bg-white text-ocean-blue shadow-sm"
                  : "text-muted-foreground hover:text-dark-grey"
              ) + " focus-ring"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <TideChart
          forecasts={forecasts}
          now={now}
          compact={true}
          className="h-full"
          windowHours={activeConfig.hours}
          nowBias={0.2}
          bufferHours={activeConfig.key === "7day" ? 3 : 1}
        />
      </div>
    </div>
  );
}
