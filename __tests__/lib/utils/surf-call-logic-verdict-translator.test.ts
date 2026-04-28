/**
 * @jest-environment node
 *
 * Verdict translator unit tests — covers each branch of the
 * recommendationLabel → SurfCallVerdict mapping.
 *
 * The translator is the single source of truth for the legacy
 * 'YES'/'MAYBE'/'NO' shape that native consumes. Keep this isolated
 * from the broader `computeSurfCall` integration so a future native
 * migration can update it independently.
 */
import { verdictFromRecommendationLabel } from '@/lib/utils/surf-call-logic';

describe('verdictFromRecommendationLabel', () => {
  it("maps 'Worth it' to 'YES'", () => {
    expect(verdictFromRecommendationLabel('Worth it')).toBe('YES');
  });

  it("maps 'Maybe' to 'MAYBE'", () => {
    expect(verdictFromRecommendationLabel('Maybe')).toBe('MAYBE');
  });

  it("maps 'Skip' to 'NO'", () => {
    expect(verdictFromRecommendationLabel('Skip')).toBe('NO');
  });
});
