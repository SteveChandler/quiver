import { swellInterferenceScorer } from '@/lib/domains/scoring';
import { createSwellComponent } from '@/lib/domains/conditions';
import { createInput } from '../__fixtures__';

describe('Swell Interference Scorer', () => {
  describe('clean single swell — relevance gate applies', () => {
    it('scores a 14s clean single swell at 100', () => {
      const input = createInput({
        primarySwell: createSwellComponent(4, 14, 270),
        secondarySwell: null,
      });

      const result = swellInterferenceScorer.score(input);

      expect(result.score).toBe(100);
      expect(result.reasons).toContain('Clean single swell');
    });

    it('attenuates a 6s clean single swell and drops the positive reason', () => {
      const input = createInput({
        primarySwell: createSwellComponent(2, 6, 270),
        secondarySwell: null,
      });

      const result = swellInterferenceScorer.score(input);

      // 100 × relevance(6s) = 100 × 0.30 = 30
      expect(result.score).toBe(30);
      expect(result.reasons).toHaveLength(0);
    });

    it('partially attenuates an 8s clean single swell', () => {
      const input = createInput({
        primarySwell: createSwellComponent(3, 8, 270),
        secondarySwell: null,
      });

      const result = swellInterferenceScorer.score(input);

      // 100 × 0.65 = 65 — below the 70-pt reasons threshold
      expect(result.score).toBe(65);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('negligible secondary (< 10% energy) — relevance gate applies', () => {
    it('scores a 14s dominant primary with small secondary at ~95', () => {
      const input = createInput({
        // Primary energy: 4²×14 = 224. Secondary energy needs to be <10% (<22.4):
        // 1ft × 8s = 8 → ratio 8/(224+8) ≈ 3.4% < 10% threshold
        primarySwell: createSwellComponent(4, 14, 270),
        secondarySwell: createSwellComponent(1, 8, 200),
      });

      const result = swellInterferenceScorer.score(input);

      expect(result.score).toBe(95);
      expect(result.reasons).toContain('Dominant primary swell');
    });

    it('attenuates the same shape when the dominant is 6s wind chop', () => {
      const input = createInput({
        // Primary 2ft × 6s = 24 energy; secondary 0.5ft × 4s = 1 → ratio < 10%
        primarySwell: createSwellComponent(2, 6, 270),
        secondarySwell: createSwellComponent(0.5, 4, 200),
      });

      const result = swellInterferenceScorer.score(input);

      // 95 × 0.30 = 28.5 → 29
      expect(result.score).toBe(29);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('analyzed two-swell path — relevance gate applies', () => {
    it('emits a material structured effect for crossing secondary energy above 10%', () => {
      const result = swellInterferenceScorer.score(createInput({
        primarySwell: createSwellComponent(4, 14, 270),
        secondarySwell: createSwellComponent(2, 10, 0),
      }));

      expect(result.warnings).toContain('Crossing swells creating choppy conditions');
      expect(result.effects).toEqual([
        expect.objectContaining({
          code: 'crossing_swells',
          severity: 'material',
          verdictCeiling: 65,
        }),
      ]);
    });

    it('does not attenuate an aligned 12s + 12s pair', () => {
      const input = createInput({
        primarySwell: createSwellComponent(3, 12, 270),
        secondarySwell: createSwellComponent(2, 12, 280),
      });

      const result = swellInterferenceScorer.score(input);

      // Aligned swells, period 12s → relevance 1.0, geometric high
      expect(result.score).toBeGreaterThan(80);
    });

    it('attenuates a short-period two-swell scenario', () => {
      const input = createInput({
        // Both 6s — wind chop with itself
        primarySwell: createSwellComponent(2, 6, 270),
        secondarySwell: createSwellComponent(1.5, 6, 280),
      });

      const result = swellInterferenceScorer.score(input);

      // Whatever geometric score the analyser produces, multiplied by 0.30
      expect(result.score).toBeLessThan(40);
    });
  });
});
