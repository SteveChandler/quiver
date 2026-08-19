/**
 * Tests for Scoring Engine
 *
 * Tests the orchestration of multiple scorer plugins.
 */

import {
  ScoringEngine,
  createScoringEngine,
  scoreWithPlugins,
  baseConditionsScorer,
  windQualityScorer,
  tideFitScorer,
} from '@/lib/domains/scoring';
import type { ScorerInput, ScorerPlugin, ScorerResult } from '@/lib/domains/scoring';
import type { ConditionsSnapshot } from '@/lib/domains/conditions';
import {
  createProfile,
  createSnapshot,
  createInput,
  createMockScorer,
} from '../__fixtures__';

describe('Scoring Engine', () => {
  describe('registration', () => {
    it('should register a single scorer', () => {
      const engine = new ScoringEngine();
      engine.register(baseConditionsScorer);

      expect(engine.getScorerNames()).toEqual(['baseConditions']);
    });

    it('should register multiple scorers', () => {
      const engine = new ScoringEngine();
      engine.registerAll([baseConditionsScorer, windQualityScorer, tideFitScorer]);

      expect(engine.getScorerNames()).toHaveLength(3);
      expect(engine.getScorerNames()).toContain('baseConditions');
      expect(engine.getScorerNames()).toContain('windQuality');
      expect(engine.getScorerNames()).toContain('tideFit');
    });

    it('should support chaining', () => {
      const engine = new ScoringEngine()
        .register(baseConditionsScorer)
        .register(windQualityScorer);

      expect(engine.getScorerNames()).toHaveLength(2);
    });
  });

  describe('scoring', () => {
    it('should return empty result when no scorers registered', () => {
      const engine = new ScoringEngine();
      const input = createInput();
      const result = engine.score(input);

      expect(result.total).toBe(0);
      expect(result.matchQuality).toBe('skip');
      expect(result.skipReason).toBe('No scorers registered');
    });

    it('should compute weighted average of scorer results', () => {
      const engine = new ScoringEngine();

      // Both score 80, equal weight = total 80
      engine.register(createMockScorer('scorer1', 80, 0.5));
      engine.register(createMockScorer('scorer2', 80, 0.5));

      const input = createInput();
      const result = engine.score(input);

      expect(result.total).toBe(80);
    });

    it('deduplicates structured effects when an early skip returns', () => {
      const duplicateEffect = {
        code: 'crossing_swells' as const,
        severity: 'material' as const,
        verdictCeiling: 65,
        message: 'Crossing swells creating choppy conditions',
      };
      const engine = new ScoringEngine();
      engine.register({
        name: 'skip-with-duplicate-effects',
        weight: 1,
        score: () => ({
          name: 'skip-with-duplicate-effects',
          score: 0,
          weight: 1,
          reasons: [],
          warnings: [duplicateEffect.message],
          skip: true,
          skipReason: duplicateEffect.message,
          effects: [duplicateEffect, duplicateEffect],
        }),
      });

      const result = engine.score(createInput());

      expect(result.effects).toEqual([duplicateEffect]);
      expect(result.warnings).toEqual([duplicateEffect.message]);
    });

    it('should normalize weights', () => {
      const engine = new ScoringEngine();

      // Scorer 1: score 100, weight 1
      // Scorer 2: score 50, weight 1
      // Total weight = 2, so normalized: 0.5 each
      // Result: 100*0.5 + 50*0.5 = 75
      engine.register(createMockScorer('scorer1', 100, 1));
      engine.register(createMockScorer('scorer2', 50, 1));

      const input = createInput();
      const result = engine.score(input);

      expect(result.total).toBe(75);
    });

    it('should track subscores', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('scorer1', 90, 0.5));
      engine.register(createMockScorer('scorer2', 70, 0.5));

      const input = createInput();
      const result = engine.score(input);

      expect(result.subscores.get('scorer1')).toBe(90);
      expect(result.subscores.get('scorer2')).toBe(70);
    });

    it('should aggregate reasons from all scorers', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('scorer1', 80, 0.5));
      engine.register(createMockScorer('scorer2', 80, 0.5));

      const input = createInput();
      const result = engine.score(input);

      expect(result.reasons).toContain('scorer1 reason');
      expect(result.reasons).toContain('scorer2 reason');
    });
  });

  describe('skip conditions', () => {
    it('should stop early when a scorer triggers skip', () => {
      const engine = new ScoringEngine();

      // First scorer triggers skip
      engine.register(createMockScorer('skipper', 0, 0.5, true));
      engine.register(createMockScorer('normal', 80, 0.5));

      const input = createInput();
      const result = engine.score(input);

      expect(result.matchQuality).toBe('skip');
      expect(result.skipReason).toBe('skipper skip reason');
      expect(result.total).toBe(0);
    });

    it('should include skip reason in warnings', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('skipper', 0, 0.5, true));

      const input = createInput();
      const result = engine.score(input);

      expect(result.warnings).toContain('skipper skip reason');
    });
  });

  describe('match quality classification', () => {
    it('should classify score >= 85 as perfect', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('high', 90, 1));

      const input = createInput();
      const result = engine.score(input);

      expect(result.matchQuality).toBe('perfect');
    });

    it('should classify score >= 70 as excellent', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('high', 75, 1));

      const input = createInput();
      const result = engine.score(input);

      expect(result.matchQuality).toBe('excellent');
    });

    it('should classify score >= 55 as good', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('mid', 60, 1));

      const input = createInput();
      const result = engine.score(input);

      expect(result.matchQuality).toBe('good');
    });

    it('should classify score >= 40 as fair', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('mid', 45, 1));

      const input = createInput();
      const result = engine.score(input);

      expect(result.matchQuality).toBe('fair');
    });

    it('should classify score < 40 as skip', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('low', 30, 1));

      const input = createInput();
      const result = engine.score(input);

      expect(result.matchQuality).toBe('skip');
    });
  });

  describe('error handling', () => {
    it('should continue with other scorers if one throws', () => {
      const engine = new ScoringEngine();

      const throwingScorer: ScorerPlugin = {
        name: 'thrower',
        weight: 0.5,
        score: () => {
          throw new Error('Test error');
        },
      };

      engine.register(throwingScorer);
      engine.register(createMockScorer('normal', 80, 0.5));

      const input = createInput();

      // Should not throw, should use remaining scorer
      const result = engine.score(input);
      expect(result.total).toBe(80);
    });
  });

  describe('convenience functions', () => {
    it('createScoringEngine should create empty engine', () => {
      const engine = createScoringEngine();
      expect(engine.getScorerNames()).toHaveLength(0);
    });

    it('scoreWithPlugins should score with provided plugins', () => {
      const input = createInput();
      const result = scoreWithPlugins(input, [
        createMockScorer('test1', 80, 0.5),
        createMockScorer('test2', 60, 0.5),
      ]);

      expect(result.total).toBe(70);
    });
  });

  describe('integration with real scorers', () => {
    it('should work with base conditions scorer', () => {
      const engine = createScoringEngine();
      engine.register(baseConditionsScorer);

      const input = createInput({ waveHeight: 4, wavePeriod: 14 });
      const result = engine.score(input);

      expect(result.total).toBeGreaterThanOrEqual(80);
      expect(result.subscores.has('baseConditions')).toBe(true);
    });

    it('should work with multiple real scorers', () => {
      const engine = createScoringEngine();
      engine.registerAll([baseConditionsScorer, windQualityScorer, tideFitScorer]);

      const input = createInput({
        waveHeight: 4,
        wavePeriod: 14,
        wind: { speedMph: 2, directionDeg: 90 },
        tide: { heightFt: 3, status: 'rising', direction: 'rising' },
      });

      const result = engine.score(input);

      expect(result.total).toBeGreaterThanOrEqual(70);
      expect(result.subscores.size).toBe(3);
    });
  });

  describe('wave-height ceiling (Workstream C)', () => {
    it('caps composite total at 55 for a 1.7ft otherwise-perfect snapshot', () => {
      const engine = new ScoringEngine();
      // High-confidence mock subscores simulating perfect alignment, wind,
      // and tide. Without the ceiling this would total ~100.
      engine.registerAll([
        createMockScorer('swellAlignment', 100, 0.15),
        createMockScorer('swellInterference', 100, 0.15),
        createMockScorer('windQuality', 100, 0.15),
        createMockScorer('tideDirection', 100, 0.15),
        createMockScorer('baseConditions', 100, 0.25),
        createMockScorer('tideFit', 100, 0.05),
        createMockScorer('windowStability', 100, 0.05),
        createMockScorer('trendPreference', 100, 0.05),
      ]);

      const input = createInput({ waveHeight: 1.7 });
      const result = engine.score(input);

      // 1.7ft falls in [1.5, 2.0) -> ceiling of 55
      expect(result.total).toBeLessThanOrEqual(55);
      // Subscores are preserved -- only the total is capped
      expect(result.subscores.get('swellAlignment')).toBe(100);
      expect(result.subscores.get('baseConditions')).toBe(100);
    });

    it('surfaces a "small wave caps score" reason when the ceiling applies', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('perfect', 100, 1));

      const input = createInput({ waveHeight: 1.7 });
      const result = engine.score(input);

      expect(
        result.reasons.some((r) => /caps score at 55/.test(r))
      ).toBe(true);
    });

    it('leaves large-wave composite totals unchanged', () => {
      const engine = new ScoringEngine();
      engine.registerAll([
        createMockScorer('swellAlignment', 95, 0.15),
        createMockScorer('swellInterference', 95, 0.15),
        createMockScorer('windQuality', 95, 0.15),
        createMockScorer('tideDirection', 90, 0.15),
        createMockScorer('baseConditions', 90, 0.25),
        createMockScorer('tideFit', 85, 0.05),
        createMockScorer('windowStability', 85, 0.05),
        createMockScorer('trendPreference', 85, 0.05),
      ]);

      const input = createInput({ waveHeight: 5.0 });
      const result = engine.score(input);

      // 5ft is uncapped (ceiling = 100). Composite should remain > 85.
      expect(result.total).toBeGreaterThan(85);
      expect(
        result.reasons.some((r) => /caps score/.test(r))
      ).toBe(false);
    });

    it('does not cap when waveHeight is NaN (preserves legacy behavior)', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('perfect', 100, 1));

      const input = createInput({ waveHeight: Number.NaN });
      const result = engine.score(input);

      expect(result.total).toBe(100);
      expect(
        result.reasons.some((r) => /caps score/.test(r))
      ).toBe(false);
    });

    it('applies the 75 ceiling to waist-high 2.5ft waves', () => {
      const engine = new ScoringEngine();
      engine.register(createMockScorer('perfect', 100, 1));

      const input = createInput({ waveHeight: 2.5 });
      const result = engine.score(input);

      expect(result.total).toBeLessThanOrEqual(75);
      expect(
        result.reasons.some((r) => /caps score at 75/.test(r))
      ).toBe(true);
    });
  });
});
