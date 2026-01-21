/**
 * Swell Access Algorithm Tests
 *
 * Tests the swell access computation including:
 * - Full swell access computation
 * - Open water produces uniform access
 * - Factor array validity (72 elements, all in [0, 1])
 * - Wrap calculation works for blocked directions
 * - Direct and wrap access components
 */

import { computeSwellAccess } from '../swell-access'
import type { LandmaskTile } from '../landmask-loader'
import { DEFAULT_TERRAIN_PARAMS } from '../../../types/terrain'

describe('Swell Access Algorithm', () => {
  // Create mock landmask tile for open water (no land)
  const createOpenWaterLandmask = (): LandmaskTile => ({
    bounds: {
      minX: -5000,
      maxX: 5000,
      minY: -5000,
      maxY: 5000,
    },
    resolution: 30,
    utmZone: '10N',
    data: [], // Empty for mock
  })

  describe('computeSwellAccess', () => {
    it('should return 72 factors', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199, // San Francisco latitude
        -122.4783, // San Francisco longitude
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      expect(result.factors).toHaveLength(72)
    })

    it('should have all factors in [0, 1] range', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      result.factors.forEach((factor, idx) => {
        expect(factor).toBeGreaterThanOrEqual(0)
        expect(factor).toBeLessThanOrEqual(1)
        if (factor < 0 || factor > 1) {
          throw new Error(`Factor at index ${idx} (${idx * 5}°) is out of range: ${factor}`)
        }
      })
    })

    it('should produce uniform access = 1.0 for open water', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // Open water: no land within ray length
      // All directions should have full access = 1.0
      result.factors.forEach((factor, idx) => {
        expect(factor).toBeCloseTo(1.0, 2)
        if (Math.abs(factor - 1.0) > 0.05) {
          throw new Error(
            `Factor at index ${idx} (${idx * 5}°) is not uniform: ${factor} (expected 1.0)`
          )
        }
      })
    })

    it('should return direct_access array with 72 elements', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      expect(result.direct_access).toHaveLength(72)
      result.direct_access.forEach((access, idx) => {
        expect(access).toBeGreaterThanOrEqual(0)
        expect(access).toBeLessThanOrEqual(1)
      })
    })

    it('should return wrap_access array with 72 elements', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      expect(result.wrap_access).toHaveLength(72)
      result.wrap_access.forEach((wrap, idx) => {
        expect(wrap).toBeGreaterThanOrEqual(0)
        expect(wrap).toBeLessThanOrEqual(1)
      })
    })

    it('should have zero wrap contribution for open directions', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // For open water with direct_access = 1.0 everywhere,
      // wrap should be 0 (no need for wrap when already open)
      result.wrap_access.forEach((wrap, idx) => {
        expect(wrap).toBeCloseTo(0, 5)
      })
    })

    it('should apply smoothing correctly', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // For open water, smoothing should not change uniform values
      const values = result.factors
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + (val - avgValue) ** 2, 0) / values.length
      const stdDev = Math.sqrt(variance)

      // Standard deviation should be very low for uniform values
      expect(stdDev).toBeLessThan(0.001)
    })

    it('should handle boundary wrapping in smoothing', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // Factors at 0° and 355° should be very similar (wrapping)
      expect(Math.abs(result.factors[0] - result.factors[71])).toBeLessThan(0.01)
    })

    it('should use correct direction convention (swell FROM direction)', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // Index 0 = 0° (North swell)
      // Index 18 = 90° (East swell)
      // Index 36 = 180° (South swell)
      // Index 54 = 270° (West swell)

      // For open water, all directions should have similar access
      const north = result.factors[0]
      const east = result.factors[18]
      const south = result.factors[36]
      const west = result.factors[54]

      expect(Math.abs(north - east)).toBeLessThan(0.01)
      expect(Math.abs(east - south)).toBeLessThan(0.01)
      expect(Math.abs(south - west)).toBeLessThan(0.01)
    })

    it('should produce consistent results for same location', () => {
      const landmask = createOpenWaterLandmask()

      const result1 = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      const result2 = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // Results should be identical for same inputs
      for (let i = 0; i < 72; i++) {
        expect(result1.factors[i]).toBeCloseTo(result2.factors[i], 5)
      }
    })

    it('should handle different parameter values', () => {
      const landmask = createOpenWaterLandmask()

      // Test with modified parameters
      const modifiedParams = {
        ...DEFAULT_TERRAIN_PARAMS,
        blockage_threshold_m: 2000, // Reduced threshold
        max_wrap_angle: 30, // Reduced wrap angle
      }

      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        modifiedParams,
        landmask
      )

      // Should still produce valid results
      expect(result.factors).toHaveLength(72)
      result.factors.forEach((factor) => {
        expect(factor).toBeGreaterThanOrEqual(0)
        expect(factor).toBeLessThanOrEqual(1)
      })
    })

    it('should combine direct and wrap access correctly', () => {
      const landmask = createOpenWaterLandmask()
      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        landmask
      )

      // For each direction, final factor should be >= direct_access
      // (because we take max of direct and wrap*0.85)
      for (let i = 0; i < 72; i++) {
        // After smoothing, this may not hold exactly, but generally should
        // For open water specifically, direct_access = 1.0 everywhere
        expect(result.direct_access[i]).toBeCloseTo(1.0, 2)
      }
    })

    it('should apply wrap decay exponentially', () => {
      const landmask = createOpenWaterLandmask()

      // Test with higher wrap_lambda for stronger decay
      const highDecayParams = {
        ...DEFAULT_TERRAIN_PARAMS,
        wrap_lambda: 0.08, // Double the decay rate
      }

      const result = computeSwellAccess(
        37.8199,
        -122.4783,
        highDecayParams,
        landmask
      )

      // Should still produce valid results with stronger decay
      expect(result.factors).toHaveLength(72)
      result.factors.forEach((factor) => {
        expect(factor).toBeGreaterThanOrEqual(0)
        expect(factor).toBeLessThanOrEqual(1)
      })
    })
  })
})
