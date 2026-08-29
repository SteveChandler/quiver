import { swellAlignmentScorer } from '@/lib/domains/scoring';
import { createSwellComponent } from '@/lib/domains/conditions';
import { createInput } from '../__fixtures__';

describe('Swell Alignment Scorer', () => {
  describe('groundswell (>=10s) — period gate is fully open', () => {
    it('scores an aligned 14s WNW swell highly', () => {
      const input = createInput(
        {
          waveDirection: 292.5,
          primarySwell: createSwellComponent(4, 14, 292.5),
        },
        { swellWindow: { minDeg: 220, maxDeg: 5, centerDeg: 292.5, halfWidthDeg: 72.5 } }
      );

      const result = swellAlignmentScorer.score(input);

      expect(result.score).toBe(100);
      expect(result.reasons[0]).toMatch(/Ideal swell direction/);
    });

    it('scores an off-axis 12s S swell as just-outside', () => {
      const input = createInput(
        {
          waveDirection: 180,
          primarySwell: createSwellComponent(3, 12, 180),
        },
        { swellWindow: { minDeg: 220, maxDeg: 5, centerDeg: 292.5, halfWidthDeg: 72.5 } }
      );

      const result = swellAlignmentScorer.score(input);

      // 12s + outside-window-but-close → moderate score, no period attenuation
      expect(result.score).toBeGreaterThan(20);
      expect(result.score).toBeLessThan(60);
    });
  });

  describe('short-period dominant (<10s) — period gate attenuates', () => {
    it('drops a "geometrically ideal" 6s W swell to a warning, not a positive reason', () => {
      const input = createInput(
        {
          waveDirection: 270,
          primarySwell: createSwellComponent(2, 6, 270),
        },
        { swellWindow: { minDeg: 220, maxDeg: 5, centerDeg: 292.5, halfWidthDeg: 72.5 } }
      );

      const result = swellAlignmentScorer.score(input);

      // Geometric score for W (270°) into a 220-5 window centered on 292.5
      // is in the inner-half band (~93). Multiplied by relevance(6s) = 0.30
      // → ~28. Far below the 60-point reasons threshold.
      expect(result.score).toBeLessThan(40);
      expect(result.reasons).toHaveLength(0);
      expect(result.warnings.some((w) => /short period/i.test(w))).toBe(true);
    });

    it('partially attenuates an aligned 8s swell', () => {
      const input = createInput(
        {
          waveDirection: 270,
          primarySwell: createSwellComponent(3, 8, 270),
        },
        { swellWindow: { minDeg: 220, maxDeg: 5, centerDeg: 292.5, halfWidthDeg: 72.5 } }
      );

      const result = swellAlignmentScorer.score(input);

      // ~93 geometric × 0.65 relevance ≈ 60. Right at the reasons threshold.
      expect(result.score).toBeGreaterThan(50);
      expect(result.score).toBeLessThan(75);
    });
  });

  describe('missing period — preserves pre-fix behavior', () => {
    it('returns geometric score unchanged when primarySwell is null', () => {
      const input = createInput(
        { primarySwell: null, waveDirection: 270 },
        { swellWindow: { minDeg: 220, maxDeg: 5, centerDeg: 292.5, halfWidthDeg: 72.5 } }
      );

      const result = swellAlignmentScorer.score(input);

      // No primarySwell → no period read → relevance defaults to 1.0
      expect(result.score).toBeGreaterThan(80);
    });
  });

  it('attenuates an aligned swell when local terrain blocks that direction', () => {
    const access = Array(72).fill(1);
    access[54] = 0.25;
    const input = createInput(
      { waveDirection: 270, primarySwell: createSwellComponent(4, 14, 270) },
      {
        swellWindow: { minDeg: 240, maxDeg: 300, centerDeg: 270, halfWidthDeg: 30 },
        swellAccessFactors: access,
      }
    );

    const result = swellAlignmentScorer.score(input);

    expect(result.score).toBe(25);
    expect(result.warnings).toContain('Ideal swell direction (W) but local terrain limits swell access');
  });
});
