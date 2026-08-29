/**
 * Tests for Wind Quality Scorer (post-PR 4 6-tier rework).
 *
 * The legacy break-type-aware divisor scoring was replaced with the research-
 * cited 6-tier table + wave-height penalty modifier + period modifier. This
 * file covers the day-to-day behaviour invariants of the new model. The
 * tier-table edge cases live in `wind-quality-scorer-tier-rework.test.ts`.
 */

import { windQualityScorer } from '@/lib/domains/scoring';
import { createInput } from '../__fixtures__';

describe('Wind Quality Scorer', () => {
  describe('glassy conditions', () => {
    it('should give perfect score for glassy conditions (< 3 mph)', () => {
      const input = createInput({ wind: { speedMph: 2, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBe(100);
      expect(result.reasons).toContain('Glassy conditions');
      expect(result.skip).toBe(false);
    });
  });

  describe('offshore wind', () => {
    it('should score offshore wind highly', () => {
      // East wind (90°) is offshore for west-facing beach (offshore = 90°)
      const input = createInput({ wind: { speedMph: 8, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.reasons).toContain('Clean offshore wind');
    });

    it('should slightly degrade high offshore wind', () => {
      const input = createInput({ wind: { speedMph: 15, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      // Still in the clean-offshore tier at 15 mph but mildly nudged down
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('cross-shore wind', () => {
    it('should score cross-shore wind moderately', () => {
      // North wind (0°) is cross-shore (sideshore) for west-facing beach
      const input = createInput({ wind: { speedMph: 8, directionDeg: 0 } });
      const result = windQualityScorer.score(input);

      // 8 mph crosses into the textured-fair tier (>= 8 mph onshore-or-cross).
      // At 4 ft default + 12s default the score lands in the 30-60 band.
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThanOrEqual(70);
    });

    it('should warn about side-shore wind at 8mph+', () => {
      const input = createInput({ wind: { speedMph: 12, directionDeg: 0 } });
      const result = windQualityScorer.score(input);

      expect(result.warnings).toContain('Side-shore wind');
    });
  });

  describe('onshore wind', () => {
    it('should score onshore wind poorly', () => {
      // West wind (270°) is onshore for west-facing beach
      const input = createInput({ wind: { speedMph: 8, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      // 8 mph onshore lands at the textured-fair boundary; not great but
      // not crushed either.
      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.warnings).toContain('Onshore wind');
    });

    it('should NOT skip 12 mph onshore (continuous penalty replaces binary gate)', () => {
      // Pre-PR 4 this skipped because 12 > maxOnshoreMph (10). New tier
      // table says 12 mph onshore is "Textured/fair" (8-15 mph) — continuous
      // penalty, not skip.
      const input = createInput({ wind: { speedMph: 12, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      expect(result.skip).toBe(false);
      expect(result.score).toBeGreaterThan(0);
      expect(result.warnings).toContain('Onshore wind');
    });

    it('should skip blown-out onshore wind (>= 22 mph)', () => {
      const input = createInput({ wind: { speedMph: 25, directionDeg: 270 } });
      const result = windQualityScorer.score(input);

      expect(result.skip).toBe(true);
      expect(result.skipReason).toMatch(/blown out/i);
    });
  });

  describe('skip conditions', () => {
    it('should skip blown-out offshore wind (>= 30 mph)', () => {
      const input = createInput({ wind: { speedMph: 32, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      expect(result.skip).toBe(true);
      expect(result.skipReason).toMatch(/blown out/i);
    });

    it('should NOT skip 25 mph offshore (still in choppy/poor tier)', () => {
      // Pre-PR 4 the legacy `maxAnyMph=18` gate would have skipped this.
      // New tier table allows offshore up to 30 mph.
      const input = createInput({ wind: { speedMph: 25, directionDeg: 90 } });
      const result = windQualityScorer.score(input);

      expect(result.skip).toBe(false);
    });
  });

  describe('unknown wind direction', () => {
    it('should return moderate score when wind direction unknown', () => {
      const input = createInput({ wind: { speedMph: 8, directionDeg: null } });
      const result = windQualityScorer.score(input);

      expect(result.score).toBe(50);
      expect(result.warnings).toContain('Wind direction unknown');
    });
  });

  describe('scorer metadata', () => {
    it('should have correct name', () => {
      expect(windQualityScorer.name).toBe('windQuality');
    });

    it('should have correct weight', () => {
      expect(windQualityScorer.weight).toBe(0.15);
    });
  });

  describe('wave-height awareness (small waves degrade harder)', () => {
    it('penalises 12 mph cross-shore harder on 1 ft than on 5 ft', () => {
      const small = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: 0 }, waveHeight: 1 }),
      );
      const medium = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: 0 }, waveHeight: 5 }),
      );
      expect(small.score).toBeLessThan(medium.score);
    });
  });

  describe('period awareness (groundswells resist wind)', () => {
    it('scores 13s+ groundswell higher than 8s wind-swell at the same wind', () => {
      const windSwell = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: 0 }, wavePeriod: 8 }),
      );
      const groundSwell = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: 0 }, wavePeriod: 16 }),
      );
      expect(groundSwell.score).toBeGreaterThan(windSwell.score);
    });
  });

  it('uses local terrain exposure to reduce effective wind speed', () => {
    const exposure = Array(72).fill(1);
    exposure[54] = 0.2;
    const sheltered = windQualityScorer.score(createInput(
      { wind: { speedMph: 20, directionDeg: 270 } },
      { windExposureFactors: exposure }
    ));
    const exposed = windQualityScorer.score(createInput(
      { wind: { speedMph: 20, directionDeg: 270 } }
    ));

    expect(sheltered.score).toBeGreaterThan(exposed.score);
  });

  describe('edge cases', () => {
    it('should handle null breakType gracefully', () => {
      const input = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: null },
      );
      expect(() => windQualityScorer.score(input)).not.toThrow();
      expect(windQualityScorer.score(input).score).toBeGreaterThan(0);
    });

    it('should handle undefined breakType gracefully', () => {
      const input = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: undefined },
      );
      expect(() => windQualityScorer.score(input)).not.toThrow();
    });

    it('break-type does not affect tier resolution (PR 4: tier table is universal)', () => {
      // The legacy break-type divisor matrix is gone — tier table applies
      // uniformly. Reef vs beach should now score identically for the same
      // wind/wave inputs.
      const beachInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'beach' },
      );
      const reefInput = createInput(
        { wind: { speedMph: 8, directionDeg: 0 } },
        { breakType: 'reef' },
      );
      expect(windQualityScorer.score(beachInput).score).toBe(
        windQualityScorer.score(reefInput).score,
      );
    });
  });
});
