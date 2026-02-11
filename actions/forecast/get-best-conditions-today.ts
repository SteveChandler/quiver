"use server";

/**
 * Server action to fetch the best surf conditions for today.
 *
 * Used by the landing page conditions snapshot to display live forecast data
 * to anonymous visitors above the fold.
 *
 * @module actions/forecast/get-best-conditions-today
 */

import {
  getRegionalSummaries,
  getBestRegionToday,
} from "@/lib/utils/forecast-hub-utils";

export interface BestConditionsData {
  regionName: string;
  regionSlug: string;
  score: number;
  avgWaveHeight: number;
  waveRange: [number, number];
  windConditions: "offshore" | "light" | "onshore";
  topBeachName: string | null;
  swellDescription: string | null;
}

/**
 * Fetch the best regional surf conditions for today.
 *
 * Returns a lightweight payload with only the fields needed by
 * the landing page snapshot, avoiding serializing the full summary tree.
 */
export async function getBestConditionsToday(): Promise<BestConditionsData | null> {
  try {
    const summaries = await getRegionalSummaries();
    const best = getBestRegionToday(summaries);

    if (!best || !best.summary.days[0]) {
      return null;
    }

    const today = best.summary.days[0];

    return {
      regionName: best.region.name,
      regionSlug: best.region.slug,
      score: today.score,
      avgWaveHeight: today.avgWaveHeight,
      waveRange: today.waveRange,
      windConditions: today.windConditions,
      topBeachName: today.topBeaches[0]?.name ?? null,
      swellDescription: best.summary.upcomingSwells[0]?.description ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch best conditions for homepage:", error);
    return null;
  }
}
