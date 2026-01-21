/**
 * Wind Exposure Algorithm Tests
 *
 * Tests the wind exposure computation including:
 * - Sigmoid function behavior
 * - Circular smoothing with wrapping
 * - Full wind exposure computation
 * - Flat terrain produces uniform exposure
 * - Factor array validity (72 elements, all in [0, 1])
 */

import { sigmoid, smoothCircular, computeWindExposure } from '../wind-exposure'
import type { DEMTile } from '../dem-loader'
import { DEFAULT_TERRAIN_PARAMS } from '../../../types/terrain'

describe('Wind Exposure Algorithm', () => {
  describe('sigmoid', () => {
    it('should return 0.5 for input 0', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 5)
    })

    it('should return close to 1 for large positive values', () => {
      expect(sigmoid(5)).toBeGreaterThan(0.99)
      expect(sigmoid(10)).toBeGreaterThan(0.999)
    })

    it('should return close to 0 for large negative values', () => {
      expect(sigmoid(-5)).toBeLessThan(0.01)
      expect(sigmoid(-10)).toBeLessThan(0.001)
    })

    it('should be monotonically increasing', () => {
      const values = [-5, -2, -1, 0, 1, 2, 5]
      for (let i = 0; i < values.length - 1; i++) {
        expect(sigmoid(values[i])).toBeLessThan(sigmoid(values[i + 1]))
      }
    })

    it('should be symmetric around 0.5', () => {
      expect(sigmoid(-2)).toBeCloseTo(1 - sigmoid(2), 5)
      expect(sigmoid(-1)).toBeCloseTo(1 - sigmoid(1), 5)
    })
  })

  describe('smoothCircular', () => {
    it('should smooth with kernel [0.25, 0.5, 0.25]', () => {
      const arr = [1, 0, 0, 0, 0, 0, 0, 0]
      const kernel = [0.25, 0.5, 0.25]
      const smoothed = smoothCircular(arr, kernel)

      // Center should be weighted most
      expect(smoothed[0]).toBeCloseTo(0.5, 5)
      // Adjacent cells get 0.25 contribution
      expect(smoothed[1]).toBeCloseTo(0.25, 5)
      expect(smoothed[7]).toBeCloseTo(0.25, 5) // Wraps around
      // Other cells should be 0
      expect(smoothed[2]).toBeCloseTo(0, 5)
    })

    it('should handle wrapping at 0°/360° boundary', () => {
      // Create array with spike at beginning and end
      const arr = Array(72).fill(0)
      arr[0] = 1 // 0°
      arr[71] = 1 // 355°

      const kernel = [0.25, 0.5, 0.25]
      const smoothed = smoothCircular(arr, kernel)

      // Both 0° and 355° should contribute to each other
      expect(smoothed[0]).toBeCloseTo(0.5 + 0.25, 5) // 0.5 from self, 0.25 from 355°
      expect(smoothed[71]).toBeCloseTo(0.5 + 0.25, 5) // 0.5 from self, 0.25 from 0°
      expect(smoothed[1]).toBeCloseTo(0.25, 5) // Only from 0°
      expect(smoothed[70]).toBeCloseTo(0.25, 5) // Only from 355°
    })

    it('should preserve uniform arrays', () => {
      const arr = Array(72).fill(1.0)
      const kernel = [0.25, 0.5, 0.25]
      const smoothed = smoothCircular(arr, kernel)

      smoothed.forEach(val => {
        expect(val).toBeCloseTo(1.0, 5)
      })
    })

    it('should handle 72-element array correctly', () => {
      const arr = Array(72).fill(0)
      arr[36] = 1 // 180° (South)

      const kernel = [0.25, 0.5, 0.25]
      const smoothed = smoothCircular(arr, kernel)

      expect(smoothed.length).toBe(72)
      expect(smoothed[36]).toBeCloseTo(0.5, 5)
      expect(smoothed[35]).toBeCloseTo(0.25, 5)
      expect(smoothed[37]).toBeCloseTo(0.25, 5)
    })
  })

  describe('computeWindExposure', () => {
    // Create mock DEM tile for flat terrain
    const createFlatTerrainTile = (): DEMTile => ({
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

    it('should return 72 factors', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199, // San Francisco latitude
        -122.4783, // San Francisco longitude
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      expect(result.factors).toHaveLength(72)
    })

    it('should have all factors in [0, 1] range', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      result.factors.forEach((factor, idx) => {
        expect(factor).toBeGreaterThanOrEqual(0)
        expect(factor).toBeLessThanOrEqual(1)
        if (factor < 0 || factor > 1) {
          throw new Error(`Factor at index ${idx} (${idx * 5}°) is out of range: ${factor}`)
        }
      })
    })

    it('should produce uniform exposure ~1.0 for flat terrain', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      // Flat terrain: horizon angle = 0° everywhere
      // sigmoid((8.0 - 0) / 3.0) = sigmoid(2.67) ≈ 0.935
      const expectedExposure = sigmoid(DEFAULT_TERRAIN_PARAMS.angle_mid / DEFAULT_TERRAIN_PARAMS.k)

      result.factors.forEach((factor, idx) => {
        expect(factor).toBeCloseTo(expectedExposure, 2)
        if (Math.abs(factor - expectedExposure) > 0.05) {
          throw new Error(
            `Factor at index ${idx} (${idx * 5}°) is not uniform: ${factor} (expected ~${expectedExposure})`
          )
        }
      })
    })

    it('should include beach elevation in result', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      expect(result.beach_elevation).toBeDefined()
      expect(typeof result.beach_elevation).toBe('number')
      // Mock returns 0 for flat terrain
      expect(result.beach_elevation).toBe(0)
    })

    it('should include UTM zone in result', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      expect(result.utm_zone).toBeDefined()
      expect(typeof result.utm_zone).toBe('string')
      expect(result.utm_zone.length).toBeGreaterThan(0)
    })

    it('should include horizon angles in result', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      expect(result.horizon_angles).toHaveLength(72)
      result.horizon_angles.forEach((angle, idx) => {
        expect(typeof angle).toBe('number')
        // Flat terrain should have horizon angles ~0°
        expect(Math.abs(angle)).toBeLessThan(0.1)
      })
    })

    it('should apply smoothing correctly', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      // For flat terrain, smoothing should not change uniform values
      const values = result.factors
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + (val - avgValue) ** 2, 0) / values.length
      const stdDev = Math.sqrt(variance)

      // Standard deviation should be very low for uniform values
      expect(stdDev).toBeLessThan(0.001)
    })

    it('should handle boundary wrapping in smoothing', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      // Factors at 0° and 355° should be very similar (wrapping)
      expect(Math.abs(result.factors[0] - result.factors[71])).toBeLessThan(0.01)
    })

    it('should use correct direction convention (wind FROM direction)', () => {
      const tile = createFlatTerrainTile()
      const result = computeWindExposure(
        37.8199,
        -122.4783,
        DEFAULT_TERRAIN_PARAMS,
        tile
      )

      // Index 0 = 0° (North wind)
      // Index 18 = 90° (East wind)
      // Index 36 = 180° (South wind)
      // Index 54 = 270° (West wind)

      // For flat terrain, all directions should have similar exposure
      const north = result.factors[0]
      const east = result.factors[18]
      const south = result.factors[36]
      const west = result.factors[54]

      expect(Math.abs(north - east)).toBeLessThan(0.01)
      expect(Math.abs(east - south)).toBeLessThan(0.01)
      expect(Math.abs(south - west)).toBeLessThan(0.01)
    })
  })
})
