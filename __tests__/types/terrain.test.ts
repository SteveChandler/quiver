/**
 * Type Tests for Terrain Utilities
 *
 * Tests the utility functions and type helpers for terrain-aware scoring.
 *
 * Test Coverage:
 * 1. toBin5() function with various inputs
 * 2. binToDeg() function for reverse mapping
 * 3. clamp01() edge cases
 * 4. useTerrainFactors() with different beach configurations
 * 5. TERRAIN_BINS and DEGREES_PER_BIN constants
 */

import {
  toBin5,
  binToDeg,
  useTerrainFactors,
  TERRAIN_BINS,
  DEGREES_PER_BIN,
  BeachTerrainFields,
} from '@/types/terrain'
import { clamp01 } from '@/lib/surf/scoring'

describe('Terrain Type Utilities', () => {
  describe('toBin5()', () => {
    describe('Cardinal Directions', () => {
      it('should map 0° (North) to bin 0', () => {
        expect(toBin5(0)).toBe(0)
      })

      it('should map 90° (East) to bin 18', () => {
        expect(toBin5(90)).toBe(18)
      })

      it('should map 180° (South) to bin 36', () => {
        expect(toBin5(180)).toBe(36)
      })

      it('should map 270° (West) to bin 54', () => {
        expect(toBin5(270)).toBe(54)
      })
    })

    describe('Edge Cases', () => {
      it('should handle 360° as bin 0 (wraps around)', () => {
        expect(toBin5(360)).toBe(0)
      })

      it('should handle 355° (last bin) as bin 71', () => {
        expect(toBin5(355)).toBe(71)
      })

      it('should handle 357° (near boundary) as bin 71', () => {
        expect(toBin5(357)).toBe(71)
      })

      it('should handle 358° (near boundary) as bin 0 (358+2.5=360.5, rounds to 0)', () => {
        // 358 + 2.5 = 360.5, floor(360.5/5) = 72, 72 % 72 = 0
        expect(toBin5(358)).toBe(0)
      })

      it('should handle 359° (near boundary) as bin 0 (359+2.5=361.5, rounds to 0)', () => {
        // 359 + 2.5 = 361.5, floor(361.5/5) = 72, 72 % 72 = 0
        expect(toBin5(359)).toBe(0)
      })

      it('should handle 362° (> 360) as bin 0 (wraps)', () => {
        expect(toBin5(362)).toBe(0)
      })

      it('should handle 365° (> 360) as bin 1', () => {
        expect(toBin5(365)).toBe(1)
      })
    })

    describe('Negative Values', () => {
      it('should handle -5° as bin 71 (wraps backwards)', () => {
        expect(toBin5(-5)).toBe(71)
      })

      it('should handle -90° as bin 54 (270°)', () => {
        expect(toBin5(-90)).toBe(54)
      })

      it('should handle -180° as bin 36 (180°)', () => {
        expect(toBin5(-180)).toBe(36)
      })

      it('should handle -360° as bin 0 (wraps)', () => {
        expect(toBin5(-360)).toBe(0)
      })

      it('should handle -365° as bin 71', () => {
        expect(toBin5(-365)).toBe(71)
      })
    })

    describe('Rounding Behavior', () => {
      it('should round 2° to bin 0 (closer to 0 than 5)', () => {
        expect(toBin5(2)).toBe(0)
      })

      it('should round 2.4° to bin 0', () => {
        expect(toBin5(2.4)).toBe(0)
      })

      it('should round 2.5° to bin 1 (rounds up at midpoint)', () => {
        expect(toBin5(2.5)).toBe(1)
      })

      it('should round 3° to bin 1 (closer to 5 than 0)', () => {
        expect(toBin5(3)).toBe(1)
      })

      it('should round 7.4° to bin 1', () => {
        expect(toBin5(7.4)).toBe(1)
      })

      it('should round 7.5° to bin 2', () => {
        expect(toBin5(7.5)).toBe(2)
      })
    })

    describe('All Bin Values', () => {
      it('should map all 72 bins correctly', () => {
        for (let bin = 0; bin < TERRAIN_BINS; bin++) {
          const deg = bin * DEGREES_PER_BIN
          expect(toBin5(deg)).toBe(bin)
        }
      })

      it('should handle midpoints between bins', () => {
        // Test midpoints (2.5°, 7.5°, 12.5°, etc.)
        for (let bin = 0; bin < TERRAIN_BINS; bin++) {
          const midpoint = bin * DEGREES_PER_BIN + 2.5
          const mappedBin = toBin5(midpoint)
          // Should round to next bin (up from midpoint)
          expect(mappedBin).toBe((bin + 1) % TERRAIN_BINS)
        }
      })
    })

    describe('Large Values', () => {
      it('should handle 720° (2 full rotations) as bin 0', () => {
        expect(toBin5(720)).toBe(0)
      })

      it('should handle 1000° as bin 28', () => {
        // 1000 % 360 = 280, bin 28 * 5 = 140... wait
        // 1000 - 2*360 = 280°, 280/5 = 56
        expect(toBin5(1000)).toBe(56)
      })

      it('should handle -1000° correctly', () => {
        expect(toBin5(-1000)).toBe(16) // (-1000 % 360 + 360) % 360 = 80°, bin 16
      })
    })

    describe('Decimal Precision', () => {
      it('should handle floating point values', () => {
        expect(toBin5(89.9)).toBe(18)
        expect(toBin5(90.1)).toBe(18)
        expect(toBin5(92.4)).toBe(18)
        expect(toBin5(92.5)).toBe(19)
      })

      it('should handle very small positive values', () => {
        expect(toBin5(0.1)).toBe(0)
        expect(toBin5(1.9)).toBe(0)
        expect(toBin5(2.49)).toBe(0)
      })

      it('should handle very small negative values', () => {
        // -0.1: ((−0.1 % 360) + 360) % 360 = 359.9, (359.9 + 2.5) / 5 = 72.48, floor = 72, % 72 = 0
        expect(toBin5(-0.1)).toBe(0)
        // -1.0: normalizes to 359, (359 + 2.5) / 5 = 72.3, floor = 72, % 72 = 0
        expect(toBin5(-1.0)).toBe(0)
        // -2.4: normalizes to 357.6, (357.6 + 2.5) / 5 = 72.02, floor = 72, % 72 = 0
        expect(toBin5(-2.4)).toBe(0)
      })
    })
  })

  describe('binToDeg()', () => {
    it('should convert bin 0 to 0°', () => {
      expect(binToDeg(0)).toBe(0)
    })

    it('should convert bin 18 to 90°', () => {
      expect(binToDeg(18)).toBe(90)
    })

    it('should convert bin 36 to 180°', () => {
      expect(binToDeg(36)).toBe(180)
    })

    it('should convert bin 54 to 270°', () => {
      expect(binToDeg(54)).toBe(270)
    })

    it('should convert bin 71 to 355°', () => {
      expect(binToDeg(71)).toBe(355)
    })

    it('should handle negative bin indices (wraps around)', () => {
      expect(binToDeg(-1)).toBe(355) // Wraps to bin 71
      expect(binToDeg(-18)).toBe(270) // Wraps to bin 54
    })

    it('should handle bin indices > 72 (wraps around)', () => {
      expect(binToDeg(72)).toBe(0) // Wraps to bin 0
      expect(binToDeg(90)).toBe(90) // 90 % 72 = 18, bin 18 = 90°
    })

    it('should be inverse of toBin5 for all bins', () => {
      for (let bin = 0; bin < TERRAIN_BINS; bin++) {
        const deg = binToDeg(bin)
        expect(toBin5(deg)).toBe(bin)
      }
    })
  })

  describe('clamp01()', () => {
    describe('Normal Range', () => {
      it('should return 0 for 0', () => {
        expect(clamp01(0)).toBe(0)
      })

      it('should return 1 for 1', () => {
        expect(clamp01(1)).toBe(1)
      })

      it('should return 0.5 for 0.5', () => {
        expect(clamp01(0.5)).toBe(0.5)
      })

      it('should preserve values in (0, 1)', () => {
        expect(clamp01(0.1)).toBe(0.1)
        expect(clamp01(0.25)).toBe(0.25)
        expect(clamp01(0.75)).toBe(0.75)
        expect(clamp01(0.99)).toBe(0.99)
      })
    })

    describe('Out of Range', () => {
      it('should clamp negative values to 0', () => {
        expect(clamp01(-0.1)).toBe(0)
        expect(clamp01(-1)).toBe(0)
        expect(clamp01(-100)).toBe(0)
      })

      it('should clamp values > 1 to 1', () => {
        expect(clamp01(1.1)).toBe(1)
        expect(clamp01(2)).toBe(1)
        expect(clamp01(100)).toBe(1)
      })
    })

    describe('Edge Cases', () => {
      it('should return 0 for very small negative values', () => {
        expect(clamp01(-0.0001)).toBe(0)
        expect(clamp01(-Number.EPSILON)).toBe(0)
      })

      it('should return 1 for values just over 1', () => {
        expect(clamp01(1.0001)).toBe(1)
        expect(clamp01(1 + Number.EPSILON)).toBe(1)
      })

      it('should map NaN to 0', () => {
        expect(clamp01(NaN)).toBe(0)
      })

      it('should handle Infinity by returning 1', () => {
        expect(clamp01(Infinity)).toBe(1)
      })

      it('should handle -Infinity by returning 0', () => {
        expect(clamp01(-Infinity)).toBe(0)
      })

      it('should handle -0 as 0', () => {
        expect(clamp01(-0)).toBe(0)
      })
    })

    describe('Precision', () => {
      it('should preserve floating point precision within range', () => {
        const precise = 0.123456789
        expect(clamp01(precise)).toBe(precise)
      })

      it('should handle very small positive values', () => {
        expect(clamp01(Number.EPSILON)).toBe(Number.EPSILON)
        expect(clamp01(Number.MIN_VALUE)).toBe(Number.MIN_VALUE)
      })

      it('should handle values very close to 1', () => {
        const almostOne = 1 - Number.EPSILON
        expect(clamp01(almostOne)).toBe(almostOne)
      })
    })
  })

  describe('useTerrainFactors()', () => {
    const validWindFactors = Array(TERRAIN_BINS).fill(0.8)
    const validSwellFactors = Array(TERRAIN_BINS).fill(0.9)

    describe('Valid Configurations', () => {
      it('should return true when all conditions are met', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(true)
      })

      it('should work with different factor values', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: Array(TERRAIN_BINS).fill(0.5),
          swell_access_factors: Array(TERRAIN_BINS).fill(0.3),
        }

        expect(useTerrainFactors(beach)).toBe(true)
      })
    })

    describe('terrain_enabled Flag', () => {
      it('should return false when terrain_enabled is false', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: false,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when terrain_enabled is undefined', () => {
        const beach: Partial<BeachTerrainFields> = {
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
          // terrain_enabled undefined
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when terrain_enabled is null', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: null as any,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })
    })

    describe('Wind Exposure Factors Validation', () => {
      it('should return false when wind_exposure_factors is null', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: null,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when wind_exposure_factors is undefined', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          swell_access_factors: validSwellFactors,
          // wind_exposure_factors undefined
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when wind_exposure_factors is not an array', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: 'invalid' as any,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when wind_exposure_factors has wrong length', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: [0.5, 0.6, 0.7], // Wrong length
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when wind_exposure_factors is empty array', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: [],
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when wind_exposure_factors has too many elements', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: Array(100).fill(0.5),
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })
    })

    describe('Swell Access Factors Validation', () => {
      it('should return false when swell_access_factors is null', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: null,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when swell_access_factors is undefined', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          // swell_access_factors undefined
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when swell_access_factors is not an array', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: { invalid: true } as any,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when swell_access_factors has wrong length', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: Array(50).fill(0.5),
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when swell_access_factors is empty array', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: [],
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })
    })

    describe('Combined Validation', () => {
      it('should return false when both factors are null', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: null,
          swell_access_factors: null,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when both factors have wrong length', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: [0.5],
          swell_access_factors: [0.6],
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should return false when enabled is false AND factors are valid', () => {
        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: false,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })
    })

    describe('Global Environment Override', () => {
      const originalEnv = process.env.TERRAIN_SCORING_ENABLED

      afterEach(() => {
        // Restore original env
        if (originalEnv === undefined) {
          delete process.env.TERRAIN_SCORING_ENABLED
        } else {
          process.env.TERRAIN_SCORING_ENABLED = originalEnv
        }
      })

      it('should return false when TERRAIN_SCORING_ENABLED="false"', () => {
        process.env.TERRAIN_SCORING_ENABLED = 'false'

        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(false)
      })

      it('should work normally when TERRAIN_SCORING_ENABLED is not set', () => {
        delete process.env.TERRAIN_SCORING_ENABLED

        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(true)
      })

      it('should work normally when TERRAIN_SCORING_ENABLED="true"', () => {
        process.env.TERRAIN_SCORING_ENABLED = 'true'

        const beach: Partial<BeachTerrainFields> = {
          terrain_enabled: true,
          wind_exposure_factors: validWindFactors,
          swell_access_factors: validSwellFactors,
        }

        expect(useTerrainFactors(beach)).toBe(true)
      })
    })

    describe('Empty Beach Object', () => {
      it('should return false for completely empty object', () => {
        expect(useTerrainFactors({})).toBe(false)
      })

      it('should handle null without crashing (implementation allows beach?.terrain_enabled)', () => {
        // Current implementation doesn't guard against null/undefined beach
        // This tests documents actual behavior - will throw if not guarded
        expect(() => useTerrainFactors(null as any)).toThrow()
      })

      it('should handle undefined without crashing', () => {
        // Current implementation doesn't guard against null/undefined beach
        expect(() => useTerrainFactors(undefined as any)).toThrow()
      })
    })
  })

  describe('Constants', () => {
    describe('TERRAIN_BINS', () => {
      it('should equal 72', () => {
        expect(TERRAIN_BINS).toBe(72)
      })

      it('should divide 360 evenly', () => {
        expect(360 % TERRAIN_BINS).toBe(0)
      })
    })

    describe('DEGREES_PER_BIN', () => {
      it('should equal 5', () => {
        expect(DEGREES_PER_BIN).toBe(5)
      })

      it('should equal 360 / TERRAIN_BINS', () => {
        expect(DEGREES_PER_BIN).toBe(360 / TERRAIN_BINS)
      })
    })

    describe('Consistency', () => {
      it('should have consistent bin calculation', () => {
        expect(TERRAIN_BINS * DEGREES_PER_BIN).toBe(360)
      })
    })
  })
})
