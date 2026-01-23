/**
 * IOOS Station Scorer
 *
 * Ranks stations for selection based on:
 * - Freshness (most important)
 * - Data completeness
 * - Distance to beach
 * - Network priority
 */

import { IOOS_NETWORK_PRIORITY } from "@/lib/constants/ioos-config";

/**
 * Candidate station for ranking
 */
export interface StationCandidate {
  stationId: string;
  distanceKm: number;
  network: string;
  latestObservedAt: Date | null;
  hasWaveHeight: boolean;
  hasPeriod: boolean;
  hasDirection: boolean;
}

/**
 * Score a station for selection ranking
 * Higher score = better candidate
 *
 * Weights:
 * - Freshness: 0-1.0 (biggest factor)
 * - Completeness: 0-0.6 (Hs + period + direction)
 * - Distance: 0-0.2 (closer is better)
 * - Network: 0-0.3 (CDIP > NDBC > regional)
 */
export function scoreStation(candidate: StationCandidate, now: Date): number {
  let score = 0;

  // Freshness score (biggest weight)
  if (candidate.latestObservedAt) {
    const ageHours = (now.getTime() - candidate.latestObservedAt.getTime()) / 3600_000;
    if (ageHours <= 2) {
      score += 1.0;
    } else if (ageHours <= 6) {
      score += 0.5;
    } else if (ageHours <= 12) {
      score += 0.1;
    }
    // >12h gets 0
  }

  // Completeness score
  if (candidate.hasWaveHeight) score += 0.3;
  if (candidate.hasPeriod) score += 0.18;      // 0.3 * 0.6
  if (candidate.hasDirection) score += 0.12;  // 0.3 * 0.4

  // Distance score (inverse, capped at 150km)
  const distanceScore = Math.max(0, 1 - candidate.distanceKm / 150);
  score += distanceScore * 0.2;

  // Network bonus
  const networkBonus = IOOS_NETWORK_PRIORITY[candidate.network] ?? 0;
  score += networkBonus;

  return score;
}

/**
 * Rank stations by score (descending)
 */
export function rankStations(
  candidates: StationCandidate[],
  now: Date = new Date()
): Array<StationCandidate & { score: number }> {
  return candidates
    .map(c => ({ ...c, score: scoreStation(c, now) }))
    .sort((a, b) => b.score - a.score);
}
