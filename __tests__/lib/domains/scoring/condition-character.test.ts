/**
 * @jest-environment node
 *
 * Tests for getConditionCharacter() — domain-engine port of the
 * legacy qualitative condition classifier.
 *
 * Mirrors `__tests__/lib/scoring/condition-character.test.ts` exactly —
 * same scenarios, same expected category + label strings — so we can
 * verify behaviour preservation between the two implementations.
 *
 * Tests are grouped by priority order (first match wins):
 *   skip → flat → small → medium → large → fallback
 */

import { getConditionCharacter } from '@/lib/domains/scoring/condition-character';
import type { CompositeScore } from '@/lib/domains/scoring';
import type { SpotProfile } from '@/lib/domains/spot-profile';
import type { ConditionsSnapshot } from '@/lib/domains/conditions';
import { createProfile, createSnapshot, createSwell } from '../__fixtures__';

/**
 * Build a CompositeScore stub with just the subscore Map values
 * the classifier reads (windQuality + tideFit, both 0-100).
 *
 * Translation from legacy 0-20 / 0-15 subscores:
 *   - windAlignment = 18/20 → windQuality = 90
 *   - windAlignment = 14/20 (legacy "good" threshold) → windQuality = 70
 *   - tideFit = 12/15 → tideFit = 80
 *   - tideFit = 11/15 (legacy "good" threshold) → tideFit = ~73
 */
function makeComposite(subscores: { windQuality?: number; tideFit?: number } = {}): CompositeScore {
  const map = new Map<string, number>();
  if (subscores.windQuality !== undefined) map.set('windQuality', subscores.windQuality);
  if (subscores.tideFit !== undefined) map.set('tideFit', subscores.tideFit);

  return {
    total: 0,
    subscores: map,
    matchQuality: 'fair',
    reasons: [],
    warnings: [],
    skipReason: null,
    confidence: 80,
  };
}

// Mirror the legacy beach config: E offshore, 45° tol, max wind 25/10,
// SW swell window centered at 260° with 30° halfwidth.
const profile: SpotProfile = createProfile({
  windThresholds: {
    offshoreDeg: 90,
    offshoreToleranceDeg: 45,
    maxOnshoreMph: 10,
    maxAnyMph: 25,
    crossShoreOkKts: 15,
  },
  tidePreferences: {
    minHeightFt: 1.5,
    maxHeightFt: 5.0,
    preferredDirection: 'either',
    directionSensitivity: 'medium',
  },
  swellWindow: {
    minDeg: 230,
    maxDeg: 290,
    centerDeg: 260,
    halfWidthDeg: 30,
  },
});

// Good-conditions baseline: wind=18/20≈90, tide=12/15=80
const baseComposite = makeComposite({ windQuality: 90, tideFit: 80 });

// Baseline snapshot: 1.5ft / 12s / 5mph offshore (E) / 3ft tide / SW swell (260°)
const baseSnapshot: ConditionsSnapshot = createSnapshot({
  timestamp: new Date('2026-01-14T08:00:00Z'),
  waveHeight: 1.5,
  wavePeriod: 12,
  waveDirection: 260,
  primarySwell: createSwell(1.5, 12, 260),
  wind: { speedMph: 5, directionDeg: 90 }, // Offshore
  tide: { heightFt: 3.0, status: 'rising', direction: 'rising' },
});

