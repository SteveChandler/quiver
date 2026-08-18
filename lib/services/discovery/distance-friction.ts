import type { SurfDiscoveryRecommendation } from '@/types/personalization';

export const DISTANCE_FRICTION_HOME_ZONE_MILES = 10;
export const DISTANCE_FRICTION_PENALTY_PER_MILE = 0.2;
export const DISTANCE_FRICTION_MAX_PENALTY = 10;
export const DISTANCE_TIE_BREAKER_POINTS = 3;
export const WORTH_THE_DRIVE_DISTANCE_MILES = 25;
export const WORTH_THE_DRIVE_REASON = 'Worth the drive — best conditions in range';

export function calculateDistancePenalty(distanceMiles?: number): number {
  if (distanceMiles === undefined || !Number.isFinite(distanceMiles)) {
    return 0;
  }

  const penalizedMiles = Math.max(
    0,
    distanceMiles - DISTANCE_FRICTION_HOME_ZONE_MILES
  );

  const penalty = Math.min(
    DISTANCE_FRICTION_MAX_PENALTY,
    penalizedMiles * DISTANCE_FRICTION_PENALTY_PER_MILE
  );

  return penalty === 0 ? 0 : -penalty;
}

/**
 * Ordering value: the internal ranking score when present, else the displayed
 * condition score. `score` is condition-only and clamped at 100, so ranking on
 * it directly would re-create the artificial ties this split removed.
 */
function orderingScore(
  rec: Pick<SurfDiscoveryRecommendation, 'score' | 'rankingScore'>
): number {
  return typeof rec.rankingScore === 'number' && Number.isFinite(rec.rankingScore)
    ? rec.rankingScore
    : rec.score;
}

export function compareDiscoveryRecommendations(
  a: Pick<SurfDiscoveryRecommendation, 'score' | 'rankingScore' | 'distanceMiles'>,
  b: Pick<SurfDiscoveryRecommendation, 'score' | 'rankingScore' | 'distanceMiles'>
): number {
  const aScore = orderingScore(a);
  const bScore = orderingScore(b);
  // Quantize score into bands of width DISTANCE_TIE_BREAKER_POINTS so that
  // "within N points" is an equivalence class on each item (transitive),
  // then break ties by distance. Comparing raw a.score-b.score for the
  // tie decision is non-transitive and violates Array.sort's contract.
  const bandA = Math.floor(aScore / DISTANCE_TIE_BREAKER_POINTS);
  const bandB = Math.floor(bScore / DISTANCE_TIE_BREAKER_POINTS);
  if (bandA !== bandB) {
    return bandB - bandA; // higher score band first
  }

  const aDistance = Number.isFinite(a.distanceMiles)
    ? (a.distanceMiles as number)
    : Number.POSITIVE_INFINITY;
  const bDistance = Number.isFinite(b.distanceMiles)
    ? (b.distanceMiles as number)
    : Number.POSITIVE_INFINITY;

  const distanceDelta = aDistance - bDistance;
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  return bScore - aScore; // final stable tiebreak: exact ranking score
}
