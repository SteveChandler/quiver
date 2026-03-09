"use client";

/**
 * BeachAccuracyLeaderboard
 *
 * Client component — ranked table of top beaches by Quiver improvement %.
 * Shows 5 rows initially with a "Show More" button to reveal the rest.
 * Columns: Beach Name (linked), NOAA Error, Quiver Error, Improvement %, Predictions.
 * The Predictions column is hidden on mobile to reduce horizontal overflow.
 */

import { useState } from "react";
import Link from "next/link";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

export interface LeaderboardBeachRow {
  beachId: string;
  beachName: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  rawMae: number;
  correctedMae: number;
  maeImprovementPct: number;
  predictionsMatched: number;
}

interface BeachAccuracyLeaderboardProps {
  beaches: LeaderboardBeachRow[];
}

const INITIAL_COUNT = 5;

function formatMae(mae: number): string {
  return `${mae.toFixed(3)}m`;
}

function formatImprovement(pct: number): string {
  const rounded = Math.round(pct);
  return `+${rounded}%`;
}

/** Returns a small inline bar width (0-100%) for visual encoding of improvement. */
function improvementBarWidth(pct: number, maxPct: number): string {
  return `${Math.min(100, (pct / maxPct) * 100)}%`;
}

export function BeachAccuracyLeaderboard({ beaches }: BeachAccuracyLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  if (beaches.length === 0) return null;

  const visibleBeaches = expanded ? beaches : beaches.slice(0, INITIAL_COUNT);
  const hasMore = beaches.length > INITIAL_COUNT;
  const maxImprovement = beaches[0]?.maeImprovementPct ?? 1;

  return (
    <section aria-label="Top beaches by forecast accuracy improvement">
      <div className="rounded-2xl border border-white/15 bg-white overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">
            Top Beaches by Accuracy Improvement
          </h2>
          <p className="text-sm text-medium mt-1">
            Ranked by reduction in wave height error versus the NOAA baseline.
            Minimum 20 validated predictions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left font-medium text-medium w-8">
                  #
                </th>
                <th className="px-4 py-3 text-left font-medium text-medium">
                  Beach
                </th>
                <th className="px-4 py-3 text-right font-medium text-medium">
                  NOAA Error
                </th>
                <th className="px-4 py-3 text-right font-medium text-medium">
                  Quiver Error
                </th>
                <th className="px-4 py-3 text-right font-medium text-medium min-w-[120px]">
                  Improvement
                </th>
                <th className="px-4 py-3 text-right font-medium text-medium hidden sm:table-cell">
                  Predictions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleBeaches.map((beach, index) => {
                const beachUrl =
                  beach.slug && beach.city && beach.state
                    ? buildBeachUrl({
                        slug: beach.slug,
                        city: beach.city,
                        state: beach.state,
                        country: beach.country,
                      })
                    : null;

                return (
                  <tr
                    key={beach.beachId}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      index === visibleBeaches.length - 1 && !hasMore ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-white/40 text-xs font-mono">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      {beachUrl ? (
                        <Link
                          href={beachUrl}
                          className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                        >
                          {beach.beachName}
                        </Link>
                      ) : (
                        <span className="font-medium text-white">
                          {beach.beachName}
                        </span>
                      )}
                      {beach.city && beach.state && (
                        <span className="block text-xs text-white/40 mt-0.5">
                          {beach.city}, {beach.state}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-medium font-mono text-xs">
                      {formatMae(beach.rawMae)}
                    </td>
                    <td className="px-4 py-3 text-right text-medium font-mono text-xs">
                      {formatMae(beach.correctedMae)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden sm:block w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: improvementBarWidth(beach.maeImprovementPct, maxImprovement) }}
                          />
                        </div>
                        <span className="text-white font-medium">
                          {formatImprovement(beach.maeImprovementPct)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white/40 text-xs hidden sm:table-cell">
                      {beach.predictionsMatched.toLocaleString("en-US")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && !expanded && (
          <div className="px-6 py-4 border-t border-white/10">
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-sm font-medium text-sky-300 hover:text-sky-200 transition-colors py-2"
            >
              Show all {beaches.length} beaches
            </button>
          </div>
        )}

        {expanded && hasMore && (
          <div className="px-6 py-4 border-t border-white/10">
            <button
              onClick={() => setExpanded(false)}
              className="w-full text-sm font-medium text-white/50 hover:text-white/70 transition-colors py-2"
            >
              Show less
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
