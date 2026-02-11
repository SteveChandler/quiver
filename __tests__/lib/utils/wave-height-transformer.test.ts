import {
  transformToFaceHeight,
  transformToFaceHeightRange,
  calculatePeriodFactor,
  calculateDirectionFactor,
  getTransformationFactors,
  BASE_SHOALING,
  PERIOD_REF,
  PERIOD_MULT,
  PERIOD_FACTOR_MIN,
  PERIOD_FACTOR_MAX,
  DIRECTION_FACTOR_MIN,
  DIRECTION_FACTOR_RANGE,
  SET_WAVE_VARIANCE,
  type BeachTerrainConfig,
  type TransformParams,
} from '@/lib/utils/wave-height-transformer';
import { TERRAIN_BINS } from '@/types/terrain';
import {
  createMockBeach,
  createAccessArray,
} from './test-helpers/wave-height-test-utils';

describe('Wave Height Transformer', () => {
  describe('Constants', () => {
    it('should have correct constant values', () => {
      expect(BASE_SHOALING).toBe(1.0);
      expect(PERIOD_REF).toBe(10);
      expect(PERIOD_MULT).toBe(0.05);
      expect(PERIOD_FACTOR_MIN).toBe(0.8);
      expect(PERIOD_FACTOR_MAX).toBe(1.2);
      expect(DIRECTION_FACTOR_MIN).toBe(0.6);
      expect(DIRECTION_FACTOR_RANGE).toBe(0.4);
      expect(SET_WAVE_VARIANCE).toBe(1.5);
    });
  });

  describe('calculatePeriodFactor', () => {
    it('should return 1.0 for reference period (10s)', () => {
      expect(calculatePeriodFactor(10)).toBe(1.0);
    });

    it('should return 1.0 for null period (defaults to reference)', () => {
      expect(calculatePeriodFactor(null)).toBe(1.0);
    });

    it('should calculate correctly for short periods', () => {
      // 8s: 1.0 + (8 - 10) * 0.05 = 1.0 - 0.1 = 0.9
      expect(calculatePeriodFactor(8)).toBeCloseTo(0.9, 5);
      // 6s: 1.0 + (6 - 10) * 0.05 = 1.0 - 0.2 = 0.8
      expect(calculatePeriodFactor(6)).toBeCloseTo(0.8, 5);
    });

    it('should calculate correctly for long periods (clamped at 1.2)', () => {
      // 12s: 1.0 + (12 - 10) * 0.05 = 1.1
      expect(calculatePeriodFactor(12)).toBeCloseTo(1.1, 5);
      // 14s: 1.0 + (14 - 10) * 0.05 = 1.2 (at max)
      expect(calculatePeriodFactor(14)).toBeCloseTo(1.2, 5);
      // 16s: would be 1.3, clamped to 1.2
      expect(calculatePeriodFactor(16)).toBeCloseTo(1.2, 5);
      // 18s: would be 1.4, clamped to 1.2
      expect(calculatePeriodFactor(18)).toBeCloseTo(1.2, 5);
    });

    it('should clamp at minimum (0.8)', () => {
      // 2s: would be 0.6, but clamped to 0.8
      expect(calculatePeriodFactor(2)).toBe(0.8);
      expect(calculatePeriodFactor(0)).toBe(0.8);
      expect(calculatePeriodFactor(-5)).toBe(0.8);
    });

    it('should clamp at maximum (1.2)', () => {
      // 14s: 1.0 + (14 - 10) * 0.05 = 1.2
      expect(calculatePeriodFactor(14)).toBe(1.2);
      // 16s: would be 1.3, but clamped to 1.2
      expect(calculatePeriodFactor(16)).toBe(1.2);
      // 20s: would be 1.5, but clamped to 1.2
      expect(calculatePeriodFactor(20)).toBe(1.2);
      // 25s: clamped to 1.2
      expect(calculatePeriodFactor(25)).toBe(1.2);
    });
  });

  describe('calculateDirectionFactor', () => {
    it('should return 1.0 when direction is null', () => {
      const beach = createMockBeach(1.0);
      expect(calculateDirectionFactor(null, beach)).toBe(1.0);
    });

    it('should return 1.0 when beach is null', () => {
      expect(calculateDirectionFactor(180, null)).toBe(1.0);
    });

    it('should return 1.0 when terrain_enabled is false', () => {
      const beach = {
        terrain_enabled: false,
        swell_access_factors: createAccessArray(1.0),
      };
      expect(calculateDirectionFactor(180, beach)).toBe(1.0);
    });

    it('should return 1.0 when swell_access_factors is null', () => {
      const beach = {
        terrain_enabled: true,
        swell_access_factors: null,
      };
      expect(calculateDirectionFactor(180, beach)).toBe(1.0);
    });

    it('should return 1.0 when swell_access_factors has wrong length', () => {
      const beach = {
        terrain_enabled: true,
        swell_access_factors: [1, 2, 3], // Wrong length
      };
      expect(calculateDirectionFactor(180, beach)).toBe(1.0);
    });

    it('should calculate 1.0 for full access (access = 1.0)', () => {
      const beach = createMockBeach(1.0);
      // 0.6 + 1.0 * 0.4 = 1.0
      expect(calculateDirectionFactor(180, beach)).toBe(1.0);
    });

    it('should calculate 0.6 for no access (access = 0.0)', () => {
      const beach = createMockBeach(0.0);
      // 0.6 + 0.0 * 0.4 = 0.6
      expect(calculateDirectionFactor(180, beach)).toBe(0.6);
    });

    it('should calculate 0.8 for half access (access = 0.5)', () => {
      const beach = createMockBeach(0.5);
      // 0.6 + 0.5 * 0.4 = 0.8
      expect(calculateDirectionFactor(180, beach)).toBe(0.8);
    });

    it('should map direction to correct bin', () => {
      // 0 degrees -> bin 0
      // 90 degrees -> bin 18
      // 180 degrees -> bin 36
      // 270 degrees -> bin 54

      // Set bin 36 (180 degrees) to have full access
      const accessArray = createAccessArray(0.0);
      accessArray[36] = 1.0;
      const beach: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: accessArray,
      };

      expect(calculateDirectionFactor(0, beach)).toBe(0.6); // bin 0 = 0
      expect(calculateDirectionFactor(180, beach)).toBe(1.0); // bin 36 = 1.0
      expect(calculateDirectionFactor(270, beach)).toBe(0.6); // bin 54 = 0
    });

    it('should clamp access values to [0, 1]', () => {
      // Test with out-of-range access values
      const accessArray = createAccessArray(0.5);
      accessArray[36] = 1.5; // Out of range high
      accessArray[0] = -0.5; // Out of range low
      const beach: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: accessArray,
      };

      // Clamped 1.5 -> 1.0: 0.6 + 1.0 * 0.4 = 1.0
      expect(calculateDirectionFactor(180, beach)).toBe(1.0);
      // Clamped -0.5 -> 0.0: 0.6 + 0.0 * 0.4 = 0.6
      expect(calculateDirectionFactor(0, beach)).toBe(0.6);
    });
  });

  describe('transformToFaceHeight', () => {
    describe('Base shoaling only (no period/direction modifiers)', () => {
      it('should apply base shoaling factor', () => {
        // 2.0ft @ 10s (reference period), no direction/terrain
        // 2.0 * 1.0 * 1.0 * 1.0 = 2.0ft
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(2.0);
      });

      it('should round to 1 decimal place', () => {
        // 1.55ft @ 10s = 1.55 * 1.0 = 1.55, rounded to 1.6
        const result = transformToFaceHeight({
          rawHeightFt: 1.55,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(1.6);
      });
    });

    describe('Period amplification', () => {
      it('should amplify for long period swell (clamped at 1.2x)', () => {
        // 2.0ft @ 16s: 2.0 * 1.0 * 1.2 (clamped) = 2.4ft
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 16,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBeCloseTo(2.4, 1);
      });

      it('should reduce for short period wind chop', () => {
        // 2.0ft @ 6s: 2.0 * 1.0 * 0.8 = 1.6ft
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 6,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBeCloseTo(1.6, 1);
      });

      it('should use reference period when null', () => {
        // 2.0ft @ null (10s): 2.0 * 1.0 * 1.0 = 2.0
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: null,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(2.0);
      });
    });

    describe('Direction factor with terrain', () => {
      it('should apply full direction factor for good access', () => {
        // 2.0ft @ 10s, direction factor 1.0: 2.0 * 1.0 * 1.0 * 1.0 = 2.0
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 10,
          swellDirectionDeg: 180,
          beach: createMockBeach(1.0),
        });
        expect(result).toBe(2.0);
      });

      it('should apply reduced direction factor for blocked access', () => {
        // 2.0ft @ 10s, direction factor 0.6: 2.0 * 1.0 * 1.0 * 0.6 = 1.2
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 10,
          swellDirectionDeg: 180,
          beach: createMockBeach(0.0),
        });
        expect(result).toBeCloseTo(1.2, 1);
      });

      it('should ignore direction factor when terrain disabled', () => {
        // Even with blocked access, disabled terrain = factor 1.0
        const beach = {
          terrain_enabled: false,
          swell_access_factors: Array(TERRAIN_BINS).fill(0.0),
        };
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 10,
          swellDirectionDeg: 180,
          beach,
        });
        expect(result).toBe(2.0);
      });
    });

    describe('Combined factors - realistic scenarios', () => {
      it('should calculate example: 3.5ft @ 14s with good SW access', () => {
        // 3.5ft @ 14s, good access (1.0):
        // period factor = 1.2 (at max)
        // 3.5 * 1.0 * 1.2 * 1.0 = 4.2
        const result = transformToFaceHeight({
          rawHeightFt: 3.5,
          periodS: 14,
          swellDirectionDeg: 225, // SW
          beach: createMockBeach(1.0),
        });
        expect(result).toBe(4.2);
      });

      it('should calculate scenario: 3.4ft @ 14.3s produces ~4.1ft', () => {
        // 3.4ft @ 14.3s, no terrain:
        // period factor = 1.0 + (14.3 - 10) * 0.05 = 1.215, clamped to 1.2
        // 3.4 * 1.0 * 1.2 * 1.0 = 4.08, rounded to 4.1
        const result = transformToFaceHeight({
          rawHeightFt: 3.4,
          periodS: 14.3,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBeCloseTo(4.1, 1);
      });

      it('should calculate reported bug scenario: 3.4ft @ 14.3s should produce ~4.1ft', () => {
        // Bug report: Database shows 3.4 ft when Surfline shows 6-8 ft
        // 3.4ft @ 14.3s, no terrain:
        // period factor = 1.0 + (14.3 - 10) * 0.05 = 1.215, clamped to 1.2
        // 3.4 * 1.0 * 1.2 * 1.0 = 4.08, rounded to 4.1
        // Note: BASE_SHOALING reduced from 1.6 to 1.0 to align with raw model data
        const result = transformToFaceHeight({
          rawHeightFt: 3.4,
          periodS: 14.3,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBeCloseTo(4.1, 1);
      });

      it('should calculate moderate swell with partial blocking', () => {
        // 3.0ft @ 14s, half access (0.5):
        // direction factor = 0.6 + 0.5 * 0.4 = 0.8
        // period factor = 1.0 + (14-10) * 0.05 = 1.2
        // 3.0 * 1.0 * 1.2 * 0.8 = 2.88, rounded to 2.9
        const result = transformToFaceHeight({
          rawHeightFt: 3.0,
          periodS: 14,
          swellDirectionDeg: 270,
          beach: createMockBeach(0.5),
        });
        expect(result).toBeCloseTo(2.9, 1);
      });

      it('should handle short period wind chop with poor access', () => {
        // 1.5ft @ 7s, no access (0.0):
        // direction factor = 0.6
        // period factor = 1.0 + (7-10) * 0.05 = 0.85
        // 1.5 * 1.0 * 0.85 * 0.6 = 0.765, rounded to 0.8
        const result = transformToFaceHeight({
          rawHeightFt: 1.5,
          periodS: 7,
          swellDirectionDeg: 315,
          beach: createMockBeach(0.0),
        });
        expect(result).toBeCloseTo(0.8, 1);
      });
    });

    describe('Edge cases', () => {
      it('should handle zero height', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 0,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(0);
      });

      it('should handle very small heights', () => {
        // 0.1ft @ 10s = 0.1 * 1.0 = 0.1
        const result = transformToFaceHeight({
          rawHeightFt: 0.1,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(0.1);
      });

      it('should handle large heights', () => {
        // 10ft @ 20s = 10 * 1.0 * 1.2 (clamped) = 12.0
        const result = transformToFaceHeight({
          rawHeightFt: 10,
          periodS: 20,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(12.0);
      });

      it('should return 0 for negative heights', () => {
        const result = transformToFaceHeight({
          rawHeightFt: -2.0,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(0);
      });

      it('should return 0 for NaN height', () => {
        const result = transformToFaceHeight({
          rawHeightFt: NaN,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(0);
      });

      it('should return 0 for Infinity height', () => {
        const result = transformToFaceHeight({
          rawHeightFt: Infinity,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(0);
      });

      it('should return 0 for negative Infinity height', () => {
        const result = transformToFaceHeight({
          rawHeightFt: -Infinity,
          periodS: 10,
          swellDirectionDeg: null,
          beach: null,
        });
        expect(result).toBe(0);
      });
    });
  });

  describe('getTransformationFactors', () => {
    it('should return all transformation factors', () => {
      const params: TransformParams = {
        rawHeightFt: 2.0,
        periodS: 14,
        swellDirectionDeg: null,
        beach: null,
      };

      const factors = getTransformationFactors(params);

      expect(factors.rawHeightFt).toBe(2.0);
      expect(factors.baseShoaling).toBe(1.0);
      expect(factors.periodFactor).toBeCloseTo(1.2, 5);
      expect(factors.directionFactor).toBe(1.0);
      // 2.0 * 1.0 * 1.2 * 1.0 = 2.4
      expect(factors.faceHeightFt).toBe(2.4);
    });

    it('should include direction factor when terrain available', () => {
      const params: TransformParams = {
        rawHeightFt: 2.0,
        periodS: 10,
        swellDirectionDeg: 180,
        beach: {
          terrain_enabled: true,
          swell_access_factors: Array(TERRAIN_BINS).fill(0.5),
        },
      };

      const factors = getTransformationFactors(params);

      expect(factors.directionFactor).toBe(0.8); // 0.6 + 0.5 * 0.4
      // 2.0 * 1.0 * 1.0 * 0.8 = 1.6
      expect(factors.faceHeightFt).toBe(1.6);
    });
  });

  describe('transformToFaceHeightRange', () => {
    it('should return low and high values', () => {
      const result = transformToFaceHeightRange({
        rawHeightFt: 2.0,
        periodS: 10,
        swellDirectionDeg: null,
        beach: null,
      });

      // 2.0 * 1.0 = 2.0ft average
      // 2.0 * 1.5 = 3.0ft sets
      expect(result.low).toBe(2.0);
      expect(result.high).toBe(3.0);
    });

    it('should calculate set waves at 1.5x average', () => {
      const result = transformToFaceHeightRange({
        rawHeightFt: 1.0,
        periodS: 10,
        swellDirectionDeg: null,
        beach: null,
      });

      // 1.0 * 1.0 = 1.0ft average
      // 1.0 * 1.5 = 1.5ft sets
      expect(result.low).toBe(1.0);
      expect(result.high).toBe(1.5);
    });

    it('should apply period factor to range', () => {
      const result = transformToFaceHeightRange({
        rawHeightFt: 2.0,
        periodS: 16, // Long period, clamped to 1.2x
        swellDirectionDeg: null,
        beach: null,
      });

      // 2.0 * 1.0 * 1.2 = 2.4ft average
      // 2.4 * 1.5 = 3.6ft sets
      expect(result.low).toBeCloseTo(2.4, 1);
      expect(result.high).toBeCloseTo(3.6, 1);
    });

    it('should apply direction factor to range', () => {
      const beach: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: Array(TERRAIN_BINS).fill(0.5),
      };

      const result = transformToFaceHeightRange({
        rawHeightFt: 2.0,
        periodS: 10,
        swellDirectionDeg: 180,
        beach,
      });

      // Direction factor = 0.6 + 0.5 * 0.4 = 0.8
      // 2.0 * 1.0 * 1.0 * 0.8 = 1.6ft average
      // 1.6 * 1.5 = 2.4ft sets
      expect(result.low).toBeCloseTo(1.6, 1);
      expect(result.high).toBeCloseTo(2.4, 1);
    });

    it('should handle zero height', () => {
      const result = transformToFaceHeightRange({
        rawHeightFt: 0,
        periodS: 10,
        swellDirectionDeg: null,
        beach: null,
      });

      expect(result.low).toBe(0);
      expect(result.high).toBe(0);
    });

    it('should round high value to 1 decimal place', () => {
      // Create a scenario where high would have many decimal places
      const result = transformToFaceHeightRange({
        rawHeightFt: 1.55,
        periodS: 10,
        swellDirectionDeg: null,
        beach: null,
      });

      // 1.55 * 1.0 = 1.55, rounded to 1.6ft average
      // 1.6 * 1.5 = 2.4ft sets
      expect(result.low).toBe(1.6);
      expect(result.high).toBe(2.4);
    });
  });
});
