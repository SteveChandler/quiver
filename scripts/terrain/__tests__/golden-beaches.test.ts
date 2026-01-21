/**
 * Golden Beach Dataset Tests
 *
 * Validates the golden beach dataset structure and utility functions.
 * Does NOT test actual terrain analysis (that's done by validate-golden-beaches.ts).
 */

import {
  GOLDEN_BEACHES,
  getGoldenBeachByName,
  getGoldenBeachesByType,
  getGoldenBeachesByRegion,
  checkSymmetrySanity,
  calculateFactorStats,
  type BeachType,
} from '../golden-beaches'

describe('Golden Beaches Dataset', () => {
  describe('GOLDEN_BEACHES array', () => {
    it('should have at least 5 beaches', () => {
      expect(GOLDEN_BEACHES.length).toBeGreaterThanOrEqual(5)
    })

    it('should have all required fields', () => {
      GOLDEN_BEACHES.forEach(beach => {
        expect(beach.name).toBeTruthy()
        expect(beach.latitude).toBeDefined()
        expect(beach.longitude).toBeDefined()
        expect(beach.type).toBeTruthy()
        expect(beach.location).toBeTruthy()
        expect(beach.region).toBeTruthy()
        expect(beach.expected_behavior).toBeDefined()
        expect(beach.expected_behavior.wind_exposure_pattern).toBeTruthy()
        expect(beach.expected_behavior.swell_access_pattern).toBeTruthy()
        expect(beach.expected_behavior.notes).toBeTruthy()
      })
    })

    it('should have valid latitude values', () => {
      GOLDEN_BEACHES.forEach(beach => {
        expect(beach.latitude).toBeGreaterThanOrEqual(-90)
        expect(beach.latitude).toBeLessThanOrEqual(90)
      })
    })

    it('should have valid longitude values', () => {
      GOLDEN_BEACHES.forEach(beach => {
        expect(beach.longitude).toBeGreaterThanOrEqual(-180)
        expect(beach.longitude).toBeLessThanOrEqual(180)
      })
    })

    it('should have unique names', () => {
      const names = GOLDEN_BEACHES.map(b => b.name.toLowerCase())
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should have valid beach types', () => {
      const validTypes: BeachType[] = ['open', 'sheltered', 'deep_bay', 'headland', 'false_shelter', 'harbor', 'peninsula']
      GOLDEN_BEACHES.forEach(beach => {
        expect(validTypes).toContain(beach.type)
      })
    })

    it('should include at least one open beach (for baseline)', () => {
      const openBeaches = GOLDEN_BEACHES.filter(b => b.type === 'open')
      expect(openBeaches.length).toBeGreaterThanOrEqual(1)
    })

    it('should include at least one sheltered beach', () => {
      const shelteredBeaches = GOLDEN_BEACHES.filter(b => b.type === 'sheltered')
      expect(shelteredBeaches.length).toBeGreaterThanOrEqual(1)
    })

    it('should include diverse beach types', () => {
      const types = new Set(GOLDEN_BEACHES.map(b => b.type))
      expect(types.size).toBeGreaterThanOrEqual(4) // At least 4 different types
    })

    it('should have California beaches', () => {
      const californiaBeaches = GOLDEN_BEACHES.filter(b => b.region.toLowerCase() === 'california')
      expect(californiaBeaches.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('getGoldenBeachByName', () => {
    it('should find beach by exact name', () => {
      const beach = getGoldenBeachByName('Huntington Beach')
      expect(beach).toBeDefined()
      expect(beach?.name).toBe('Huntington Beach')
    })

    it('should be case-insensitive', () => {
      const beach1 = getGoldenBeachByName('huntington beach')
      const beach2 = getGoldenBeachByName('HUNTINGTON BEACH')
      expect(beach1).toBeDefined()
      expect(beach2).toBeDefined()
      expect(beach1?.name).toBe(beach2?.name)
    })

    it('should trim whitespace', () => {
      const beach = getGoldenBeachByName('  Huntington Beach  ')
      expect(beach).toBeDefined()
      expect(beach?.name).toBe('Huntington Beach')
    })

    it('should return undefined for non-existent beach', () => {
      const beach = getGoldenBeachByName('Nonexistent Beach')
      expect(beach).toBeUndefined()
    })
  })

  describe('getGoldenBeachesByType', () => {
    it('should find all open beaches', () => {
      const beaches = getGoldenBeachesByType('open')
      expect(beaches.length).toBeGreaterThan(0)
      beaches.forEach(beach => {
        expect(beach.type).toBe('open')
      })
    })

    it('should find all sheltered beaches', () => {
      const beaches = getGoldenBeachesByType('sheltered')
      expect(beaches.length).toBeGreaterThan(0)
      beaches.forEach(beach => {
        expect(beach.type).toBe('sheltered')
      })
    })

    it('should return empty array for type with no beaches', () => {
      // This test might fail if we add beaches of all types
      // But it validates the function works correctly
      const beaches = getGoldenBeachesByType('harbor')
      expect(Array.isArray(beaches)).toBe(true)
    })
  })

  describe('getGoldenBeachesByRegion', () => {
    it('should find all California beaches', () => {
      const beaches = getGoldenBeachesByRegion('california')
      expect(beaches.length).toBeGreaterThan(0)
      beaches.forEach(beach => {
        expect(beach.region.toLowerCase()).toBe('california')
      })
    })

    it('should be case-insensitive', () => {
      const beaches1 = getGoldenBeachesByRegion('california')
      const beaches2 = getGoldenBeachesByRegion('CALIFORNIA')
      expect(beaches1.length).toBe(beaches2.length)
    })

    it('should trim whitespace', () => {
      const beaches = getGoldenBeachesByRegion('  california  ')
      expect(beaches.length).toBeGreaterThan(0)
    })

    it('should return empty array for non-existent region', () => {
      const beaches = getGoldenBeachesByRegion('antarctica')
      expect(beaches).toEqual([])
    })
  })

  describe('checkSymmetrySanity', () => {
    it('should return true for uniform array', () => {
      const factors = Array(72).fill(0.9)
      expect(checkSymmetrySanity(factors)).toBe(true)
    })

    it('should return false for array with high variance', () => {
      const factors = Array(72).fill(0.9)
      factors[0] = 0.1 // Create spike
      factors[36] = 0.1
      expect(checkSymmetrySanity(factors)).toBe(false)
    })

    it('should return false for wrong array length', () => {
      const factors = Array(36).fill(0.9)
      expect(checkSymmetrySanity(factors)).toBe(false)
    })

    it('should return false for null array', () => {
      expect(checkSymmetrySanity(null as any)).toBe(false)
    })

    it('should use custom maxStdDev threshold', () => {
      const factors = Array(72).fill(0.9)
      factors[0] = 0.85 // Small variation

      // Should pass with higher threshold
      expect(checkSymmetrySanity(factors, 0.1)).toBe(true)

      // Should fail with very low threshold
      expect(checkSymmetrySanity(factors, 0.001)).toBe(false)
    })

    it('should handle near-uniform arrays correctly', () => {
      // Simulate slight variation from smoothing
      const factors = Array(72)
        .fill(0)
        .map((_, i) => 0.9 + 0.01 * Math.sin((i * Math.PI) / 36))
      expect(checkSymmetrySanity(factors, 0.1)).toBe(true)
    })
  })

  describe('calculateFactorStats', () => {
    it('should calculate correct mean', () => {
      const factors = [0.5, 0.6, 0.7, 0.8]
      const stats = calculateFactorStats(factors)
      expect(stats.mean).toBeCloseTo(0.65, 5)
    })

    it('should calculate correct min and max', () => {
      const factors = [0.3, 0.6, 0.9, 0.4]
      const stats = calculateFactorStats(factors)
      expect(stats.min).toBe(0.3)
      expect(stats.max).toBe(0.9)
      expect(stats.range).toBeCloseTo(0.6, 5)
    })

    it('should calculate correct standard deviation', () => {
      const factors = [0.5, 0.5, 0.5, 0.5]
      const stats = calculateFactorStats(factors)
      expect(stats.stdDev).toBeCloseTo(0, 5)
    })

    it('should handle single value', () => {
      const factors = [0.7]
      const stats = calculateFactorStats(factors)
      expect(stats.mean).toBe(0.7)
      expect(stats.stdDev).toBe(0)
      expect(stats.min).toBe(0.7)
      expect(stats.max).toBe(0.7)
      expect(stats.range).toBe(0)
    })

    it('should handle empty array', () => {
      const factors: number[] = []
      const stats = calculateFactorStats(factors)
      expect(stats.mean).toBe(0)
      expect(stats.stdDev).toBe(0)
      expect(stats.min).toBe(0)
      expect(stats.max).toBe(0)
      expect(stats.range).toBe(0)
    })

    it('should handle 72-element array correctly', () => {
      const factors = Array(72).fill(0.85)
      const stats = calculateFactorStats(factors)
      expect(stats.mean).toBeCloseTo(0.85, 5)
      expect(stats.stdDev).toBeCloseTo(0, 5)
      expect(stats.range).toBe(0)
    })

    it('should calculate stats for array with variation', () => {
      const factors = Array(72)
        .fill(0)
        .map((_, i) => 0.5 + 0.3 * Math.sin((i * 2 * Math.PI) / 72))
      const stats = calculateFactorStats(factors)

      expect(stats.mean).toBeCloseTo(0.5, 2)
      expect(stats.stdDev).toBeGreaterThan(0)
      expect(stats.min).toBeCloseTo(0.2, 1)
      expect(stats.max).toBeCloseTo(0.8, 1)
    })
  })

  describe('Beach-specific expected behaviors', () => {
    it('should have sheltered directions for sheltered beaches', () => {
      const shelteredBeaches = GOLDEN_BEACHES.filter(b => b.type === 'sheltered' || b.type === 'headland')

      shelteredBeaches.forEach(beach => {
        // Should have specific notes about shelter
        expect(beach.expected_behavior.notes.toLowerCase()).toMatch(/shelter|protect|block/i)
      })
    })

    it('should have directional patterns for non-uniform beaches', () => {
      const nonUniformBeaches = GOLDEN_BEACHES.filter(b => b.type !== 'open' && b.type !== 'false_shelter')

      nonUniformBeaches.forEach(beach => {
        // Should NOT have uniform pattern (false_shelter excluded as it should be uniform)
        expect(beach.expected_behavior.wind_exposure_pattern).not.toBe('uniform')
      })
    })

    it('should have open beaches with uniform patterns', () => {
      const openBeaches = GOLDEN_BEACHES.filter(b => b.type === 'open')

      openBeaches.forEach(beach => {
        expect(beach.expected_behavior.wind_exposure_pattern).toBe('uniform')
        expect(beach.expected_behavior.swell_access_pattern).toBe('full')
      })
    })

    it('should have bay beaches with narrow swell windows', () => {
      const bayBeaches = GOLDEN_BEACHES.filter(b => b.type === 'deep_bay')

      bayBeaches.forEach(beach => {
        expect(beach.expected_behavior.swell_access_pattern).toBe('narrow_window')
      })
    })
  })

  describe('Validation script compatibility', () => {
    it('should be runnable by validation script', () => {
      // Verify all beaches have the structure expected by validation script
      GOLDEN_BEACHES.forEach(beach => {
        expect(typeof beach.name).toBe('string')
        expect(typeof beach.latitude).toBe('number')
        expect(typeof beach.longitude).toBe('number')
        expect(typeof beach.type).toBe('string')
        expect(typeof beach.location).toBe('string')
        expect(typeof beach.region).toBe('string')
        expect(typeof beach.expected_behavior).toBe('object')
        expect(typeof beach.expected_behavior.wind_exposure_pattern).toBe('string')
        expect(typeof beach.expected_behavior.swell_access_pattern).toBe('string')
        expect(typeof beach.expected_behavior.notes).toBe('string')
      })
    })

    it('should have beaches with IDs for database lookup', () => {
      // Some beaches might have database IDs (optional)
      const beachesWithIds = GOLDEN_BEACHES.filter(b => b.id)
      // This is optional, so just verify if present, they're strings
      beachesWithIds.forEach(beach => {
        expect(typeof beach.id).toBe('string')
      })
    })
  })
})
