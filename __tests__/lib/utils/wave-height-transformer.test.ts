import {
  transformToFaceHeight,
  transformToFaceHeightWithMetadata,
  transformToFaceHeightRange,
  calculatePeriodFactor,
  calculateDirectionFactor,
  getTransformationFactors,
  lookupShoalingBucket,
  BASE_SHOALING,
  PERIOD_REF,
  PERIOD_MULT,
  PERIOD_FACTOR_MIN,
  PERIOD_FACTOR_MAX,
  DIRECTION_FACTOR_MIN,
  DIRECTION_FACTOR_RANGE,
  SET_WAVE_VARIANCE,
  type BeachTerrainConfig,
  type ShoalingFactors,
  type TransformParams,
  type WaveHeightSourceTag,
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

      it('should fall through to legacy pipeline when factors is null (uncalibrated beach)', () => {
        // ~190 CDIP-override beaches that haven't been calibrated yet stay on the legacy path.
        // 1.7 ft @ 14s, no terrain: 1.7 * 1.0 * 1.2 (capped) * 1.0 = 2.04 → rounds to 2.0
        const result = transformToFaceHeight({
          rawHeightFt: 1.7,
          periodS: 14,
          swellDirectionDeg: null,
          beach: { shoaling_factors: null },
        });
        expect(result).toBe(2.0);
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
    });

    it('returns isCalibrated false for cdip_sig without shoaling factors', () => {
      const result = transformToFaceHeightWithMetadata({
        rawHeightFt: 1.7,
        periodS: 14,
        swellDirectionDeg: 270,
        beach: createMlOnlyBeach(),
        source: 'cdip_sig',
      });
      // legacy pipeline: 1.7 * 1.0 * 1.2 * 1.0 = 2.04 → 2.0
      expect(result.faceHeightFt).toBe(2.0);
      expect(result.isCalibrated).toBe(false);
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

    it('returns { 0, false } for invalid rawHeightFt', () => {
      expect(
        transformToFaceHeightWithMetadata({
          rawHeightFt: -1,
          periodS: 14,
          swellDirectionDeg: null,
          beach: createCalibratedBeach(),
          source: 'cdip_sig',
        })
      ).toEqual({ faceHeightFt: 0, isCalibrated: false });

      expect(
        transformToFaceHeightWithMetadata({
          rawHeightFt: NaN,
          periodS: 14,
          swellDirectionDeg: null,
          beach: createCalibratedBeach(),
          source: 'cdip_sig',
        })
      ).toEqual({ faceHeightFt: 0, isCalibrated: false });
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
});