describe('getConditionCharacter (domain engine port)', () => {
  describe('skip conditions', () => {
    it('classifies skip when composite carries a blown-out skipReason', () => {
      // PR 4: skip ownership moved from this classifier to windQualityScorer's
      // tier table. Composite arrives with skipReason set; classifier reads
      // it directly instead of re-deriving thresholds.
      const snap = createSnapshot({ ...baseSnapshot, wind: { speedMph: 28, directionDeg: 90 } });
      const composite: CompositeScore = {
        ...baseComposite,
        skipReason: 'Blown out (28 mph offshore)',
      };
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('skip');
      expect(result.label).toMatch(/blown out/i);
    });

    it('classifies skip when composite carries an onshore-blown-out skipReason', () => {
      const snap = createSnapshot({ ...baseSnapshot, wind: { speedMph: 25, directionDeg: 270 } });
      const composite: CompositeScore = {
        ...baseComposite,
        skipReason: 'Blown out (25 mph onshore)',
      };
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('skip');
      expect(result.label).toMatch(/onshore/i);
    });
  });

  describe('flat conditions', () => {
    it('classifies < 0.5ft as flat', () => {
      const snap = createSnapshot({ ...baseSnapshot, waveHeight: 0.3 });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('flat');
      expect(result.label.length).toBeGreaterThan(0);
    });

    it('classifies 0ft as flat', () => {
      const snap = createSnapshot({ ...baseSnapshot, waveHeight: 0 });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('flat');
    });
  });

  describe('small wave conditions (0.5-2ft)', () => {
    it('classifies 1.5ft + 14s + ideal direction as small-quality with "powerful" label', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.5,
        wavePeriod: 14,
        waveDirection: 260,
        primarySwell: createSwell(1.5, 14, 260),
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-quality');
      expect(result.label).toMatch(/powerful/i);
    });

    it('classifies 1.5ft + 14s + 45° off ideal direction as small-quality with "push" label', () => {
      // 215° is 45° from window center 260°; halfwidth 30 → outside, decay 15/75 → 0.8 fit
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.5,
        wavePeriod: 14,
        waveDirection: 215,
        primarySwell: createSwell(1.5, 14, 215),
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-quality');
      expect(result.label).toMatch(/push/i);
    });

    it('classifies 1.5ft + light wind (<5mph) + good tide as small-clean with "clean" or "glassy" label', () => {
      // wave direction 100° is far from window center 260°; with halfwidth 30°,
      // diff = ~160°, decay over 75° → fit clamps to 0 → not small-quality
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.5,
        wavePeriod: 10,
        waveDirection: 100,
        primarySwell: createSwell(1.5, 10, 100),
        wind: { speedMph: 3, directionDeg: 90 },
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-clean');
      expect(result.label.toLowerCase()).toMatch(/clean|glassy/);
    });

    it('classifies 1.5ft + onshore 5-10mph as small-weak with "choppy" label', () => {
      // 270° wind = W = onshore; speed 7 > 5 (not skip — < maxOnshore=10)
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.5,
        wavePeriod: 9,
        wind: { speedMph: 7, directionDeg: 270 },
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-weak');
      expect(result.label).toMatch(/choppy/i);
    });

    it('classifies 1.5ft + period < 8s as small-weak with "Weak" label', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.5,
        wavePeriod: 6,
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-weak');
      expect(result.label).toMatch(/weak/i);
    });

    it('classifies 1.8ft + 10s + ideal direction + light wind as small-quality (≥10s threshold)', () => {
      // Reviewer-flagged scenario: a 10s long-period swell with perfect
      // direction at a small spot used to fall through to small-weak under
      // the legacy ≥12s threshold. Aligning with large-clean's ≥10s gate
      // (and adding the !isOnshore guard) promotes it correctly.
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.8,
        wavePeriod: 10,
        waveDirection: 260,
        primarySwell: createSwell(1.8, 10, 260),
        wind: { speedMph: 4, directionDeg: 90 },
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-quality');
      expect(result.label).toMatch(/long-period/i);
    });

    it('does NOT promote 1.8ft + 10s + ideal direction + onshore wind to small-quality', () => {
      // Onshore guard: a long-period small swell with onshore wind
      // is still chop, regardless of direction fit underneath.
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 1.8,
        wavePeriod: 10,
        waveDirection: 260,
        primarySwell: createSwell(1.8, 10, 260),
        wind: { speedMph: 8, directionDeg: 270 }, // W = onshore
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      expect(result.category).toBe('small-weak');
      expect(result.label).toMatch(/choppy/i);
    });
  });

  describe('medium wave conditions (2-5ft)', () => {
    it('classifies 3ft + 12s + offshore + good tide as medium-clean with "Dialed" label', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 3.5,
        wavePeriod: 12,
        wind: { speedMph: 5, directionDeg: 90 },
      });
      // Wind 18/20 → 90; tide 13/15 ≈ 87 — both above 70 thresholds
      const composite = makeComposite({ windQuality: 90, tideFit: 87 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('medium-clean');
      expect(result.label).toMatch(/dialed/i);
    });

    it('classifies 3ft + mixed wind as medium-mixed', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 3.0,
        wavePeriod: 9,
        wind: { speedMph: 10, directionDeg: 200 },
      });
      // Legacy: windAlignment=10/20 (50%), tideFit=10/15 (~67%)
      // → translated: windQuality=50, tideFit=67 — both below thresholds
      const composite = makeComposite({ windQuality: 50, tideFit: 67 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('medium-mixed');
    });

    it('classifies 3ft + bad wind (windQuality < 30) as medium-rough (PR 4)', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 3.0,
        wavePeriod: 8,
        wind: { speedMph: 18, directionDeg: 270 },
      });
      // 18 mph onshore at 3 ft / 8 s lands in choppy/poor tier from the
      // wind scorer (~22 score). The new medium-rough bucket should fire.
      const composite = makeComposite({ windQuality: 22, tideFit: 60 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('medium-rough');
      expect(result.label).toMatch(/wind-affected|choppy|mixed/i);
    });
  });

  describe('large wave conditions (5ft+)', () => {
    it('classifies 6ft + offshore + 12s as large-clean with "Firing" label', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 6.0,
        wavePeriod: 12,
        wind: { speedMph: 5, directionDeg: 90 },
      });
      // Legacy: windAlignment=18/20 (90%) → translated windQuality=90 (>= 60)
      const composite = makeComposite({ windQuality: 90, tideFit: 80 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('large-clean');
      expect(result.label).toMatch(/firing/i);
    });

    it('classifies 6ft + strong wind as large-rough', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 6.0,
        wavePeriod: 10,
        wind: { speedMph: 18, directionDeg: 200 },
      });
      // Legacy: windAlignment=8/20 (40%) → translated windQuality=40 (< 60)
      const composite = makeComposite({ windQuality: 40, tideFit: 67 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('large-rough');
    });

    it('classifies 7ft + 8s + glassy offshore as large-rough (short-period stormy big)', () => {
      // Reviewer verification scenario: short-period + clean-wind big surf
      // is still wind-swell territory, not groundswell. Even with a 98
      // windQuality (clean offshore), period < 10s lands large-rough →
      // "experts only" → recommendationLabel gates to "Maybe".
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 7.0,
        wavePeriod: 8,
        wind: { speedMph: 5, directionDeg: 90 },
      });
      const composite = makeComposite({ windQuality: 98, tideFit: 80 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('large-rough');
      expect(result.label).toMatch(/experts only/i);
    });
  });

  describe('fallback behavior', () => {
    it('always returns a valid category and non-empty label', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 2.5,
        wavePeriod: 8,
        wind: { speedMph: 12, directionDeg: 200 },
      });
      const result = getConditionCharacter(snap, profile, baseComposite);
      const validCategories = [
        'flat',
        'small-weak',
        'small-quality',
        'small-clean',
        'medium-clean',
        'medium-mixed',
        'medium-rough',
        'large-clean',
        'large-rough',
        'skip',
      ];
      expect(validCategories).toContain(result.category);
      expect(result.label.length).toBeGreaterThan(0);
    });
  });

  describe('threshold translation correctness', () => {
    it('windQuality just above 70 (legacy 14/20) → medium-clean when paired with good tide and 10s+ period', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 3,
        wavePeriod: 10,
      });
      const composite = makeComposite({ windQuality: 70, tideFit: 73 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('medium-clean');
    });

    it('windQuality 69 (just below 70) → medium-mixed', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 3,
        wavePeriod: 12,
      });
      const composite = makeComposite({ windQuality: 69, tideFit: 90 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('medium-mixed');
    });

    it('windQuality 60 (legacy 12/20) → large-clean for big clean swell', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 6,
        wavePeriod: 12,
      });
      const composite = makeComposite({ windQuality: 60, tideFit: 50 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('large-clean');
    });

    it('windQuality 59 → large-rough', () => {
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 6,
        wavePeriod: 12,
      });
      const composite = makeComposite({ windQuality: 59, tideFit: 50 });
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('large-rough');
    });

    it('returns medium-rough when subscores Map is missing windQuality / tideFit keys', () => {
      // PR 4: missing windQuality falls back to 0, which is < the new rough
      // threshold (30). Pre-PR 4 the missing keys meant "unknown — assume
      // mixed"; the new tier table makes this stricter so a forecast row
      // that fails to populate windQuality lands in the rough bucket and
      // gets gated by the recommendation-label character set.
      const snap = createSnapshot({
        ...baseSnapshot,
        waveHeight: 3,
        wavePeriod: 12,
      });
      const composite = makeComposite({}); // empty subscores Map
      const result = getConditionCharacter(snap, profile, composite);
      expect(result.category).toBe('medium-rough');
    });
  });
});
