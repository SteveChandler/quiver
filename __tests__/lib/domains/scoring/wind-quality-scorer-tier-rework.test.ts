/**
 * Wind Quality Scorer — Tier Rework Spec (PR 4 of the consolidation plan)
 *
 * STATUS: Pre-staged TDD scaffold. ALL DESCRIBE BLOCKS USE `describe.skip`.
 * The PR 4 implementer MUST un-skip these (search for `describe.skip` in this
 * file) before claiming the tier rework is done. They are red until the
 * `windQualityScorer` is rewritten to the 6-tier table + wave-height penalty
 * modifier + period modifier per the research-cited memo at
 * ~/.claude/plans/image-2-nothing-about-transient-bunny.md.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 6-tier wind-quality table (median of 16 cited surf-forecasting sources —
 * Surfline, Surf Captain, Surfer Today, Watersport Geek, Foam Mag, Gathering
 * Waves, NOAA Beaufort, Cornish Wave, Boardcave, Wikipedia, Academy of Surfing
 * Instructors, Ohana Surf Project, Surfer.com):
 *
 *   Tier               | Cutoff                                        | Mult
 *   -------------------|-----------------------------------------------|-----
 *   Glassy             | ≤ 3 mph, any direction                        | 1.00
 *   Clean offshore     | 3–15 mph offshore (component ≥ 70%)           | 1.00
 *   Light onshore/cross| 3–8 mph onshore or sideshore                  | 0.75
 *   Textured / fair    | 8–15 mph onshore-or-cross OR 15–22 mph offsh. | 0.50
 *   Choppy / poor      | 15–22 mph onshore-or-cross OR 22–30 mph offsh.| 0.20
 *   Blown out          | ≥ 22 mph onshore-or-cross OR ≥ 30 mph offsh.  | 0.00
 *
 * Wave-height penalty modifier (universal across sources):
 *   penaltyMultiplier = clamp(1.5 − 0.1 × waveHeightFt, 0.5, 1.5)
 *   Applied to (1 − tierMultiplier) so small waves are degraded harder by the
 *   same wind. So a textured/fair tier (mult 0.50) at 1 ft has effective
 *   penalty 0.50 × 1.4 = 0.70, resulting score 30/100; same tier at 10 ft has
 *   penalty 0.50 × 0.5 = 0.25, resulting score 75/100.
 *
 * Period modifier (optional; documented in memo):
 *   period < 10s : add 0.10 to penalty (down a tier on the boundary)
 *   period ≥ 14s: subtract 0.05 from penalty (long-period groundswell resists
 *                 wind degradation per Boardcave + Wikipedia)
 *
 * Sideshore = worst geometry at the same speed (Surf Captain). Treat sideshore
 * STRICTER than onshore, not equal — flip from today's `crossShore: 0.7`
 * vs `onshore: 0.3` ranking, which the research disagrees with.
 *
 * Skip-gate replacement: today's binary skip on `windSpeed > maxOnshoreMph`
 * is replaced with a continuous penalty until the Blown-out tier (≥22 mph
 * onshore/cross or ≥30 mph offshore). This matches the user's screenshot
 * scenario where OB Pier @ NW 12 mph silently disappeared via skip; new
 * model surfaces it as "Small & choppy" with a Maybe verdict.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Default test profile (west-facing beach break, offshore = 90° E):
 *   - Wind from 90°  (E)  → pure offshore
 *   - Wind from 270° (W)  → pure onshore
 *   - Wind from 0°   (N)  → cross-shore (90° from offshore)
 *   - Wind from 315° (NW) → cross-onshore biased (the SoCal afternoon scenario)
 */

import { windQualityScorer } from '@/lib/domains/scoring';
import { createInput } from '../__fixtures__';

// Direction shorthand for readability
const OFFSHORE = 90;       // E
const ONSHORE = 270;       // W
const CROSS_N = 0;         // N — pure cross-shore
const CROSS_NW = 315;      // NW — cross-onshore biased (Horseshoe screenshot wind)

