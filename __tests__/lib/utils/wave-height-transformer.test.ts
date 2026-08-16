import {
  calibratedShadowFactor,
  transformToFaceHeight,
  transformToFaceHeightWithMetadata,
  transformToFaceHeightRange,
  transformToFaceHeightDecomposed,
  alignmentFactor,
  componentAccessFactor,
  calculatePeriodFactor,
  calculateDirectionFactor,
  getTransformationFactors,
  lookupShoalingBucket,
  SHORT_PERIOD_CUTOFF_S,
  WIND_WAVE_FACE_HEIGHT_CUTOFF_S,
  ALIGNMENT_FLOOR,
  BASE_SHOALING,
  PERIOD_REF,
  PERIOD_MULT,
  PERIOD_FACTOR_MIN,
  PERIOD_FACTOR_MAX,
  DIRECTION_FACTOR_MIN,
  DIRECTION_FACTOR_RANGE,
  SET_WAVE_VARIANCE,
  POPULATION_PRIOR_BUCKETS,
  POPULATION_PRIOR_PROVENANCE,
  type BeachTerrainConfig,
  type ShoalingFactors,
  type SwellComponentInput,
  type TransformParams,
  type WaveHeightSourceTag,
} from '@/lib/utils/wave-height-transformer';
import { TERRAIN_BINS, toBin5 } from '@/types/terrain';
import {
  createMockBeach,
  createAccessArray,
} from './test-helpers/wave-height-test-utils';

