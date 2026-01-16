/**
 * Tests for shared angle utilities.
 */

import {
  normalizeAngle,
  angleDifference,
  directionName,
} from '@/lib/domains/shared/angle-utils';

describe('angle-utils', () => {
  describe('normalizeAngle', () => {
    it('should return same value for angles in 0-360 range', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(180)).toBe(180);
      expect(normalizeAngle(270)).toBe(270);
      expect(normalizeAngle(359)).toBe(359);
    });

    it('should normalize negative angles', () => {
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-180)).toBe(180);
      expect(normalizeAngle(-270)).toBe(90);
      expect(normalizeAngle(-360)).toBe(0);
      expect(normalizeAngle(-450)).toBe(270);
    });

    it('should normalize angles greater than 360', () => {
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(450)).toBe(90);
      expect(normalizeAngle(720)).toBe(0);
      expect(normalizeAngle(810)).toBe(90);
    });

    it('should handle edge cases', () => {
      expect(normalizeAngle(359.9)).toBeCloseTo(359.9);
      expect(normalizeAngle(0.1)).toBeCloseTo(0.1);
    });
  });

  describe('angleDifference', () => {
    it('should return 0 for same angles', () => {
      expect(angleDifference(0, 0)).toBe(0);
      expect(angleDifference(90, 90)).toBe(0);
      expect(angleDifference(180, 180)).toBe(0);
    });

    it('should return 180 for opposite angles', () => {
      expect(angleDifference(0, 180)).toBe(180);
      expect(angleDifference(90, 270)).toBe(180);
      expect(angleDifference(45, 225)).toBe(180);
    });

    it('should return shorter arc for angles crossing 0/360', () => {
      expect(angleDifference(10, 350)).toBe(20);
      expect(angleDifference(350, 10)).toBe(20);
      expect(angleDifference(5, 355)).toBe(10);
    });

    it('should handle angles in any range', () => {
      expect(angleDifference(-90, 90)).toBe(180);
      expect(angleDifference(450, 90)).toBe(0);
      expect(angleDifference(-180, 180)).toBe(0);
    });

    it('should return correct difference for typical swell directions', () => {
      // South swell vs SSW swell (typical CA comparison)
      expect(angleDifference(180, 200)).toBe(20);
      // West swell vs NW swell
      expect(angleDifference(270, 315)).toBe(45);
    });
  });

  describe('directionName', () => {
    it('should return correct cardinal directions', () => {
      expect(directionName(0)).toBe('N');
      expect(directionName(90)).toBe('E');
      expect(directionName(180)).toBe('S');
      expect(directionName(270)).toBe('W');
    });

    it('should return correct intercardinal directions', () => {
      expect(directionName(45)).toBe('NE');
      expect(directionName(135)).toBe('SE');
      expect(directionName(225)).toBe('SW');
      expect(directionName(315)).toBe('NW');
    });

    it('should return correct 16-point directions', () => {
      expect(directionName(22.5)).toBe('NNE');
      expect(directionName(67.5)).toBe('ENE');
      expect(directionName(112.5)).toBe('ESE');
      expect(directionName(157.5)).toBe('SSE');
      expect(directionName(202.5)).toBe('SSW');
      expect(directionName(247.5)).toBe('WSW');
      expect(directionName(292.5)).toBe('WNW');
      expect(directionName(337.5)).toBe('NNW');
    });

    it('should round to nearest cardinal point', () => {
      // Just under NNE boundary (11.25)
      expect(directionName(10)).toBe('N');
      // Just over NNE boundary
      expect(directionName(12)).toBe('NNE');
    });

    it('should handle boundary at 360/0', () => {
      expect(directionName(350)).toBe('N');
      expect(directionName(360)).toBe('N');
    });

    it('should handle non-normalized angles', () => {
      expect(directionName(-90)).toBe('W');
      expect(directionName(450)).toBe('E');
    });

    it('should return Unknown for NaN', () => {
      expect(directionName(NaN)).toBe('Unknown');
    });

    it('should return Unknown for null', () => {
      expect(directionName(null)).toBe('Unknown');
    });

    it('should return Unknown for undefined', () => {
      expect(directionName(undefined)).toBe('Unknown');
    });

    it('should return Unknown for Infinity', () => {
      expect(directionName(Infinity)).toBe('Unknown');
      expect(directionName(-Infinity)).toBe('Unknown');
    });
  });
});