describe.skip('Wind Quality Scorer — 6-tier rework (PR 4)', () => {
  // ─── Tier 1: Glassy ────────────────────────────────────────────────────
  describe('Tier 1 — Glassy (≤3 mph, any direction)', () => {
    it.each([
      ['1 mph offshore', 1, OFFSHORE],
      ['1 mph onshore', 1, ONSHORE],
      ['3 mph cross-shore', 3, CROSS_N],
    ])('scores ~100 at %s', (_label, speedMph, directionDeg) => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph, directionDeg } }),
      );
      expect(result.score).toBeGreaterThanOrEqual(95);
      expect(result.skip).toBe(false);
    });
  });

  // ─── Tier 2: Clean offshore ────────────────────────────────────────────
  describe('Tier 2 — Clean offshore (3–15 mph offshore)', () => {
    it.each([
      ['5 mph offshore', 5],
      ['10 mph offshore', 10],
      ['15 mph offshore', 15],
    ])('scores ≥85 at %s', (_label, speedMph) => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph, directionDeg: OFFSHORE } }),
      );
      expect(result.score).toBeGreaterThanOrEqual(85);
    });
  });

  // ─── Tier 3: Light onshore/cross (3–8 mph) ─────────────────────────────
  describe('Tier 3 — Light onshore/cross (3–8 mph)', () => {
    it.each([
      ['5 mph onshore', 5, ONSHORE],
      ['7 mph cross-shore', 7, CROSS_N],
    ])('scores 65–80 at %s on average wave height (4 ft)', (_label, speedMph, directionDeg) => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph, directionDeg }, waveHeight: 4 }),
      );
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThanOrEqual(85);
    });
  });

  // ─── Tier 4: Textured / fair (8–15 onshore-or-cross OR 15–22 offshore) ─
  describe('Tier 4 — Textured/fair', () => {
    it('scores ~50 at 12 mph cross-shore on 4 ft', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 4 }),
      );
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(60);
    });

    it('scores ~50 at 12 mph onshore on 4 ft', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: ONSHORE }, waveHeight: 4 }),
      );
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(60);
    });

    it('scores 50–70 at 18 mph offshore (textured for offshore tier)', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 18, directionDeg: OFFSHORE }, waveHeight: 4 }),
      );
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThanOrEqual(70);
    });
  });

  // ─── Tier 5: Choppy / poor ─────────────────────────────────────────────
  describe('Tier 5 — Choppy/poor', () => {
    it('scores ≤30 at 18 mph onshore on 4 ft', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 18, directionDeg: ONSHORE }, waveHeight: 4 }),
      );
      expect(result.score).toBeLessThanOrEqual(30);
      // Continuous penalty, NOT binary skip. PR 4 spec.
      expect(result.skip).toBe(false);
    });

    it('scores ≤30 at 18 mph cross-shore on 4 ft', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 18, directionDeg: CROSS_N }, waveHeight: 4 }),
      );
      expect(result.score).toBeLessThanOrEqual(30);
      expect(result.skip).toBe(false);
    });
  });

  // ─── Tier 6: Blown out ─────────────────────────────────────────────────
  describe('Tier 6 — Blown out (≥22 mph onshore-or-cross OR ≥30 mph offshore)', () => {
    it('skips at 25 mph onshore', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 25, directionDeg: ONSHORE } }),
      );
      expect(result.skip).toBe(true);
    });

    it('skips at 22 mph cross-shore (sideshore-strict)', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 22, directionDeg: CROSS_N } }),
      );
      expect(result.skip).toBe(true);
    });

    it('skips at 32 mph offshore', () => {
      const result = windQualityScorer.score(
        createInput({ wind: { speedMph: 32, directionDeg: OFFSHORE } }),
      );
      expect(result.skip).toBe(true);
    });
  });

  // ─── Wave-height penalty modifier ──────────────────────────────────────
  describe('Wave-height penalty modifier', () => {
    // For the SAME 12 mph cross-shore wind (Tier 4 textured/fair, mult 0.50):
    //   1 ft  → penalty 1.4× → score ≈ 30
    //   5 ft  → penalty 1.0× → score ≈ 50
    //   10 ft → penalty 0.5× → score ≈ 75
    it('hits small waves harder (12 mph cross on 1 ft scores < same wind on 5 ft)', () => {
      const small = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 1 }),
      );
      const medium = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 5 }),
      );
      expect(small.score).toBeLessThan(medium.score - 10);
    });

    it('barely affects large waves (12 mph cross on 10 ft scores > same wind on 5 ft)', () => {
      const medium = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 5 }),
      );
      const large = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 10 }),
      );
      expect(large.score).toBeGreaterThan(medium.score + 10);
    });

    it('penalty multiplier clamps at [0.5, 1.5] (no infinite degradation at 0 ft)', () => {
      const tinyWaves = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 0 }),
      );
      // Even with the harshest penalty (1.5× of the 0.5 base penalty = 0.75),
      // the resulting score should not go below 25 (1 - 0.75 = 0.25 → 25/100).
      expect(tinyWaves.score).toBeGreaterThanOrEqual(20);
    });
  });

  // ─── Period modifier (optional but documented in spec) ─────────────────
  describe('Period modifier', () => {
    it('long-period (≥14s) groundswell resists wind chop better than wind swell (<10s)', () => {
      // Same 12 mph cross-shore + 4 ft, but different periods
      const windSwell = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 4, wavePeriod: 8 }),
      );
      const groundSwell = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 4, wavePeriod: 16 }),
      );
      expect(groundSwell.score).toBeGreaterThan(windSwell.score);
    });
  });

  // ─── Sideshore penalty (research disagrees with today's "cross > onshore") ─
  describe('Sideshore-strict semantics (Surf Captain: worst geometry)', () => {
    it('treats 12 mph cross-shore at LEAST as harsh as 12 mph onshore (today is opposite)', () => {
      const cross = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: CROSS_N }, waveHeight: 4 }),
      );
      const onshore = windQualityScorer.score(
        createInput({ wind: { speedMph: 12, directionDeg: ONSHORE }, waveHeight: 4 }),
      );
      // Tolerance: PR 4 may equalise rather than strictly invert. Either OK.
      expect(cross.score).toBeLessThanOrEqual(onshore.score + 5);
    });
  });

  // ─── Real-world reproduction: the Horseshoe screenshot scenario ────────
  describe('Real-world: Horseshoe screenshot scenario (memo §What the score actually computes)', () => {
    // 2.3 ft / 13s / NW 10 mph at Horseshoe (offshore=45°NE, tol=30°).
    // Old engine: ~84/100 → "Worth it" → NOW FIRING fired in production.
    // New engine target: still in ~75 range (long-period 13s + ideal 2-3 ft band)
    // BUT character-gated verdict at PR 4 prevents NOW FIRING regardless of score.
    // This test asserts ONLY the wind subscore — full verdict gate is in
    // condition-character.test.ts (medium-rough tier introduced in PR 4).
    it('Horseshoe NW 10mph @ 2.3ft / 13s: cross-shore wind score in 60–85 range (not bottomed)', () => {
      const result = windQualityScorer.score(
        createInput(
          { wind: { speedMph: 10, directionDeg: CROSS_NW }, waveHeight: 2.3, wavePeriod: 13 },
          { windThresholds: {
              offshoreDeg: 45, // Horseshoe DB value
              offshoreToleranceDeg: 30,
              maxOnshoreMph: 10,
              maxAnyMph: 18,
              crossShoreOkKts: 15,
            } },
        ),
      );
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThanOrEqual(85);
    });

    it('OB Pier NW 12mph @ 1.4ft / 6s: gets a real number (NOT a binary skip)', () => {
      const result = windQualityScorer.score(
        createInput(
          { wind: { speedMph: 12, directionDeg: CROSS_NW }, waveHeight: 1.4, wavePeriod: 6 },
          { windThresholds: {
              offshoreDeg: 90, // OB Pier DB value
              offshoreToleranceDeg: 45,
              maxOnshoreMph: 10,
              maxAnyMph: 18,
              crossShoreOkKts: 15,
            } },
        ),
      );
      // Old engine: SKIP (12 > maxOnshoreMph 10). New engine: continuous penalty.
      expect(result.skip).toBe(false);
      // Small wave + onshore + short period → low score, but NOT zero.
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(40);
    });
  });
});
