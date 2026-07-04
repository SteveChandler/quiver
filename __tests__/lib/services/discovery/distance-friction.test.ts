import {
  calculateDistancePenalty,
  compareDiscoveryRecommendations,
  DISTANCE_FRICTION_MAX_PENALTY,
  DISTANCE_TIE_BREAKER_POINTS,
} from '@/lib/services/discovery/distance-friction';

describe('distance friction', () => {
  it('is free inside the 10-mile home zone', () => {
    expect(calculateDistancePenalty(0)).toBe(0);
    expect(calculateDistancePenalty(10)).toBe(0);
  });

  it('applies -0.2 points per mile beyond 10 miles', () => {
    expect(calculateDistancePenalty(35)).toBe(-5);
  });

  it('caps the penalty at -10 points by 60 miles', () => {
    expect(calculateDistancePenalty(60)).toBe(-DISTANCE_FRICTION_MAX_PENALTY);
    expect(calculateDistancePenalty(100)).toBe(-DISTANCE_FRICTION_MAX_PENALTY);
  });

  it('uses distance as the tie-breaker within 3 score points', () => {
    const near = { score: 73, distanceMiles: 3 };
    const far = { score: 75, distanceMiles: 35 };

    expect(Math.abs(far.score - near.score)).toBeLessThanOrEqual(
      DISTANCE_TIE_BREAKER_POINTS
    );
    expect(compareDiscoveryRecommendations(near, far)).toBeLessThan(0);
  });

  it('keeps score primary outside the tie-breaker band', () => {
    const near = { score: 70, distanceMiles: 3 };
    const far = { score: 75, distanceMiles: 35 };

    expect(compareDiscoveryRecommendations(near, far)).toBeGreaterThan(0);
  });
});
