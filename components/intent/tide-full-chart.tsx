"use client";

import * as React from "react";
import { TideChart, type TidePoint } from "@/components/forecast";
import { cn } from "@/lib/utils";

type TimeRange = "today" | "3day" | "7day";

interface TideFullChartProps {
  hourlyPoints: Array<{ time: string; height: number }>;
}

const TAB_CONFIG: Array<{ key: TimeRange; label: string; hours: number }> = [
  { key: "today", label: "Today", hours: 24 },
  { key: "3day", label: "3-Day", hours: 72 },
  { key: "7day", label: "7-Day", hours: 168 },
];

/**
 * TideFullChart - Multi-day tide chart with time range toggle
 *
 * Wraps existing TideChart with Today/3-Day/7-Day toggle tabs
 * and a larger chart height.
 */
export function TideFullChart({ hourlyPoints }: TideFullChartProps) {
  const [activeRange, setActiveRange] = React.useState<TimeRange>("today");

  const activeConfig = TAB_CONFIG.find((t) => t.key === activeRange)!;

  // Stable "now" reference to avoid re-renders
  const now = React.useMemo(() => new Date(), []);

  // Convert hourly points to TidePoint format, filtered by time range
  const tidePoints: TidePoint[] = React.useMemo(() => {
    const nowMs = now.getTime();
    const rangeMs = activeConfig.hours * 60 * 60 * 1000;
    // Show some past data: 20% past, 80% future
    const pastMs = rangeMs * 0.2;
    const startMs = nowMs - pastMs;
    const endMs = nowMs + rangeMs * 0.8;

    return hourlyPoints
      .filter((p) => {
        const ts = new Date(p.time).getTime();
        return ts >= startMs && ts <= endMs;
      })
      .map((p) => ({
        t: p.time,
        h: p.height,
      }));
  }, [hourlyPoints, activeConfig.hours, now]);

  if (hourlyPoints.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          Tide Chart
        </h2>

        {/* Toggle Tabs */}
        <div role="tablist" aria-label="Tide chart time range" className="flex rounded-lg bg-gray-100 p-0.5">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeRange === tab.key}
              onClick={() => setActiveRange(tab.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeRange === tab.key
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              ) + " focus-ring"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-label={`${activeConfig.label} tide chart`} className="h-80 w-full rounded-2xl border bg-white p-2 shadow-sm">
        <TideChart
          data={tidePoints}
          now={now}
          compact={true}
          className="h-full"
          windowHours={activeConfig.hours}
          nowBias={0.2}
          bufferHours={activeConfig.key === "7day" ? 3 : 1}
        />
      </div>
    </section>
  );
}
