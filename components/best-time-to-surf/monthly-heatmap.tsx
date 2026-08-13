"use client";

/**
 * Monthly Surf Heatmap
 *
 * Replaces the plain bar chart with a color-coded heatmap calendar.
 * Green (best) → Yellow (decent) → Red (poor).
 * Each cell shows wave icon + temp + crowd dot. Tap/hover reveals detail.
 */

import { useState } from "react";
import type { MonthlyData } from "@/lib/data/monthly-surf-data";

const MONTH_ABBREVS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function scoreToColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-emerald-400";
  if (score >= 40) return "bg-yellow-400";
  if (score >= 25) return "bg-orange-400";
  return "bg-red-500";
}

function scoreToTextColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 55) return "text-emerald-500";
  if (score >= 40) return "text-yellow-600";
  if (score >= 25) return "text-orange-500";
  return "text-red-500";
}

function crowdDotColor(crowdLevel: string): string {
  if (crowdLevel === "low") return "bg-green-400";
  if (crowdLevel === "high") return "bg-red-400";
  return "bg-yellow-400";
}

interface TooltipData {
  monthIndex: number;
  entry: MonthlyData;
  x: number;
  y: number;
}

interface MonthlyHeatmapProps {
  monthly: MonthlyData[];
  peakMonths: number[];
  stateName: string;
}

export function MonthlyHeatmap({ monthly, peakMonths, stateName }: MonthlyHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const peakSet = new Set(peakMonths);

  return (
    <div className="relative">
      <p className="text-xs text-slate-400 mb-3">Tap a month for details</p>
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {monthly.map((entry, i) => {
          const isPeak = peakSet.has(i + 1);
          const colorClass = scoreToColor(entry.overallScore);
          const isActive = tooltip?.monthIndex === i;

          return (
            <button
              key={i}
              type="button"
              className={`
                relative rounded-lg p-2 flex flex-col items-center gap-1 transition-[box-shadow,transform]
                hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#F78E42]/60
                ${colorClass} ${isActive ? "ring-2 ring-[#F78E42]" : ""}
                ${isPeak ? "ring-2 ring-white/50" : ""}
              `}
              onClick={(e) => {
                if (isActive) {
                  setTooltip(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ monthIndex: i, entry, x: rect.left, y: rect.bottom });
                }
              }}
              aria-label={`${entry.month}: score ${entry.overallScore}`}
            >
              <span className="text-[10px] font-bold text-white/90">{MONTH_ABBREVS[i]}</span>
              <span className="text-xs font-bold text-white">{entry.overallScore}</span>
              <div className="flex items-center gap-0.5">
                {/* Crowd dot */}
                <div className={`h-1.5 w-1.5 rounded-full ${crowdDotColor(entry.crowdLevel)}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-500" />
          <span>Great (75+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-yellow-400" />
          <span>Decent (40–74)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-500" />
          <span>Poor (&lt;40)</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span>Crowd:</span>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-400" /><span>Low</span></div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-yellow-400" /><span>Mod</span></div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-400" /><span>High</span></div>
        </div>
      </div>

      {/* Tooltip detail */}
      {tooltip && (
        <div className="mt-4 rounded-xl bg-[#1A2158] border border-white/10 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-white">{tooltip.entry.month}</h4>
            <span className={`font-mono font-bold text-lg ${scoreToTextColor(tooltip.entry.overallScore)}`}>
              {tooltip.entry.overallScore}/100
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-400 text-xs uppercase tracking-wide">Waves</span>
              <p className="text-white font-medium">{tooltip.entry.waveHeightRange}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs uppercase tracking-wide">Water Temp</span>
              <p className="text-white font-medium">{tooltip.entry.waterTemp}°F</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs uppercase tracking-wide">Wetsuit</span>
              <p className="text-white font-medium">{tooltip.entry.wetsuit}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs uppercase tracking-wide">Crowds</span>
              <p className="text-white font-medium capitalize">{tooltip.entry.crowdLevel}</p>
            </div>
          </div>
          {tooltip.entry.bestFor && (
            <p className="mt-3 text-xs text-slate-300 leading-relaxed border-t border-white/10 pt-3">
              {tooltip.entry.bestFor}
            </p>
          )}
          <button
            type="button"
            onClick={() => setTooltip(null)}
            className="mt-3 text-xs text-slate-400 hover:text-white transition-colors focus-ring"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
