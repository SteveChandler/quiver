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

  it('uses distance as the tie-breaker within the same score band', () => {
    const near = { score: 73, distanceMiles: 3 };
    const far = { score: 74, distanceMiles: 35 };

    expect(Math.floor(near.score / DISTANCE_TIE_BREAKER_POINTS)).toBe(
      Math.floor(far.score / DISTANCE_TIE_BREAKER_POINTS)
    );
    expect(compareDiscoveryRecommendations(near, far)).toBeLessThan(0);
  });

  it('keeps score band primary outside the tie-breaker band', () => {
    const near = { score: 70, distanceMiles: 3 };
    const far = { score: 75, distanceMiles: 35 };

    expect(compareDiscoveryRecommendations(near, far)).toBeGreaterThan(0);
  });

  it('sorts the old A/B/C cycle case consistently with antisymmetric comparisons', () => {
    const farHighScore = { id: 'a', score: 10, distanceMiles: 60 };
    const middleMidScore = { id: 'b', score: 8, distanceMiles: 20 };
    const nearLowScore = { id: 'c', score: 6, distanceMiles: 2 };
    const items = [middleMidScore, nearLowScore, farHighScore];

    expect([...items].sort(compareDiscoveryRecommendations).map((item) => item.id)).toEqual([
      'a',
      'c',
      'b',
    ]);

    const invalidComparisons: Array<{
      left: string;
      right: string;
      leftToRight: number;
      rightToLeft: number;
    }> = [];

    for (const left of items) {
      for (const right of items) {
        const leftToRight = Math.sign(compareDiscoveryRecommendations(left, right));
        const rightToLeft = Math.sign(compareDiscoveryRecommendations(right, left));

        const isValid =
          left === right
            ? leftToRight === 0 && rightToLeft === 0
            : leftToRight === -rightToLeft;

        if (!isValid) {
          invalidComparisons.push({
            left: left.id,
            right: right.id,
            leftToRight,
            rightToLeft,
          });
        }
      }
    }

    expect(invalidComparisons).toEqual([]);
  });
});
