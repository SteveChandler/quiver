/**
 * Tests for Horizon Strip utility functions
 */

import {
  getConditionTier,
  formatWaveRange,
  getTierLabel,
  TIER_COLORS,
  type ConditionTier,
} from '@/lib/utils/horizon-strip-utils';

describe('horizon-strip-utils', () => {
  describe('getConditionTier', () => {
    it('returns "great" for scores >= 80', () => {
      expect(getConditionTier(80)).toBe('great');
      expect(getConditionTier(90)).toBe('great');
      expect(getConditionTier(100)).toBe('great');
    });

    it('returns "good" for scores 60-79', () => {
      expect(getConditionTier(60)).toBe('good');
      expect(getConditionTier(70)).toBe('good');
      expect(getConditionTier(79)).toBe('good');
    });

    it('returns "fair" for scores 40-59', () => {
      expect(getConditionTier(40)).toBe('fair');
      expect(getConditionTier(50)).toBe('fair');
      expect(getConditionTier(59)).toBe('fair');
    });

    it('returns "marginal" for scores < 40', () => {
      expect(getConditionTier(0)).toBe('marginal');
      expect(getConditionTier(20)).toBe('marginal');
      expect(getConditionTier(39)).toBe('marginal');
    });

    it('handles edge cases', () => {
      expect(getConditionTier(-10)).toBe('marginal');
      expect(getConditionTier(150)).toBe('great');
    });
  });

  describe('formatWaveRange', () => {
    it('formats range correctly when min and max differ', () => {
      expect(formatWaveRange(2, 4)).toBe('2-4ft');
      expect(formatWaveRange(1.2, 3.8)).toBe('1-4ft');
    });

    it('formats single value when min equals max', () => {
      expect(formatWaveRange(3, 3)).toBe('3ft');
      expect(formatWaveRange(2.4, 2.6)).toBe('2-3ft'); // Rounds differently
    });

    it('returns "Flat" when both are zero', () => {
      expect(formatWaveRange(0, 0)).toBe('Flat');
    });

    it('returns "Flat" when both are negative', () => {
      expect(formatWaveRange(-1, -1)).toBe('Flat');
    });
  });

  describe('getTierLabel', () => {
    it('returns correct labels for each tier', () => {
      expect(getTierLabel('great')).toBe('Great conditions');
      expect(getTierLabel('good')).toBe('Good conditions');
      expect(getTierLabel('fair')).toBe('Fair conditions');
      expect(getTierLabel('marginal')).toBe('Marginal conditions');
    });
  });

  describe('TIER_COLORS', () => {
    const tiers: ConditionTier[] = ['great', 'good', 'fair', 'marginal'];

    it('has all required color properties for each tier', () => {
      for (const tier of tiers) {
        expect(TIER_COLORS[tier]).toHaveProperty('bg');
        expect(TIER_COLORS[tier]).toHaveProperty('border');
        expect(TIER_COLORS[tier]).toHaveProperty('text');
        expect(TIER_COLORS[tier]).toHaveProperty('badge');
      }
    });

    it('uses Tailwind class format', () => {
      for (const tier of tiers) {
        expect(TIER_COLORS[tier].bg).toMatch(/^bg-/);
        expect(TIER_COLORS[tier].border).toMatch(/^border-/);
        expect(TIER_COLORS[tier].text).toMatch(/^text-/);
      }
    });

    it('uses appropriate semantic colors', () => {
      // Great should be amber/gold
      expect(TIER_COLORS.great.bg).toContain('amber');

      // Good should be green/emerald
      expect(TIER_COLORS.good.bg).toContain('emerald');

      // Fair should be blue
      expect(TIER_COLORS.fair.bg).toContain('blue');

      // Marginal should be slate/gray
      expect(TIER_COLORS.marginal.bg).toContain('slate');
    });
  });
});
