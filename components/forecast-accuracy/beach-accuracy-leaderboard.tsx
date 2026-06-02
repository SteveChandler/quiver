"use client";

/**
 * BeachAccuracyLeaderboard
 *
 * Client component — ranked table of top beaches by Quiver improvement %.
 * Shows 5 rows initially with a "Show More" button to reveal the rest.
 * Columns: Beach Name (linked), NOAA Error, Quiver Error, Improvement %, Predictions.
 * The Predictions column is hidden on mobile to reduce horizontal overflow.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { ForecastAccuracyConfidence } from "@/actions/ml/forecast-accuracy-actions";
import { AccuracySourceConfidenceBadge } from "./accuracy-source-confidence-badge";

export interface LeaderboardBeachRow {
  beachId: string;
  beachName: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  rawMae?: number | null;
  correctedMae?: number | null;
  maeImprovementPct?: number | null;
  predictionsMatched?: number | null;
  noaaBaselineMae?: number | null;
  quiverMae?: number | null;
  improvementPct?: number | null;
  validatedPairCount?: number | null;
  lastUpdated?: string | null;
  confidence?: ForecastAccuracyConfidence;
  canClaimImprovement?: boolean;
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Last updated pending";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Last updated pending";
  return `Last updated ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
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

function noaaMae(beach: LeaderboardBeachRow): number | null {
  return beach.noaaBaselineMae ?? beach.rawMae ?? null;
}

function quiverMae(beach: LeaderboardBeachRow): number | null {
  return beach.quiverMae ?? beach.correctedMae ?? null;
}

function improvementPct(beach: LeaderboardBeachRow): number | null {
  return beach.improvementPct ?? beach.maeImprovementPct ?? null;
}

function validatedPairs(beach: LeaderboardBeachRow): number | null {
  return beach.validatedPairCount ?? beach.predictionsMatched ?? null;
}

export function BeachAccuracyLeaderboard({ beaches }: BeachAccuracyLeaderboardProps) {
  const { track } = useTrackEvent();
  const [expanded, setExpanded] = useState(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (hasTrackedView.current || beaches.length === 0) return;

    hasTrackedView.current = true;
    const topBeach = beaches[0];
    void track("forecast_accuracy_table_viewed", {
      metadata: {
        surface: "forecast_accuracy",
        row_count: beaches.length,
        claimable_row_count: beaches.filter(
          (beach) => beach.canClaimImprovement === true
        ).length,
        ...(topBeach?.beachId ? { top_beach_id: topBeach.beachId } : {}),
        ...(topBeach?.slug ? { top_beach_slug: topBeach.slug } : {}),
      },
      debounceMs: 5000,
    });
  }, [beaches, track]);

  if (beaches.length === 0) return null;

  const visibleBeaches = expanded ? beaches : beaches.slice(0, INITIAL_COUNT);
  const hasMore = beaches.length > INITIAL_COUNT;
  const maxImprovement = Math.max(
    1,
    ...beaches
      .map((beach) => improvementPct(beach))
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
            Rows only claim lift when validated-pair and MAE checks pass.
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
                  NOAA baseline
                </th>
                <th className="px-4 py-3 text-right font-black text-[#5F5646]">
                  Quiver MAE
                </th>
                <th className="min-w-[120px] px-4 py-3 text-right font-black text-[#5F5646]">
                  Result
                </th>
                <th className="hidden px-4 py-3 text-right font-black text-[#5F5646] md:table-cell">
                  Validated pairs
                </th>
                <th className="hidden px-4 py-3 text-left font-black text-[#5F5646] lg:table-cell">
                  Confidence
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
                      <span className="mt-0.5 block text-xs font-semibold text-[#5F5646]">
                        {formatDate(beach.lastUpdated)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#5F5646]">
                      {formatMae(noaaMae(beach))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#5F5646]">
                      {formatMae(quiverMae(beach))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[#11100D]/10 sm:block">
                          <div
                            className="h-full rounded-full bg-[#008A7A]"
                            style={{ width: improvementBarWidth(improvementPct(beach), maxImprovement) }}
                          />
                        </div>
                        <span
                          className={
                            beach.canClaimImprovement === false
                              ? "font-black text-[#C0521B]"
                              : "font-black text-[#008A7A]"
                          }
                        >
                          {beach.canClaimImprovement === false
                            ? "No lift yet"
                            : formatImprovement(improvementPct(beach))}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs font-semibold text-[#5F5646] md:table-cell">
                      {isFiniteMetric(validatedPairs(beach))
                        ? validatedPairs(beach)!.toLocaleString("en-US")
                        : "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {beach.confidence ? (
                        <AccuracySourceConfidenceBadge
                          confidence={beach.confidence}
                          className="bg-[#0B3A75] text-[#F4EBD8]"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-[#5F5646]">
                          Low - sparse data
                        </span>
                      )}
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
