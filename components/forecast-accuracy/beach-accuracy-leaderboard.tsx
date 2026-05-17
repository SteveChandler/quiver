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
  rawMae: number | null;
  correctedMae: number | null;
  maeImprovementPct: number | null;
  predictionsMatched: number | null;
}

interface BeachAccuracyLeaderboardProps {
  beaches: LeaderboardBeachRow[];
}

const INITIAL_COUNT = 5;

function isFiniteMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatMae(mae: number | null): string {
  if (!isFiniteMetric(mae)) return "—";
  return `${mae.toFixed(3)}m`;
}

function formatImprovement(pct: number | null): string {
  if (!isFiniteMetric(pct)) return "—";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** Returns a small inline bar width (0-100%) for visual encoding of improvement. */
function improvementBarWidth(pct: number | null, maxPct: number): string {
  if (!isFiniteMetric(pct) || maxPct <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (pct / maxPct) * 100))}%`;
}

export function BeachAccuracyLeaderboard({ beaches }: BeachAccuracyLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  if (beaches.length === 0) return null;

  const visibleBeaches = expanded ? beaches : beaches.slice(0, INITIAL_COUNT);
  const hasMore = beaches.length > INITIAL_COUNT;
  const maxImprovement = Math.max(
    1,
    ...beaches
      .map((beach) => beach.maeImprovementPct)
      .filter((pct): pct is number => isFiniteMetric(pct) && pct > 0),
  );

  return (
    <section aria-label="Top beaches by forecast accuracy improvement">
      <div className="overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] shadow-[4px_4px_0_#11100D]">
        <div className="border-b-2 border-[#11100D] px-6 py-5">
          <h2 className="font-heading text-xl font-black text-[#11100D]">
            Top Beaches by Accuracy Improvement
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#5F5646]">
            Ranked by reduction in wave height error versus the NOAA baseline.
            Minimum 20 validated predictions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#11100D] bg-[#EFE5CF]">
                <th className="w-8 px-4 py-3 text-left font-black text-[#5F5646]">
                  #
                </th>
                <th className="px-4 py-3 text-left font-black text-[#5F5646]">
                  Beach
                </th>
                <th className="px-4 py-3 text-right font-black text-[#5F5646]">
                  NOAA Error
                </th>
                <th className="px-4 py-3 text-right font-black text-[#5F5646]">
                  Quiver Error
                </th>
                <th className="min-w-[120px] px-4 py-3 text-right font-black text-[#5F5646]">
                  Improvement
                </th>
                <th className="hidden px-4 py-3 text-right font-black text-[#5F5646] sm:table-cell">
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
                    className={`border-b border-[#11100D]/10 transition-colors hover:bg-[#EFE5CF] ${
                      index === visibleBeaches.length - 1 && !hasMore ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#5F5646]">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      {beachUrl ? (
                        <Link
                          href={beachUrl}
                          className="font-black text-[#0B3A75] hover:underline"
                        >
                          {beach.beachName}
                        </Link>
                      ) : (
                        <span className="font-black text-[#11100D]">
                          {beach.beachName}
                        </span>
                      )}
                      {beach.city && beach.state && (
                        <span className="mt-0.5 block text-xs font-semibold text-[#5F5646]">
                          {beach.city}, {beach.state}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#5F5646]">
                      {formatMae(beach.rawMae)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#5F5646]">
                      {formatMae(beach.correctedMae)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[#11100D]/10 sm:block">
                          <div
                            className="h-full rounded-full bg-[#008A7A]"
                            style={{ width: improvementBarWidth(beach.maeImprovementPct, maxImprovement) }}
                          />
                        </div>
                        <span className="font-black text-[#008A7A]">
                          {formatImprovement(beach.maeImprovementPct)}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs font-semibold text-[#5F5646] sm:table-cell">
                      {isFiniteMetric(beach.predictionsMatched)
                        ? beach.predictionsMatched.toLocaleString("en-US")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && !expanded && (
          <div className="border-t-2 border-[#11100D] px-6 py-4">
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-2 text-sm font-black text-[#0B3A75] transition-colors hover:underline"
            >
              Show all {beaches.length} beaches
            </button>
          </div>
        )}

        {expanded && hasMore && (
          <div className="border-t-2 border-[#11100D] px-6 py-4">
            <button
              onClick={() => setExpanded(false)}
              className="w-full py-2 text-sm font-black text-[#5F5646] transition-colors hover:text-[#11100D]"
            >
              Show less
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
