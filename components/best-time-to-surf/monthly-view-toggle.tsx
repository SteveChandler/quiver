"use client";

/**
 * Monthly View Toggle
 *
 * Switches between the card grid and the color heatmap on city pages.
 * The heatmap is the new visual format; the grid is the detailed view.
 */

import { useState } from "react";
import { LayoutGrid, Flame } from "lucide-react";
import { MonthlyGrid } from "@/components/best-time-to-surf/monthly-grid";
import { MonthlyHeatmap } from "@/components/best-time-to-surf/monthly-heatmap";
import type { MonthlySurfEntry } from "@/actions/city/best-time-actions";
import type { MonthlyData } from "@/lib/data/monthly-surf-data";

interface MonthlyViewToggleProps {
  monthly: MonthlySurfEntry[];
  waterTempRange: string | null;
  summerWetsuit: string | null;
  winterWetsuit: string | null;
  stateMonthly?: MonthlyData[];
  peakMonths?: number[];
  stateName?: string;
}

export function MonthlyViewToggle({
  monthly,
  waterTempRange,
  summerWetsuit,
  winterWetsuit,
  stateMonthly,
  peakMonths,
  stateName = "",
}: MonthlyViewToggleProps) {
  const [view, setView] = useState<"grid" | "heatmap">("grid");

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("grid")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-[color,background-color,box-shadow] ${
            view === "grid"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }` + " focus-ring"}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Detail
        </button>
        <button
          type="button"
          onClick={() => setView("heatmap")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-[color,background-color,box-shadow] ${
            view === "heatmap"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }` + " focus-ring"}
        >
          <Flame className="h-3.5 w-3.5" />
          Heatmap
        </button>
      </div>

      {view === "grid" ? (
        <MonthlyGrid
          monthly={monthly}
          waterTempRange={waterTempRange}
          summerWetsuit={summerWetsuit}
          winterWetsuit={winterWetsuit}
          stateMonthly={stateMonthly}
          peakMonths={peakMonths}
        />
      ) : stateMonthly ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <MonthlyHeatmap
            monthly={stateMonthly}
            peakMonths={peakMonths ?? []}
            stateName={stateName}
          />
        </div>
      ) : (
        <MonthlyGrid
          monthly={monthly}
          waterTempRange={waterTempRange}
          summerWetsuit={summerWetsuit}
          winterWetsuit={winterWetsuit}
          stateMonthly={stateMonthly}
          peakMonths={peakMonths}
        />
      )}
    </div>
  );
}