function accessArray(overrides: Record<number, number>): number[] {
  const a = new Array(TERRAIN_BINS).fill(1.0);
  for (const [bin, val] of Object.entries(overrides)) a[Number(bin)] = val;
  return a;
}

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
      expect(WIND_WAVE_FACE_HEIGHT_CUTOFF_S).toBe(9);
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

  describe('calibratedShadowFactor', () => {
    // OB Pier-like: window center 293, halfwidth 73 => window 220-366 deg.
    const obBeach = {
      swell_window_center_deg: 293,
      swell_window_halfwidth_deg: 73,
      swell_access_factors: accessArray({ [toBin5(202)]: 0.008 }),
    };

    it('returns 1.0 for in-window directions (bucket already calibrated there)', () => {
      expect(calibratedShadowFactor(293, obBeach)).toBe(1.0); // dead center
      expect(calibratedShadowFactor(250, obBeach)).toBe(1.0); // inside halfwidth
    });

    it('applies the floored shadow for an out-of-window low-access direction', () => {
      // 202deg is 91deg from center 293 (> halfwidth 73) => out of window.
      // 0.6 + sqrt(0.008)*0.4 = 0.6353
      expect(calibratedShadowFactor(202, obBeach)).toBeCloseTo(0.6353, 3);
    });

    it('floors at 0.6 even when access is exactly 0 (diffraction floor, not zero)', () => {
      const beach = { ...obBeach, swell_access_factors: accessArray({ [toBin5(202)]: 0 }) };
      expect(calibratedShadowFactor(202, beach)).toBeCloseTo(0.6, 5);
    });

    it('returns 1.0 for an out-of-window but fully-exposed direction', () => {
      const beach = { ...obBeach, swell_access_factors: accessArray({ [toBin5(202)]: 1.0 }) };
      expect(calibratedShadowFactor(202, beach)).toBeCloseTo(1.0, 5);
    });

    it('treats the window boundary (distance == halfwidth) as out-of-window', () => {
      // 220deg is exactly 73deg from center 293 => boundary => shadow applies.
      const beach = { ...obBeach, swell_access_factors: accessArray({ [toBin5(220)]: 0.01 }) };
      expect(calibratedShadowFactor(220, beach)).toBeLessThan(1.0);
    });

    it('is a no-op (1.0) when direction, window, or access is missing/invalid', () => {
      expect(calibratedShadowFactor(null, obBeach)).toBe(1.0);
      expect(calibratedShadowFactor(202, {
        swell_window_center_deg: null,
        swell_window_halfwidth_deg: null,
        swell_access_factors: obBeach.swell_access_factors,
      })).toBe(1.0);
      expect(calibratedShadowFactor(202, {
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
        swell_access_factors: [0.1, 0.2],
      })).toBe(1.0);
      expect(calibratedShadowFactor(202, null)).toBe(1.0);
    });
  });

  describe('lookupShoalingBucket', () => {
    const factors: ShoalingFactors = {
      version: 1,
      type: 'period_lookup',
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 1.6 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
        { tp_min_s: 12, tp_max_s: 16, factor: 2.1 },
        { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
      ],
    };

    it('should return null for null factors', () => {
      expect(lookupShoalingBucket(10, null)).toBeNull();
      expect(lookupShoalingBucket(10, undefined)).toBeNull();
    });

    it('should return null for null or invalid period', () => {
      expect(lookupShoalingBucket(null, factors)).toBeNull();
      expect(lookupShoalingBucket(undefined, factors)).toBeNull();
      expect(lookupShoalingBucket(NaN, factors)).toBeNull();
      expect(lookupShoalingBucket(-1, factors)).toBeNull();
      // 0 is treated as a CDIP NaN sentinel, not a real short-period reading.
      expect(lookupShoalingBucket(0, factors)).toBeNull();
      expect(lookupShoalingBucket(Infinity, factors)).toBeNull();
      expect(lookupShoalingBucket(-Infinity, factors)).toBeNull();
    });

    it('should return the matching bucket factor', () => {
      expect(lookupShoalingBucket(4, factors)).toBe(1.6);
      expect(lookupShoalingBucket(10, factors)).toBe(1.7);
      expect(lookupShoalingBucket(14, factors)).toBe(2.1);
      expect(lookupShoalingBucket(20, factors)).toBe(2.4);
    });

    it('should use half-open intervals [min, max)', () => {
      // 8 is in the 8-12 bucket, not the <8 bucket.
      expect(lookupShoalingBucket(8, factors)).toBe(1.7);
      // 12 is in the 12-16 bucket, not the 8-12 bucket.
      expect(lookupShoalingBucket(12, factors)).toBe(2.1);
      // 16 is in the ≥16 bucket, not the 12-16 bucket.
      expect(lookupShoalingBucket(16, factors)).toBe(2.4);
    });

    it('should return null when wrong type tag', () => {
      const badFactors: ShoalingFactors = {
        version: 1,
        type: 'something_else' as unknown as 'period_lookup',
        buckets: factors.buckets,
      };
      expect(lookupShoalingBucket(10, badFactors)).toBeNull();
    });

    it('should return null when buckets is not an array', () => {
      const badFactors: ShoalingFactors = {
        version: 1,
        type: 'period_lookup',
        buckets: null as unknown as typeof factors.buckets,
      };
      expect(lookupShoalingBucket(10, badFactors)).toBeNull();
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

    describe('Shoaling factors short-circuit (empirically calibrated beaches)', () => {
      // Blacks Beach factors as seeded in 20260407134519 migration.
      // Calibrated from 8757 paired Surfline/CDIP records over 1 year.
      const blacksFactors: ShoalingFactors = {
        version: 1,
        type: 'period_lookup',
        buckets: [
          { tp_min_s: 0, tp_max_s: 8, factor: 1.6 },
          { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
          { tp_min_s: 12, tp_max_s: 16, factor: 2.1 },
          { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
        ],
      };

      it('should resolve the original Blacks bug scenario: 1.7 ft Hs on groundswell → ~3.6 ft face', () => {
        // User-reported symptom: Blacks displayed 1.7 ft when Surfline showed 3-5 ft
        // With calibrated factors on a 14s groundswell:
        // 1.7 * 2.1 = 3.57 → rounds to 3.6
        const result = transformToFaceHeight({
          rawHeightFt: 1.7,
          periodS: 14,
          swellDirectionDeg: 270,
          beach: { shoaling_factors: blacksFactors },
          source: 'cdip_sig',
        });
        expect(result).toBe(3.6);
      });

      it('should look up the correct bucket for each period range', () => {
        // Same 2 ft input, four different periods — all buckets
        expect(
          transformToFaceHeight({
            rawHeightFt: 2.0,
            periodS: 6, // <8 bucket, factor 1.6
            swellDirectionDeg: null,
            beach: { shoaling_factors: blacksFactors },
            source: 'cdip_sig',
          })
        ).toBe(3.2);

        expect(
          transformToFaceHeight({
            rawHeightFt: 2.0,
            periodS: 10, // 8-12 bucket, factor 1.7
            swellDirectionDeg: null,
            beach: { shoaling_factors: blacksFactors },
            source: 'cdip_sig',
          })
        ).toBe(3.4);

        expect(
          transformToFaceHeight({
            rawHeightFt: 2.0,
            periodS: 14, // 12-16 bucket, factor 2.1
            swellDirectionDeg: null,
            beach: { shoaling_factors: blacksFactors },
            source: 'cdip_sig',
          })
        ).toBe(4.2);

        expect(
          transformToFaceHeight({
            rawHeightFt: 2.0,
            periodS: 18, // ≥16 bucket, factor 2.4
            swellDirectionDeg: null,
            beach: { shoaling_factors: blacksFactors },
            source: 'cdip_sig',
          })
        ).toBe(4.8);
      });

      it('should bypass direction factor even when terrain_enabled is true', () => {
        // The empirical ratio already subsumes direction effects for calibrated beaches.
        // Same buoy input should produce the same face height regardless of swell direction.
        const baseParams = {
          rawHeightFt: 2.0,
          periodS: 14,
          beach: {
            ...createMockBeach(0.0), // fully blocked terrain
            shoaling_factors: blacksFactors,
          },
          source: 'cdip_sig' as const,
        };
        // Without shoaling_factors, poor access would multiply by 0.6, giving 2.88 → 2.9.
        // With shoaling_factors, it's 2.0 * 2.1 = 4.2 regardless of direction.
        expect(
          transformToFaceHeight({ ...baseParams, swellDirectionDeg: 270 })
        ).toBe(4.2);
        expect(
          transformToFaceHeight({ ...baseParams, swellDirectionDeg: 180 })
        ).toBe(4.2);
      });

      it('should fall through to legacy pipeline when periodS is null', () => {
        // No period → can't look up a bucket → legacy pipeline takes over.
        // Legacy at periodS=null defaults to PERIOD_REF (10s), factor 1.0.
        // 2.0 * 1.0 (base) * 1.0 (period) * 1.0 (no direction) = 2.0
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: null,
          swellDirectionDeg: null,
          beach: { shoaling_factors: blacksFactors },
        });
        expect(result).toBe(2.0);
      });

      it('should apply the measured population prior when factors are null', () => {
        // Regression: uncalibrated beaches must use the measured population
        // prior instead of the old flat 1.0 base factor. At 14s the prior is
        // 1.119, so 1.7 × 1.119 × 1.2 = 2.28456 → 2.3ft.
        const result = transformToFaceHeight({
          rawHeightFt: 1.7,
          periodS: 14,
          swellDirectionDeg: null,
          beach: { shoaling_factors: null },
        });
        expect(result).toBe(2.3);
      });

      it('uses the four prior factors by the existing period bucket boundaries', () => {
        // Regression: changing a boundary or factor would move every
        // uncalibrated beach into the wrong population correction.
        const expectedFactors = [0.955, 1.02, 1.119, 1.139];
        expect(POPULATION_PRIOR_BUCKETS.map((bucket) => bucket.factor)).toEqual(
          expectedFactors,
        );

        for (const [periodS, expectedFactor] of [
          [6, 0.955],
          [10, 1.02],
          [14, 1.119],
          [18, 1.139],
        ] as const) {
          const result = transformToFaceHeightWithMetadata({
            rawHeightFt: 2,
            periodS,
            swellDirectionDeg: null,
            beach: { shoaling_factors: null },
            source: 'cdip_sig',
          });

          expect(result.faceHeightFt).toBe(
            Math.round(2 * expectedFactor * calculatePeriodFactor(periodS) * 10) / 10,
          );
          expect(result.provenance).toBe(POPULATION_PRIOR_PROVENANCE);
          expect(result.isCalibrated).toBe(false);
        }
      });

      it('does not write the prior into shoaling_factors', () => {
        // Regression: the prior is a read-only fallback. Persisting it in the
        // measured calibration slot would falsely promote the beach in the UI.
        const beach: BeachTerrainConfig = { shoaling_factors: null };
        const before = JSON.stringify(beach.shoaling_factors);

        transformToFaceHeightWithMetadata({
          rawHeightFt: 1.7,
          periodS: 18,
          swellDirectionDeg: null,
          beach,
          source: 'cdip_sig',
        });

        expect(JSON.stringify(beach.shoaling_factors)).toBe(before);
        expect(beach.shoaling_factors).toBeNull();
      });

      it('should handle period exactly at bucket boundary using half-open intervals', () => {
        // tp_min_s=8 is inclusive, tp_max_s=8 is exclusive.
        // Period=8.0 should land in the 8-12 bucket (factor 1.7), not the <8 bucket (1.6).
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 8.0,
          swellDirectionDeg: null,
          beach: { shoaling_factors: blacksFactors },
          source: 'cdip_sig',
        });
        expect(result).toBe(3.4); // 2.0 * 1.7
      });

      // =============================================================
      // Regression tests for source-gating of the shoaling short-circuit
      // (Phase 1.4 Critical #1/#2 — reviewer found that applying the
      //  CDIP-calibrated factor to a model_swell input produced wrong
      //  answers on XL days where selectWaveHeightSource fell back.)
      // =============================================================

      it('should SKIP short-circuit when source is model_swell (not cdip_sig)', () => {
        // Same beach, same factors, same period, same inputs — but the
        // upstream source was model_swell (e.g. CDIP was rejected as an
        // outlier or exceeded MAX_TRUSTED_CDIP_FT). The bucket factor is
        // measured as surfline_face_ft / cdip_hs_ft — applying it to a
        // model height is a units/semantics mismatch. Must fall through
        // to the legacy base × period × direction pipeline instead.
        const result = transformToFaceHeight({
          rawHeightFt: 1.7,
          periodS: 14,
          swellDirectionDeg: 270,
          beach: { shoaling_factors: blacksFactors },
          source: 'model_swell',
        });
        // Legacy: 1.7 * 1.0 (base) * 1.2 (capped period at 14s) * 1.0 (no direction)
        //       = 2.04 → rounds to 2.0
        expect(result).toBe(2.0);
      });

      it('should SKIP short-circuit for every non-cdip_sig source tag', () => {
        const baseParams = {
          rawHeightFt: 2.0,
          periodS: 14, // would hit 12-16 bucket (factor 2.1) if short-circuit fired
          swellDirectionDeg: null,
          beach: { shoaling_factors: blacksFactors },
        };
        // Each non-cdip_sig source must land in the legacy pipeline:
        // 2.0 * 1.0 * 1.2 * 1.0 = 2.4 (not 2.0 * 2.1 = 4.2)
        for (const src of ['model_swell', 'cdip_swell', 'model_hs', 'ndbc_buoy'] as const) {
          expect(transformToFaceHeight({ ...baseParams, source: src })).toBe(2.4);
        }
        // And cdip_sig correctly fires the short-circuit
        expect(
          transformToFaceHeight({ ...baseParams, source: 'cdip_sig' })
        ).toBe(4.2);
      });

      it('should allow guarded nowcast anchors to use calibrated shoaling buckets', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 14,
          swellDirectionDeg: null,
          beach: { shoaling_factors: blacksFactors },
          source: 'nowcast_anchor',
          allowCalibratedShoaling: true,
        });

        expect(result).toBe(4.2);
      });

      it('should keep regular nowcast anchors on the generic path without explicit opt-in', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 14,
          swellDirectionDeg: null,
          beach: { shoaling_factors: blacksFactors },
          source: 'nowcast_anchor',
        });

        expect(result).toBe(2.4);
      });

      it('should SKIP short-circuit when source is omitted (safe default)', () => {
        // Defensive: if a caller forgets to pass source, the short-circuit
        // must not fire. Undefined is treated as non-cdip — the transformer
        // has no way to know the input provenance and must not guess.
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 14,
          swellDirectionDeg: null,
          beach: { shoaling_factors: blacksFactors },
          // source omitted
        });
        // Legacy pipeline: 2.0 * 1.0 * 1.2 * 1.0 = 2.4
        expect(result).toBe(2.4);
      });

      it('should fall through when period is out of range of all buckets', () => {
        // Contrived factors with a gap — period 100s won't match any bucket.
        const gappedFactors: ShoalingFactors = {
          version: 1,
          type: 'period_lookup',
          buckets: [{ tp_min_s: 0, tp_max_s: 20, factor: 2.0 }],
        };
        // periodS=25 → no bucket match → legacy pipeline
        // 2.0 * 1.0 * 1.2 (capped) * 1.0 = 2.4
        const result = transformToFaceHeight({
          rawHeightFt: 2.0,
          periodS: 25,
          swellDirectionDeg: null,
          beach: { shoaling_factors: gappedFactors },
        });
        expect(result).toBe(2.4);
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

  describe('transformToFaceHeightWithMetadata', () => {
    // Blacks-style calibration factors, modeled on the 20260407 migration.
    // bucket at 12-16s = 2.1x → 1.7ft CDIP Hs × 2.1 = 3.57 → rounds to 3.6.
    const BLACKS_SHOALING_FACTORS: ShoalingFactors = {
      version: 1,
      type: 'period_lookup',
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 1.6 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
        { tp_min_s: 12, tp_max_s: 16, factor: 2.1 },
        { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
      ],
    };

    const createCalibratedBeach = (): BeachTerrainConfig => ({
      ...createMockBeach(1.0),
      shoaling_factors: BLACKS_SHOALING_FACTORS,
    });

    const createMlOnlyBeach = (): BeachTerrainConfig => ({
      ...createMockBeach(1.0),
      shoaling_factors: null,
    });

    it('returns isCalibrated true for cdip_sig with shoaling factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createCalibratedBeach(),
        source: 'cdip_sig',
      });
      expect(result.faceHeightFt).toBe(3.6);
      expect(result.isCalibrated).toBe(true);
      expect(result.provenance).toBe('measured');
    });

    it('keeps calibrated bucket output byte-for-byte unchanged and never uses the prior', () => {
      // Regression: adding a population prior must not alter measured beach
      // output or mutate the measured shoaling_factors payload.
      const beach = createCalibratedBeach();
      const before = JSON.stringify(beach);
      const outputs = [6, 10, 14, 18].map((periodS) =>
        transformToFaceHeightWithMetadata({
          rawHeightFt: 2,
          periodS,
          swellDirectionDeg: null,
          beach,
          source: 'cdip_sig',
        }),
      );

      expect(outputs.map((result) => result.faceHeightFt)).toEqual([3.2, 3.4, 4.2, 4.8]);
      expect(outputs.every((result) => result.provenance === 'measured')).toBe(true);
      expect(outputs.every((result) => result.isCalibrated)).toBe(true);
      expect(JSON.stringify(beach)).toBe(before);
    });

    it('returns isCalibrated false for cdip_sig without shoaling factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createMlOnlyBeach(),
        source: 'cdip_sig',
      });
      // Regression: the uncalibrated long-period path must carry the prior
      // provenance and value, while retaining isCalibrated=false for UI honesty.
      // 1.7 * 1.119 * 1.2 = 2.28456 → 2.3.
      expect(result.faceHeightFt).toBe(2.3);
      expect(result.isCalibrated).toBe(false);
      expect(result.provenance).toBe('population_prior_v1');
    });

    it('returns isCalibrated false for model_swell even with factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createCalibratedBeach(),
        source: 'model_swell',
      });
      expect(result.faceHeightFt).toBe(2.0);
      expect(result.isCalibrated).toBe(false);
      expect(result.provenance).toBe('generic');
    });

    it('quarantines low long-period CDIP buckets and uses the generic path', () => {
      const rinconStyleFactors: ShoalingFactors = {
        version: 1,
        type: 'period_lookup',
        buckets: [{ tp_min_s: 15, tp_max_s: 999, factor: 0.36 }],
      };

      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 4.2,
        periodS: 18,
        swellDirectionDeg: 205,
        beach: { shoaling_factors: rinconStyleFactors },
        source: 'cdip_sig',
      });

      expect(result.faceHeightFt).toBe(5.0);
      expect(result.faceHeightFt).toBeGreaterThan(4.2 * 0.36);
      expect(result.isCalibrated).toBe(false);
      expect(result.calibrationBucketQuarantined).toBe(true);
    });

    it('keeps normal calibrated behavior for long-period CDIP buckets at or above threshold', () => {
      const trustedFactors: ShoalingFactors = {
        version: 1,
        type: 'period_lookup',
        buckets: [{ tp_min_s: 15, tp_max_s: 999, factor: 1.2 }],
      };

      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 4.2,
        periodS: 18,
        swellDirectionDeg: 205,
        beach: { shoaling_factors: trustedFactors },
        source: 'cdip_sig',
      });

      expect(result.faceHeightFt).toBe(5.0);
      expect(result.isCalibrated).toBe(true);
      expect(result.calibrationBucketQuarantined).toBeUndefined();
    });

    it('does not quarantine model sources even when a matching bucket is low', () => {
      const lowFactors: ShoalingFactors = {
        version: 1,
        type: 'period_lookup',
        buckets: [{ tp_min_s: 15, tp_max_s: 999, factor: 0.36 }],
      };

      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 4.2,
        periodS: 18,
        swellDirectionDeg: 205,
        beach: { shoaling_factors: lowFactors },
        source: 'model_swell',
      });

      expect(result.faceHeightFt).toBe(5.0);
      expect(result.isCalibrated).toBe(false);
      expect(result.calibrationBucketQuarantined).toBeUndefined();
    });

    it('returns isCalibrated false for cdip_swell with factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createCalibratedBeach(),
        source: 'cdip_swell',
      });
      expect(result.isCalibrated).toBe(false);
    });

    it('returns isCalibrated false for model_hs with factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createCalibratedBeach(),
        source: 'model_hs',
      });
      expect(result.isCalibrated).toBe(false);
    });

    it('returns isCalibrated false for ndbc_buoy with factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createCalibratedBeach(),
        source: 'ndbc_buoy',
      });
      expect(result.isCalibrated).toBe(false);
    });

    it('returns isCalibrated false when source is omitted (legacy caller path)', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createCalibratedBeach(),
        // source omitted
      });
      expect(result.isCalibrated).toBe(false);
    });

    it('returns isCalibrated false when period is out of bucket range', () => {
      // Factors only cover 0-20s; period 25 falls through → legacy pipeline
      const bounded: ShoalingFactors = {
        version: 1,
        type: 'period_lookup',
        buckets: [{ tp_min_s: 0, tp_max_s: 20, factor: 2.0 }],
      };
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 2.0,
        periodS: 25,
        swellDirectionDeg: null,
        beach: { shoaling_factors: bounded },
        source: 'cdip_sig',
      });
      // legacy: 2.0 * 1.0 * 1.2 (clamped) * 1.0 = 2.4
      expect(result.faceHeightFt).toBe(2.4);
      expect(result.isCalibrated).toBe(false);
    });

    it('returns isCalibrated false when period is null', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: null,
        swellDirectionDeg: null,
        beach: createCalibratedBeach(),
        source: 'cdip_sig',
      });
      // legacy: 1.7 * 1.0 * 1.0 (PERIOD_REF) * 1.0 = 1.7
      expect(result.faceHeightFt).toBe(1.7);
      expect(result.isCalibrated).toBe(false);
    });

    it('returns isCalibrated false when period is zero (CDIP NaN sentinel)', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 0,
        swellDirectionDeg: null,
        beach: createCalibratedBeach(),
        source: 'cdip_sig',
      });
      expect(result.isCalibrated).toBe(false);
    });

    it('returns { 0, false, generic } for invalid rawHeightFt', () => {
      expect(
        transformToFaceHeightWithMetadata({
          rawHeightFt: -1,
          periodS: 14,
          swellDirectionDeg: null,
          beach: createCalibratedBeach(),
          source: 'cdip_sig',
        })
      ).toEqual({ faceHeightFt: 0, isCalibrated: false, provenance: 'generic' });

      expect(
        transformToFaceHeightWithMetadata({
          rawHeightFt: NaN,
          periodS: 14,
          swellDirectionDeg: null,
          beach: createCalibratedBeach(),
          source: 'cdip_sig',
        })
      ).toEqual({ faceHeightFt: 0, isCalibrated: false, provenance: 'generic' });
    });

    it('faceHeightFt matches transformToFaceHeight for all source gates', () => {
      const sources: WaveHeightSourceTag[] = [
        'cdip_sig',
        'model_swell',
        'cdip_swell',
        'model_hs',
        'ndbc_buoy',
      ];
      const beach = createCalibratedBeach();
      for (const source of sources) {
        const params: TransformParams = {
          rawHeightFt: 1.7,
          periodS: 14,
          swellDirectionDeg: 270,
          beach,
          source,
        };
        const legacy = transformToFaceHeight(params);
        const meta = transformToFaceHeightWithMetadata(params);
        expect(meta.faceHeightFt).toBe(legacy);
      }
    });
  });

  describe('transformToFaceHeightWithMetadata — CDIP direction shadow', () => {
    const OB_BUCKETS = {
      version: 1 as const,
      type: 'period_lookup' as const,
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 0.96 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.0 },
        { tp_min_s: 12, tp_max_s: 16, factor: 1.04 },
        { tp_min_s: 16, tp_max_s: 999, factor: 1.0 },
      ],
    };
    const BLACKS_BUCKETS = {
      version: 1 as const,
      type: 'period_lookup' as const,
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 1.57 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
        { tp_min_s: 12, tp_max_s: 16, factor: 2.13 },
        { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
      ],
    };

    it('shadows OB Pier south swell on the CDIP calibrated path', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 4.30,
        periodS: 14,
        swellDirectionDeg: 202,
        source: 'cdip_sig',
        beach: {
          shoaling_factors: OB_BUCKETS,
          swell_window_center_deg: 293,
          swell_window_halfwidth_deg: 73,
          swell_access_factors: accessArray({ [toBin5(202)]: 0.008 }),
        },
      });

      expect(result.isCalibrated).toBe(true);
      expect(result.faceHeightFt).toBeCloseTo(2.8, 1);
    });

    it('leaves OB Pier own in-window WNW swell unchanged', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 4.30,
        periodS: 14,
        swellDirectionDeg: 290,
        source: 'cdip_sig',
        beach: {
          shoaling_factors: OB_BUCKETS,
          swell_window_center_deg: 293,
          swell_window_halfwidth_deg: 73,
          swell_access_factors: accessArray({ [toBin5(290)]: 0.74 }),
        },
      });

      expect(result.faceHeightFt).toBeCloseTo(4.5, 1);
    });

    it('leaves a west-facing in-window break (Blacks) byte-identical', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 2.0,
        periodS: 16,
        swellDirectionDeg: 270,
        source: 'cdip_sig',
        beach: {
          shoaling_factors: BLACKS_BUCKETS,
          swell_window_center_deg: 268,
          swell_window_halfwidth_deg: 73,
          swell_access_factors: accessArray({}),
        },
      });

      expect(result.faceHeightFt).toBeCloseTo(4.8, 1);
    });
  });

  // ==========================================================================
  // Workstream A: per-component decomposition + alignment weighting
  // ==========================================================================

  describe('alignmentFactor', () => {
    // Tourmaline swell window per 20260211120000_comprehensive_swell_window_fix:
    // center 247.5°, halfwidth 67.5° (spans 180° – 315°).
    const TOURMALINE_CENTER = 247.5;
    const TOURMALINE_HALFWIDTH = 67.5;

    describe('in-window alignment floor (ALIGNMENT_FLOOR)', () => {
      // Malibu: center 220°, halfwidth 40°. A real long-period groundswell
      // inside the window but off-center used to get crushed by the cos²
      // taper. The floor keeps qualifying in-window groundswell meaningful.
      const MALIBU_CENTER = 220;
      const MALIBU_HALFWIDTH = 40;

      // Mirror the in-window cos² so the test can prove WHICH value the
      // floor returns without depending on the implementation under test.
      const rawCos2 = (
        componentDirDeg: number,
        windowCenterDeg: number,
        windowHalfwidthDeg: number,
      ): number => {
        const distance = Math.abs(
          (((componentDirDeg - windowCenterDeg) % 360) + 540) % 360 - 180,
        );
        const normalized = distance / windowHalfwidthDeg;
        const cosValue = Math.cos((normalized * Math.PI) / 2);
        return cosValue * cosValue;
      };

      it('exports a floor of 0.35', () => {
        expect(ALIGNMENT_FLOOR).toBe(0.35);
      });

      it('lifts a collapsed in-window component up to the floor', () => {
        // 190° is ~30° off a 40° halfwidth → raw cos² ≈ 0.146, below the floor.
        const raw = rawCos2(190, MALIBU_CENTER, MALIBU_HALFWIDTH);
        expect(raw).toBeLessThan(ALIGNMENT_FLOOR);
        expect(raw).toBeCloseTo(0.1464, 4);

        expect(
          alignmentFactor(190, 15, MALIBU_CENTER, MALIBU_HALFWIDTH),
        ).toBe(ALIGNMENT_FLOOR);
      });

      it('leaves a well-aligned (center) component unchanged at 1.0', () => {
        expect(
          alignmentFactor(MALIBU_CENTER, 15, MALIBU_CENTER, MALIBU_HALFWIDTH),
        ).toBeCloseTo(1.0, 6);
      });

      it('leaves a moderately-aligned component above the floor unchanged', () => {
        // 205° is 15° off a 40° halfwidth → raw cos² ≈ 0.691, above the floor.
        const raw = rawCos2(205, MALIBU_CENTER, MALIBU_HALFWIDTH);
        expect(raw).toBeGreaterThan(ALIGNMENT_FLOOR);

        const result = alignmentFactor(205, 15, MALIBU_CENTER, MALIBU_HALFWIDTH);
        expect(result).toBeCloseTo(raw, 10);
        expect(result).not.toBe(ALIGNMENT_FLOOR);
      });

      it('does NOT lift an out-of-window component (stays 0)', () => {
        // 160° → distance 60 ≥ halfwidth 40 → genuinely out of window.
        expect(
          alignmentFactor(160, 15, MALIBU_CENTER, MALIBU_HALFWIDTH),
        ).toBe(0);
      });

      it('does NOT lift a short-period component (stays 0)', () => {
        // 6s ≤ SHORT_PERIOD_CUTOFF_S → wind-swell gate, even at the center.
        expect(
          alignmentFactor(MALIBU_CENTER, 6, MALIBU_CENTER, MALIBU_HALFWIDTH),
        ).toBe(0);
      });

      it('does NOT lift an uncalibrated window (stays 1.0)', () => {
        expect(alignmentFactor(190, 15, null, null)).toBe(1.0);
      });
    });

    it('returns 1.0 at the window center', () => {
      expect(
        alignmentFactor(TOURMALINE_CENTER, 14, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBeCloseTo(1.0, 6);
    });

    it('returns 0 exactly at the window edge', () => {
      // Distance === halfwidth: cos²(π/2) = 0
      const atEdge = alignmentFactor(
        TOURMALINE_CENTER + TOURMALINE_HALFWIDTH,
        14,
        TOURMALINE_CENTER,
        TOURMALINE_HALFWIDTH,
      );
      expect(atEdge).toBe(0);

      // Approaching the edge — still inside the window, so the ALIGNMENT_FLOOR
      // applies: the raw cos² (~0.0005) is below the floor and gets lifted to
      // it. The floor only ever lifts IN-window components; the at-edge case
      // above (distance === halfwidth) remains exactly 0.
      const nearEdge = alignmentFactor(
        TOURMALINE_CENTER + TOURMALINE_HALFWIDTH - 1,
        14,
        TOURMALINE_CENTER,
        TOURMALINE_HALFWIDTH,
      );
      expect(nearEdge).toBe(ALIGNMENT_FLOOR);
    });

    it('returns 0 for components outside the window', () => {
      // 20° N — nowhere near the SSW window
      expect(
        alignmentFactor(20, 14, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBe(0);
    });

    it('returns 0 for short-period components regardless of direction', () => {
      // 7s wind-swell from the window center should still zero out.
      expect(
        alignmentFactor(TOURMALINE_CENTER, 7, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBe(0);
      // 5s even stronger gate.
      expect(
        alignmentFactor(TOURMALINE_CENTER, 5, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBe(0);
    });

    it('treats exactly the cutoff period as short-period (strict less-than)', () => {
      // The cutoff is exclusive: 8.0s returns 0, 8.01s returns positive.
      // SHORT_PERIOD_CUTOFF_S is 8.
      expect(SHORT_PERIOD_CUTOFF_S).toBe(8);
      expect(
        alignmentFactor(TOURMALINE_CENTER, 8.0, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBe(0);
      expect(
        alignmentFactor(TOURMALINE_CENTER, 8.01, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBeGreaterThan(0);
    });

    it('returns 1.0 when the swell window is unknown (graceful degradation)', () => {
      expect(alignmentFactor(200, 14, null, null)).toBe(1.0);
      expect(alignmentFactor(200, 14, TOURMALINE_CENTER, null)).toBe(1.0);
      expect(alignmentFactor(200, 14, null, TOURMALINE_HALFWIDTH)).toBe(1.0);
    });

    it('returns 1.0 when the component direction is unknown', () => {
      // Can't compute angular distance — degrade open rather than zero out.
      expect(
        alignmentFactor(null, 14, TOURMALINE_CENTER, TOURMALINE_HALFWIDTH),
      ).toBe(1.0);
    });

    it('wraps correctly across the 0°/360° seam', () => {
      // Window center at 10°, halfwidth 30°. Component at 350° is 20° away
      // via the short arc — should match a symmetric component at 30°.
      expect(alignmentFactor(350, 14, 10, 30)).toBeCloseTo(
        alignmentFactor(30, 14, 10, 30),
        6,
      );
    });

    it('uses terrain access for model components when available', () => {
      const accessFactors = createAccessArray(0);
      accessFactors[40] = 0.21171; // 200° / 201° bin
      const beach: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: accessFactors,
        swell_window_center_deg: 273,
        swell_window_halfwidth_deg: 78,
      };

      const strictWindow = alignmentFactor(201, 12, 273, 78);
      const modelAccess = componentAccessFactor(201, 12, beach, 'model_swell');
      const modelHsAccess = componentAccessFactor(201, 12, beach, 'model_hs');
      const cdipAccess = componentAccessFactor(201, 12, beach, 'cdip_sig');
      const cdipSwellAccess = componentAccessFactor(201, 12, beach, 'cdip_swell');
      const noTerrainModelAccess = componentAccessFactor(
        201,
        12,
        { ...beach, swell_access_factors: null },
        'model_swell',
      );

      // 201° is in the 273°±78° window but off-center; raw cos² ≈ 0.0145 sits
      // below the ALIGNMENT_FLOOR, so the in-window strict alignment now floors
      // to 0.35. Model sources still prefer the (higher) terrain access; CDIP
      // sources still track the strict (now floored) alignment.
      expect(strictWindow).toBe(ALIGNMENT_FLOOR);
      expect(modelAccess).toBeCloseTo(
        DIRECTION_FACTOR_MIN + Math.sqrt(0.21171) * DIRECTION_FACTOR_RANGE,
        5,
      );
      expect(modelAccess).toBeGreaterThan(strictWindow);
      expect(modelHsAccess).toBeCloseTo(modelAccess, 6);
      expect(cdipAccess).toBeCloseTo(strictWindow, 6);
      expect(cdipSwellAccess).toBeCloseTo(strictWindow, 6);
      expect(noTerrainModelAccess).toBeCloseTo(strictWindow, 6);
    });

    it('uses a long-period south-swell terrain floor for CDIP/direct components with real access', () => {
      const accessFactors = createAccessArray(0);
      accessFactors[38] = 0.022199; // OB Pier production access at 192°.
      const obPier: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: accessFactors,
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
      };

      const strictWindow = alignmentFactor(192, 18, 293, 73);
      const cdipSwellAccess = componentAccessFactor(192, 18, obPier, 'cdip_swell');
      const cdipSigAccess = componentAccessFactor(192, 18, obPier, 'cdip_sig');
      const modelAccess = componentAccessFactor(192, 18, obPier, 'model_swell');

      expect(strictWindow).toBe(0);
      expect(cdipSwellAccess).toBeGreaterThan(0);
      expect(cdipSwellAccess).toBeLessThan(0.2);
      expect(cdipSwellAccess).toBeLessThan(modelAccess);
      expect(cdipSigAccess).toBeCloseTo(cdipSwellAccess, 6);
    });

    it('keeps low-but-nonzero CDIP/direct south-swell access as a small fraction', () => {
      const accessFactors = createAccessArray(0);
      accessFactors[38] = 0.05;
      const shelteredBeach: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: accessFactors,
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
      };

      const access = componentAccessFactor(192, 18, shelteredBeach, 'cdip_swell');

      expect(alignmentFactor(192, 18, 293, 73)).toBe(0);
      expect(access).toBeGreaterThan(0);
      expect(access).toBeLessThan(0.25);
    });

    it('keeps exact-zero terrain-access south swell blocked', () => {
      const accessFactors = createAccessArray(0);
      const blockedCove: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: accessFactors,
        swell_window_center_deg: 270,
        swell_window_halfwidth_deg: 35,
      };

      expect(alignmentFactor(192, 18, 270, 35)).toBe(0);
      expect(componentAccessFactor(192, 18, blockedCove, 'cdip_swell')).toBe(0);
      expect(componentAccessFactor(192, 18, blockedCove, 'model_swell')).toBe(0);
    });
  });

  describe('transformToFaceHeightDecomposed', () => {
    // Tourmaline factors from 20260407134519_add_shoaling_factors_to_beaches.sql
    const TOURMALINE_FACTORS: ShoalingFactors = {
      version: 1,
      type: 'period_lookup',
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 1.03 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.13 },
        { tp_min_s: 12, tp_max_s: 16, factor: 1.45 },
        { tp_min_s: 16, tp_max_s: 999, factor: 1.62 },
      ],
    };

    // Blacks factors, same migration.
    const BLACKS_FACTORS: ShoalingFactors = {
      version: 1,
      type: 'period_lookup',
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 1.57 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
        { tp_min_s: 12, tp_max_s: 16, factor: 2.13 },
        { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
      ],
    };

    const TOURMALINE_BEACH: BeachTerrainConfig = {
      terrain_enabled: false,
      swell_access_factors: null,
      shoaling_factors: TOURMALINE_FACTORS,
      swell_window_center_deg: 247.5,
      swell_window_halfwidth_deg: 67.5,
    };

    // Blacks center=275, halfwidth=80 per 20260211120000_comprehensive_swell_window_fix.
    const BLACKS_BEACH: BeachTerrainConfig = {
      terrain_enabled: false,
      swell_access_factors: null,
      shoaling_factors: BLACKS_FACTORS,
      swell_window_center_deg: 275,
      swell_window_halfwidth_deg: 80,
    };

    const createDirectionalAccess = (
      entries: Array<{ directionDeg: number; access: number }>,
      defaultAccess = 0,
    ): number[] => {
      const access = createAccessArray(defaultAccess);
      for (const entry of entries) {
        const bin = Math.round(entry.directionDeg / 5) % TERRAIN_BINS;
        access[bin] = entry.access;
      }
      return access;
    };

    it('Tourmaline 2026-04-09 scenario — short-period W wind-swell is zeroed', () => {
      // Real inputs: 1 ft 14s SSW primary + 2.5 ft 7s W wind-swell.
      // Legacy pipeline multiplied combined CDIP Hs (≈3 ft) by the 12-16s
      // bucket factor 1.45 → 4.35 ft, displayed "3-5 ft / 9.3/10".
      // The decomposed pipeline should zero the 7s component (period < 8s)
      // and alignment-weight the 14s SSW component down to a small fraction
      // of its raw multiplier, producing a face height well under 2 ft.
      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 1.0, periodS: 14, directionDeg: 200 },
          { heightFt: 2.5, periodS: 7, directionDeg: 274 },
          null,
        ],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 3.0,
        periodS: 14,
        swellDirectionDeg: 200,
      });

      // Hard assertion from the plan: face <= 2 ft.
      expect(result.faceHeightFt).toBeLessThanOrEqual(2.0);
      expect(result.path).toBe('decomposed');
      expect(result.isCalibrated).toBe(true);
      // Sanity: it should be substantially smaller than the legacy 4.35.
      expect(result.faceHeightFt).toBeLessThan(2.0);
      // And strictly positive — we don't want to zero out a real 14s SSW
      // reading just because alignment is imperfect.
      expect(result.faceHeightFt).toBeGreaterThan(0);
    });

    it('Blacks clean-day scenario — matches legacy within 5%', () => {
      // Single 5 ft 16s SSW primary approximately aligned with the Blacks
      // swell window. The decomposed path should closely agree with the
      // legacy short-circuit because one well-aligned component dominates.
      const legacy = transformToFaceHeight({
        rawHeightFt: 5.0,
        periodS: 16,
        swellDirectionDeg: 270,
        beach: BLACKS_BEACH,
        source: 'cdip_sig',
      });

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 5.0, periodS: 16, directionDeg: 270 },
          null,
          null,
        ],
        beach: BLACKS_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 5.0,
        periodS: 16,
        swellDirectionDeg: 270,
      });

      expect(result.path).toBe('decomposed');
      expect(result.isCalibrated).toBe(true);
      // Within +/- 5% of the current production value.
      const delta = Math.abs(result.faceHeightFt - legacy) / legacy;
      expect(delta).toBeLessThan(0.05);
    });

    it('Blacks 2026-05-13 spike scenario — borderline wind-wave does not inflate face height', () => {
      const blacksCanyon: BeachTerrainConfig = {
        terrain_enabled: false,
        swell_access_factors: null,
        shoaling_factors: BLACKS_FACTORS,
        swell_window_center_deg: 268,
        swell_window_halfwidth_deg: 73,
        deepwater_decay_factor: 1.15,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 2.99, periodS: 12, directionDeg: 270 },
          null,
          {
            heightFt: 3.5,
            periodS: 8.1,
            directionDeg: 270,
            partition: 'wind_wave',
          },
        ],
        beach: blacksCanyon,
        source: 'model_swell',
        rawHeightFt: 2.99,
        periodS: 12,
        swellDirectionDeg: 270,
      });

      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeGreaterThanOrEqual(3.5);
      expect(result.faceHeightFt).toBeLessThanOrEqual(4.0);
    });

    it('uncalibrated beach (null shoaling_factors) still decomposes via the population prior', () => {
      const uncalibrated: BeachTerrainConfig = {
        terrain_enabled: false,
        swell_access_factors: null,
        shoaling_factors: null,
        swell_window_center_deg: 247.5,
        swell_window_halfwidth_deg: 67.5,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 3.0, periodS: 14, directionDeg: 247.5 },
          null,
          null,
        ],
        beach: uncalibrated,
        source: 'model_swell',
        rawHeightFt: 3.0,
        periodS: 14,
        swellDirectionDeg: 247.5,
      });

      // Regression: decomposed and scalar paths must agree on the prior.
      // 3.0 × 1.119 × calculatePeriodFactor(14) × alignment(1.0)
      // = 4.0284 → 4.0ft.
      expect(result.path).toBe('decomposed');
      expect(result.isCalibrated).toBe(false);
      expect(result.provenance).toBe('population_prior_v1');
      expect(result.faceHeightFt).toBeCloseTo(4.0, 1);
    });

    it('falls back to legacy when every component is null', () => {
      const result = transformToFaceHeightDecomposed({
        components: [null, null, null],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 3.0,
        periodS: 14,
        swellDirectionDeg: 200,
      });

      // Legacy Tourmaline short-circuit: 3.0 × 1.45 = 4.35 → 4.3 rounded.
      const legacy = transformToFaceHeight({
        rawHeightFt: 3.0,
        periodS: 14,
        swellDirectionDeg: 200,
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
      });
      expect(result.path).toBe('legacy');
      expect(result.faceHeightFt).toBe(legacy);
      // Calibration metadata should match what transformToFaceHeightWithMetadata reports.
      expect(result.isCalibrated).toBe(true);
    });

    it('falls back to legacy when every component has invalid period', () => {
      // Zero periods are treated as "no data" and skipped — all three slots
      // invalid → legacy fallback.
      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 1.0, periodS: 0, directionDeg: 200 },
          { heightFt: 2.0, periodS: NaN, directionDeg: 220 },
          null,
        ],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 3.0,
        periodS: 14,
        swellDirectionDeg: 200,
      });

      expect(result.path).toBe('legacy');
    });

    it('partial nulls decompose the populated components only', () => {
      // One populated component + two null slots — should decompose, not fall back.
      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 2.0, periodS: 14, directionDeg: 247.5 },
          null,
          null,
        ],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 2.0,
        periodS: 14,
        swellDirectionDeg: 247.5,
      });

      // Exactly aligned: alignment = 1.0.
      // face_1 = 2.0 × 1.45 × 1.0 = 2.9 → rounds to 2.9.
      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeCloseTo(2.9, 1);
    });

    it('null swell window allows decomposition to proceed at full alignment', () => {
      const noWindow: BeachTerrainConfig = {
        terrain_enabled: false,
        swell_access_factors: null,
        shoaling_factors: TOURMALINE_FACTORS,
        swell_window_center_deg: null,
        swell_window_halfwidth_deg: null,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 2.0, periodS: 14, directionDeg: 200 },
          null,
          null,
        ],
        beach: noWindow,
        source: 'cdip_sig',
        rawHeightFt: 2.0,
        periodS: 14,
        swellDirectionDeg: 200,
      });

      // alignment = 1.0 (graceful degradation), face_1 = 2.0 × 1.45 = 2.9.
      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeCloseTo(2.9, 1);
    });

    it('RMS sum never exceeds the linear sum of face contributions', () => {
      // Quadrature (RMS) sum is always <= linear sum. Exercise a few
      // multi-component mixes to guard the invariant.
      const mixes: Array<SwellComponentInput[]> = [
        [
          { heightFt: 3.0, periodS: 14, directionDeg: 247.5 },
          { heightFt: 2.0, periodS: 12, directionDeg: 220 },
          { heightFt: 1.0, periodS: 10, directionDeg: 260 },
        ],
        [
          { heightFt: 4.0, periodS: 16, directionDeg: 240 },
          { heightFt: 2.5, periodS: 13, directionDeg: 255 },
        ],
      ];

      for (const components of mixes) {
        // Linear sum: add per-component face heights directly.
        let linearSum = 0;
        for (const c of components) {
          const a = alignmentFactor(c.directionDeg, c.periodS, 247.5, 67.5);
          const b = lookupShoalingBucket(c.periodS, TOURMALINE_FACTORS) ?? 1.0;
          linearSum += c.heightFt * b * a;
        }

        const slots: Array<SwellComponentInput | null> = [
          components[0] ?? null,
          components[1] ?? null,
          components[2] ?? null,
        ];

        const result = transformToFaceHeightDecomposed({
          components: slots,
          beach: TOURMALINE_BEACH,
          source: 'cdip_sig',
          rawHeightFt: components.reduce((s, c) => s + c.heightFt, 0),
          periodS: components[0].periodS,
          swellDirectionDeg: components[0].directionDeg,
        });

        // 0.05 ft slack for rounding (1-decimal output vs unrounded sum).
        expect(result.faceHeightFt).toBeLessThanOrEqual(linearSum + 0.05);
      }
    });

    it('path metadata distinguishes decomposed vs legacy', () => {
      const decomposed = transformToFaceHeightDecomposed({
        components: [{ heightFt: 2.0, periodS: 14, directionDeg: 247.5 }, null, null],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 2.0,
        periodS: 14,
        swellDirectionDeg: 247.5,
      });
      expect(decomposed.path).toBe('decomposed');

      const legacy = transformToFaceHeightDecomposed({
        components: [null, null, null],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 2.0,
        periodS: 14,
        swellDirectionDeg: 247.5,
      });
      expect(legacy.path).toBe('legacy');
    });

    it('non-CDIP source skips calibrated bucket factors, uses generic period factor', () => {
      // OPEN_METEO source with Tourmaline's calibrated factors — the bucket
      // lookup should NOT fire because it was calibrated on CDIP Hs, not model
      // data. Using it on model data produces overshoot (raw 3.3 → face 4.3).
      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 2.5, periodS: 14, directionDeg: 247.5 },
          { heightFt: 1.5, periodS: 17, directionDeg: 250 },
          null,
        ],
        beach: TOURMALINE_BEACH,
        source: undefined, // non-CDIP (OPEN_METEO, NOAA_NWS, etc.)
        rawHeightFt: 3.3,
        periodS: 14,
        swellDirectionDeg: 247.5,
      });

      // Generic period factor is capped at 1.2 (PERIOD_FACTOR_MAX). Both
      // components are well-aligned (near window center). Face should be
      // roughly: sqrt((2.5×1.2×1.0)² + (1.5×1.2×~1.0)²) ≈ sqrt(9+3.2) ≈ 3.5
      // NOT the 4.3+ that the old bucket factors would produce.
      expect(result.faceHeightFt).toBeLessThan(4.0);
      expect(result.faceHeightFt).toBeGreaterThan(2.0);
      expect(result.path).toBe('decomposed');
      // Not calibrated because source is not CDIP.
      expect(result.isCalibrated).toBe(false);
    });

    describe('deepwater decay factor', () => {
      it('applies decay to model data sources (decomposed path)', () => {
        const result = transformToFaceHeightDecomposed({
          components: [{ heightFt: 3.1, periodS: 13, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 0.4,
          },
          source: 'model_swell',
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: 200,
        });
        // 3.1 * 0.4 (decay) * 1.15 (period factor at 13s) * ~1.0 (alignment near center)
        // ≈ 1.43
        expect(result.faceHeightFt).toBeCloseTo(1.4, 0);
        expect(result.path).toBe('decomposed');
      });

      it('does NOT apply decay to CDIP data (decomposed path)', () => {
        const result = transformToFaceHeightDecomposed({
          components: [{ heightFt: 3.1, periodS: 13, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 0.4,
          },
          source: 'cdip_sig',
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: 200,
        });
        // No decay for CDIP: 3.1 * 1.15 * ~1.0 ≈ 3.57
        expect(result.faceHeightFt).toBeCloseTo(3.6, 0);
      });

      it('defaults to 1.0 when decay factor is null (decomposed path)', () => {
        const result = transformToFaceHeightDecomposed({
          components: [{ heightFt: 3.1, periodS: 13, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: null,
          },
          source: 'model_swell',
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: 200,
        });
        // No decay (null defaults to 1.0): 3.1 * 1.15 * ~1.0 ≈ 3.57
        expect(result.faceHeightFt).toBeCloseTo(3.6, 0);
      });

      it('applies decay in the legacy scalar path (transformToFaceHeight)', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: null,
          beach: {
            deepwater_decay_factor: 0.4,
          },
          source: 'model_swell',
        });
        // 3.1 * 0.4 (decay) * 1.0 (base) * 1.15 (period) * 1.0 (no direction)
        // = 1.426 → rounds to 1.4
        expect(result).toBeCloseTo(1.4, 1);
      });

      it('does NOT apply decay to CDIP data in legacy scalar path', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: null,
          beach: {
            deepwater_decay_factor: 0.4,
          },
          source: 'cdip_sig',
        });
        // No decay for CDIP: 3.1 * 1.0 * 1.15 * 1.0 = 3.565 → 3.6
        expect(result).toBeCloseTo(3.6, 1);
      });

      it('does NOT apply decay to nowcast anchors in legacy scalar path', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: null,
          beach: {
            deepwater_decay_factor: 0.4,
          },
          source: 'nowcast_anchor',
        });

        expect(result).toBeCloseTo(3.6, 1);
      });

      it('defaults to 1.0 when decay factor is undefined in legacy path', () => {
        const result = transformToFaceHeight({
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: null,
          beach: {},
          source: 'model_swell',
        });
        // No decay (undefined defaults to 1.0): 3.1 * 1.15 = 3.565 → 3.6
        expect(result).toBeCloseTo(3.6, 1);
      });

      it('applies decay when source is undefined (safe default)', () => {
        const result = transformToFaceHeightDecomposed({
          components: [{ heightFt: 3.1, periodS: 13, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 0.4,
          },
          source: undefined,
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: 200,
        });
        // undefined !== 'cdip_sig' → decay applies: 3.1 * 0.4 * 1.15 * ~1.0 ≈ 1.43
        expect(result.faceHeightFt).toBeCloseTo(1.4, 0);
      });

      it('zeros out height when decay factor is 0', () => {
        const result = transformToFaceHeightDecomposed({
          components: [{ heightFt: 3.1, periodS: 13, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 0,
          },
          source: 'model_swell',
          rawHeightFt: 3.1,
          periodS: 13,
          swellDirectionDeg: 200,
        });
        // decay=0 zeros all components → sumOfSquares=0 → falls back to legacy
        expect(result.path).toBe('legacy');
      });

      it('amplifies height when decay factor > 1.0 (canyon effect)', () => {
        const withoutCanyon = transformToFaceHeightDecomposed({
          components: [{ heightFt: 2.0, periodS: 16, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 1.0,
          },
          source: 'model_swell',
          rawHeightFt: 2.0,
          periodS: 16,
          swellDirectionDeg: 200,
        });
        const withCanyon = transformToFaceHeightDecomposed({
          components: [{ heightFt: 2.0, periodS: 16, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 1.15,
          },
          source: 'model_swell',
          rawHeightFt: 2.0,
          periodS: 16,
          swellDirectionDeg: 200,
        });
        // Canyon amplification: 1.15x decay should produce 15% more face height
        expect(withCanyon.faceHeightFt).toBeGreaterThan(withoutCanyon.faceHeightFt);
        expect(withCanyon.faceHeightFt / withoutCanyon.faceHeightFt).toBeCloseTo(1.15, 1);
      });

      it('skips decay for CDIP even when beach has both decay and shoaling_factors', () => {
        const result = transformToFaceHeightDecomposed({
          components: [{ heightFt: 2.0, periodS: 14, directionDeg: 200 }],
          beach: {
            swell_window_center_deg: 195,
            swell_window_halfwidth_deg: 120,
            deepwater_decay_factor: 0.4,
            shoaling_factors: {
              version: 1,
              type: 'period_lookup' as const,
              buckets: [
                { tp_min_s: 12, tp_max_s: 16, factor: 1.45 },
              ],
            },
          },
          source: 'cdip_sig',
          rawHeightFt: 2.0,
          periodS: 14,
          swellDirectionDeg: 200,
        });
        // CDIP: no decay, uses calibrated bucket factor 1.45
        // 2.0 * 1.45 * ~1.0 alignment ≈ 2.9
        expect(result.faceHeightFt).toBeCloseTo(2.9, 0);
        expect(result.isCalibrated).toBe(true);
      });
    });

    it('falls back to legacy when all components are zeroed by period cutoff', () => {
      // All components have period ≤ 8s (short-period wind-swell day).
      // The alignment cutoff zeros every component → sumOfSquares=0.
      // Should fall back to legacy, not return 0.
      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 1.3, periodS: 7, directionDeg: 200 },
          { heightFt: 0.9, periodS: 6, directionDeg: 220 },
          { heightFt: 0.3, periodS: 3.75, directionDeg: 274 },
        ],
        beach: TOURMALINE_BEACH,
        source: 'cdip_sig',
        rawHeightFt: 1.9,
        periodS: 7,
        swellDirectionDeg: 200,
      });

      // Legacy fallback: raw 1.9 × bucket(7s)=1.03 = 1.957 → rounds to 2.0.
      expect(result.path).toBe('legacy');
      expect(result.faceHeightFt).toBeGreaterThan(0);
      // The uncalibrated prior raises the old 2.3ft result to 2.6ft.
      expect(result.faceHeightFt).toBeLessThanOrEqual(2.6);
    });

    it('La Jolla Shores model SSW fixture stays in the NOAA/Surfline 2ft+ neighborhood', () => {
      const laJollaShores: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: createDirectionalAccess([
          { directionDeg: 200, access: 0.21171 },
        ]),
        shoaling_factors: {
          version: 1,
          type: 'period_lookup',
          buckets: [
            { tp_min_s: 0, tp_max_s: 8, factor: 1.18 },
            { tp_min_s: 8, tp_max_s: 12, factor: 1.19 },
            { tp_min_s: 12, tp_max_s: 16, factor: 1.42 },
            { tp_min_s: 16, tp_max_s: 999, factor: 1.46 },
          ],
        },
        swell_window_center_deg: 273,
        swell_window_halfwidth_deg: 78,
        deepwater_decay_factor: 1.15,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 1.9, periodS: 12, directionDeg: 201 },
          null,
          null,
        ],
        beach: laJollaShores,
        source: 'model_swell',
        rawHeightFt: 1.9,
        periodS: 12,
        swellDirectionDeg: 201,
      });

      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeGreaterThanOrEqual(2.0);
      expect(result.faceHeightFt).toBeLessThanOrEqual(2.5);
    });

    it('Waikiki Beach terrain model fixture is bounded and nonzero', () => {
      const waikikiBeach: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: createDirectionalAccess([
          { directionDeg: 200, access: 1 },
        ]),
        shoaling_factors: null,
        swell_window_center_deg: 195,
        swell_window_halfwidth_deg: 105,
        deepwater_decay_factor: 1,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 2.0, periodS: 13, directionDeg: 200 },
          null,
          null,
        ],
        beach: waikikiBeach,
        source: 'model_swell',
        rawHeightFt: 2.0,
        periodS: 13,
        swellDirectionDeg: 200,
      });

      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeGreaterThan(0.5);
      // The uncalibrated prior raises the old 2.3ft result to 2.6ft.
      expect(result.faceHeightFt).toBeLessThanOrEqual(2.6);
    });

    it('OB Pier model-source 192° long-period south swell stays nonzero despite strict window zero', () => {
      const obPier: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: createDirectionalAccess([
          { directionDeg: 192, access: 0.022199 },
        ]),
        shoaling_factors: null,
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
        deepwater_decay_factor: 1,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 5.9, periodS: 18, directionDeg: 192 },
          null,
          null,
        ],
        beach: obPier,
        source: 'model_swell',
        rawHeightFt: 5.9,
        periodS: 18,
        swellDirectionDeg: 192,
      });

      expect(alignmentFactor(192, 18, 293, 73)).toBe(0);
      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeGreaterThanOrEqual(4.5);
      expect(result.faceHeightFt).toBeLessThanOrEqual(5.5);
    });

    it('OB Pier CDIP/direct 192° long-period south swell uses a scaled nonzero terrain floor', () => {
      const obPier: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: createDirectionalAccess([
          { directionDeg: 192, access: 0.022199 },
        ]),
        shoaling_factors: null,
        swell_window_center_deg: 293,
        swell_window_halfwidth_deg: 73,
        deepwater_decay_factor: 1,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 5.9, periodS: 18, directionDeg: 192 },
          null,
          null,
        ],
        beach: obPier,
        source: 'cdip_swell',
        rawHeightFt: 5.9,
        periodS: 18,
        swellDirectionDeg: 192,
      });

      expect(alignmentFactor(192, 18, 293, 73)).toBe(0);
      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeGreaterThanOrEqual(0.8);
      expect(result.faceHeightFt).toBeLessThanOrEqual(1.3);
    });

    it('exact-zero south-swell access keeps the legacy fallback for this pass', () => {
      const blockedCove: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: createAccessArray(0),
        shoaling_factors: null,
        swell_window_center_deg: 270,
        swell_window_halfwidth_deg: 35,
        deepwater_decay_factor: 1,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 5.9, periodS: 18, directionDeg: 192 },
          null,
          null,
        ],
        beach: blockedCove,
        source: 'cdip_swell',
        rawHeightFt: 5.9,
        periodS: 18,
        swellDirectionDeg: 192,
      });

      expect(result.path).toBe('legacy');
      expect(result.faceHeightFt).toBeGreaterThan(0);
    });

    it('Malibu First Point terrain model fixture stays bounded and does not overcall', () => {
      const malibuFirstPoint: BeachTerrainConfig = {
        terrain_enabled: true,
        swell_access_factors: createDirectionalAccess([
          { directionDeg: 200, access: 0.575489 },
          { directionDeg: 290, access: 0.847961 },
        ]),
        shoaling_factors: null,
        swell_window_center_deg: 175,
        swell_window_halfwidth_deg: 130,
        deepwater_decay_factor: 0.6,
      };

      const result = transformToFaceHeightDecomposed({
        components: [
          { heightFt: 3.0, periodS: 8, directionDeg: 290 },
          { heightFt: 2.0, periodS: 14, directionDeg: 200 },
          null,
        ],
        beach: malibuFirstPoint,
        source: 'model_swell',
        rawHeightFt: 3.0,
        periodS: 14,
        swellDirectionDeg: 200,
      });

      expect(result.path).toBe('decomposed');
      expect(result.faceHeightFt).toBeGreaterThan(0.5);
      expect(result.faceHeightFt).toBeLessThanOrEqual(2.0);
    });
  });
});
