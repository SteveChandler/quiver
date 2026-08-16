"use client";

/**
 * Destination Comparison
 *
 * Side-by-side monthly heatmaps for 2–3 states.
 * Allows trip planning ("Should I go to Hawaii or Puerto Rico in March?").
 */

import { useState, useCallback } from "react";
import { X, Plus } from "lucide-react";
import type { StateSurfProfile } from "@/lib/data/monthly-surf-data";
import { MonthlyHeatmap } from "@/components/best-time-to-surf/monthly-heatmap";

const MONTH_ABBREVS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface DestinationComparisonProps {
  availableStates: StateSurfProfile[];
}

function scoreToColor(score: number): string {
  if (score >= 75) return "#10b981"; // emerald-500
  if (score >= 55) return "#34d399"; // emerald-400
  if (score >= 40) return "#facc15"; // yellow-400
  if (score >= 25) return "#fb923c"; // orange-400
  return "#ef4444"; // red-500
}

export function DestinationComparison({ availableStates }: DestinationComparisonProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const addState = useCallback((slug: string) => {
    setSelected((prev) => {
      if (prev.includes(slug) || prev.length >= 3) return prev;
      return [...prev, slug];
    });
    setShowPicker(false);
  }, []);

  const removeState = useCallback((slug: string) => {
    setSelected((prev) => prev.filter((s) => s !== slug));
  }, []);

  const selectedProfiles = selected
    .map((slug) => availableStates.find((s) => s.stateSlug === slug))
    .filter(Boolean) as StateSurfProfile[];

  const unselectedStates = availableStates.filter((s) => !selected.includes(s.stateSlug));

  if (selected.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <p className="text-slate-300 text-sm mb-4">
          Compare up to 3 destinations side-by-side to plan your surf trip.
        </p>
        <div className="flex flex-wrap gap-2">
          {availableStates.slice(0, 8).map((state) => (
            <button
              key={state.stateSlug}
              type="button"
              onClick={() => addState(state.stateSlug)}
              className="px-3 py-1.5 rounded-lg bg-[#252D6B] border border-[#F78E42]/30 text-sm text-white hover:border-[#F78E42] hover:bg-[#F78E42]/10 transition-colors focus-ring"
            >
              {state.stateName}
            </button>
          ))}
          {availableStates.length > 8 && (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-sm text-slate-300 hover:bg-white/10 transition-colors focus-ring"
            >
              + {availableStates.length - 8} more
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected state chips */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedProfiles.map((profile) => (
          <div
            key={profile.stateSlug}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F78E42]/20 border border-[#F78E42]/40 text-sm text-white"
          >
            <span>{profile.stateName}</span>
            <button
              type="button"
              onClick={() => removeState(profile.stateSlug)}
              className="text-[#F78E42] hover:text-white transition-colors focus-ring"
              aria-label={`Remove ${profile.stateName}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {selected.length < 3 && (
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 border border-white/20 text-sm text-slate-300 hover:bg-white/10 transition-colors focus-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            Add destination
          </button>
        )}
      </div>

      {/* State picker dropdown */}
      {showPicker && (
        <div className="rounded-xl border border-white/10 bg-[#1A2158] p-4">
          <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Select a destination</p>
          <div className="flex flex-wrap gap-2">
            {unselectedStates.map((state) => (
              <button
                key={state.stateSlug}
                type="button"
                onClick={() => addState(state.stateSlug)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-sm text-white hover:border-[#F78E42] hover:bg-[#F78E42]/10 transition-colors focus-ring"
              >
                {state.stateName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className={`grid gap-6 ${selectedProfiles.length >= 2 ? "md:grid-cols-2" : "grid-cols-1"} ${selectedProfiles.length === 3 ? "lg:grid-cols-3" : ""}`}>
        {selectedProfiles.map((profile) => (
          <div key={profile.stateSlug} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white">{profile.stateName}</h3>
              <button
                type="button"
                onClick={() => removeState(profile.stateSlug)}
                className="text-slate-500 hover:text-slate-300 transition-colors focus-ring"
                aria-label={`Remove ${profile.stateName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Peak: {profile.peakSeason}</p>
            <MonthlyHeatmap
              monthly={profile.monthly}
              peakMonths={profile.peakMonths}
              stateName={profile.stateName}
            />
          </div>
        ))}
      </div>

      {/* Best month comparison table */}
      {selectedProfiles.length >= 2 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Month</th>
                {selectedProfiles.map((p) => (
                  <th key={p.stateSlug} className="text-center px-4 py-3 text-slate-300 font-medium">
                    {p.stateName.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTH_ABBREVS.map((abbrev, i) => {
                const scores = selectedProfiles.map((p) => p.monthly[i].overallScore);
                const maxScore = Math.max(...scores);
                return (
                  <tr key={abbrev} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2 text-slate-300">{abbrev}</td>
                    {selectedProfiles.map((p) => {
                      const score = p.monthly[i].overallScore;
                      const isBest = score === maxScore && score >= 50;
                      return (
                        <td key={p.stateSlug} className="px-4 py-2 text-center">
                          <span
                            className={`inline-block font-mono text-sm font-medium rounded px-1.5 ${
                              isBest ? "bg-[#F78E42]/20 text-[#F78E42]" : ""
                            }`}
                            style={{ color: isBest ? undefined : scoreToColor(score) }}
                          >
                            {score}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
