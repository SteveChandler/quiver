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

export function compareDiscoveryRecommendations(
  a: Pick<SurfDiscoveryRecommendation, 'score' | 'distanceMiles'>,
  b: Pick<SurfDiscoveryRecommendation, 'score' | 'distanceMiles'>
): number {
  const scoreDelta = b.score - a.score;
  if (Math.abs(scoreDelta) > DISTANCE_TIE_BREAKER_POINTS) {
    return scoreDelta;
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

  return scoreDelta;
}
