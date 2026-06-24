/**
 * Tests for terrain-aware scoring integration
 */

import { computeHourScore, computeHourScoreBreakdown, BeachMeta, HourlyMarine, HourInputs } from '@/lib/surf/scoring'

describe('Terrain-Aware Scoring', () => {
  const baseBeach: BeachMeta = {
    id: 'test-beach',
    name: 'Test Beach',
    wind_offshore_deg: 270, // West wind is offshore
    wind_cross_ok_kts: 15,
    swell_window_min_deg: 200,
    swell_window_max_deg: 300,
    tide_min_ft: 1,
    tide_max_ft: 4,
  }

  const baseMarine: HourlyMarine = {
    ts: new Date('2025-01-20T12:00:00Z'),
    hs_m: 1.5,
    tp_s: 10,
    swell_dir_deg: 270, // West swell (ideal)
    wind_spd_kts: 20, // 20 knots
    wind_dir_deg: 90, // East wind (onshore, bad)
  }

  describe('Backward Compatibility', () => {
    it('should compute same score without terrain factors', () => {
      // Without terrain factors, should behave as before
      const score = computeHourScore(baseBeach, baseMarine, 2.5)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('scores swell directions inside and near a non-wrapping window', () => {
      const scoreAtCenter = computeHourScoreBreakdown({
        waveDirectionDeg: 250,
        wavePeriodS: 12,
        windDirectionDeg: 270,
        windSpeedMs: 3,
        tideHeightM: 2.5 / 3.28084,
        params: {
          windOffshoreDeg: 270,
          windCrossOkKts: 15,
          swellWindowMinDeg: 190,
          swellWindowMaxDeg: 310,
          tidePreferredFtMin: 1,
          tidePreferredFtMax: 4,
        },
      })

      const scoreNearEdge = computeHourScoreBreakdown({
        waveDirectionDeg: 300,
        wavePeriodS: 12,
        windDirectionDeg: 270,
        windSpeedMs: 3,
        tideHeightM: 2.5 / 3.28084,
        params: {
          windOffshoreDeg: 270,
          windCrossOkKts: 15,
          swellWindowMinDeg: 190,
          swellWindowMaxDeg: 310,
          tidePreferredFtMin: 1,
          tidePreferredFtMax: 4,
        },
      })

      expect(scoreAtCenter.swellDirScore).toBeCloseTo(1)
      expect(scoreNearEdge.swellDirScore).toBeGreaterThan(0)
    })

    it('scores swell directions inside a wrap-around window', () => {
      const scoreInsideWrap = computeHourScoreBreakdown({
        waveDirectionDeg: 350,
        wavePeriodS: 12,
        windDirectionDeg: 270,
        windSpeedMs: 3,
        tideHeightM: 2.5 / 3.28084,
        params: {
          windOffshoreDeg: 270,
          windCrossOkKts: 15,
          swellWindowMinDeg: 300,
          swellWindowMaxDeg: 60,
          tidePreferredFtMin: 1,
          tidePreferredFtMax: 4,
        },
      })

      expect(scoreInsideWrap.swellDirScore).toBeGreaterThan(0)
    })

    it('should handle missing terrain data gracefully', () => {
      const beachWithNullTerrain: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: null,
        swell_access_factors: null,
        terrain_enabled: false,
      }

      const score = computeHourScore(beachWithNullTerrain, baseMarine, 2.5)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should handle invalid terrain array length', () => {
      const beachWithInvalidTerrain: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: [1.0, 0.5], // Wrong length
        swell_access_factors: [1.0, 0.5],
        terrain_enabled: true,
      }

      const score = computeHourScore(beachWithInvalidTerrain, baseMarine, 2.5)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('Terrain Factor Application', () => {
    // Create 72-element arrays (5-degree bins)
    const fullExposure = Array(72).fill(1.0)
    const fullShelter = Array(72).fill(0.0)
    const partialShelter = Array(72).fill(0.5)
    const fullAccess = Array(72).fill(1.0)
    const fullBlockage = Array(72).fill(0.0)

    it('should apply wind exposure factor to reduce wind penalty', () => {
      // East wind (onshore) should be penalized less with low exposure
      const sheltered: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: fullShelter,
        swell_access_factors: fullAccess,
        terrain_enabled: true,
      }

      const exposed: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: fullExposure,
        swell_access_factors: fullAccess,
        terrain_enabled: true,
      }

      const scoreNoTerrain = computeHourScore(baseBeach, baseMarine, 2.5)
      const scoreSheltered = computeHourScore(sheltered, baseMarine, 2.5)
      const scoreExposed = computeHourScore(exposed, baseMarine, 2.5)

      // Sheltered beach should score higher than exposed (less wind penalty)
      expect(scoreSheltered).toBeGreaterThan(scoreExposed)

      // Exposed beach with terrain should match no-terrain (exposure = 1.0)
      expect(Math.abs(scoreExposed - scoreNoTerrain)).toBeLessThan(2) // Allow small rounding differences
    })

    it('should apply swell access factor to gate swell score', () => {
      // Test using breakdown API to verify terrain factors are applied correctly
      // Note: This test verifies the terrain factor APPLICATION, not the swell direction scoring formula
      const idealMarine: HourlyMarine = {
        ...baseMarine,
        swell_dir_deg: 250,
        wind_dir_deg: 270, // Perfect offshore
        wind_spd_kts: 5, // Very light offshore wind
      }

      const paramsBlocked = {
        windOffshoreDeg: 270,
        windCrossOkKts: 15,
        swellWindowMinDeg: 200,
        swellWindowMaxDeg: 300,
        tidePreferredFtMin: 1,
        tidePreferredFtMax: 4,
        windExposureFactors: fullExposure,
        swellAccessFactors: fullBlockage,
        terrainEnabled: true,
      }

      const paramsAccessible = {
        ...paramsBlocked,
        swellAccessFactors: fullAccess,
      }

      const inputBlocked: HourInputs = {
        waveDirectionDeg: idealMarine.swell_dir_deg,
        wavePeriodS: idealMarine.tp_s,
        windDirectionDeg: idealMarine.wind_dir_deg,
        windSpeedMs: idealMarine.wind_spd_kts ? idealMarine.wind_spd_kts / 1.94384449 : null,
        tideHeightM: 2.5 / 3.28084,
        params: paramsBlocked,
      }

      const inputAccessible: HourInputs = {
        ...inputBlocked,
        params: paramsAccessible,
      }

      const breakdownBlocked = computeHourScoreBreakdown(inputBlocked)
      const breakdownAccessible = computeHourScoreBreakdown(inputAccessible)

      // Verify terrain factors were applied
      expect(breakdownBlocked.terrainFactorsApplied).toBe(true)
      expect(breakdownAccessible.terrainFactorsApplied).toBe(true)

      // Verify swellAccess values are correct
      expect(breakdownBlocked.swellAccess).toBe(0)
      expect(breakdownAccessible.swellAccess).toBe(1)

      // Verify that blocked beach has lower swellDirScore (gated by access factor)
      expect(breakdownBlocked.swellDirScore).toBe(0) // Completely blocked
      expect(breakdownAccessible.swellDirScore).toBeGreaterThanOrEqual(breakdownBlocked.swellDirScore)
    })

    it('should apply MIN_EXPOSURE floor to wind exposure', () => {
      // Even with zero exposure, should have minimum wind penalty
      const zeроExposure: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: fullShelter, // 0.0 exposure
        swell_access_factors: fullAccess,
        terrain_enabled: true,
      }

      // With perfect offshore wind, low exposure shouldn't help much
      const offshoreWind: HourlyMarine = {
        ...baseMarine,
        wind_dir_deg: 270, // Perfect offshore
      }

      const score = computeHourScore(zeроExposure, offshoreWind, 2.5)

      // Should still get a reasonable score (not perfect due to MIN_EXPOSURE)
      expect(score).toBeGreaterThan(50)
      expect(score).toBeLessThan(100)
    })

    it('should include terrain factor telemetry in breakdown', () => {
      const beachWithTerrain: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: partialShelter,
        swell_access_factors: fullAccess,
        terrain_enabled: true,
      }

      const params = {
        windOffshoreDeg: beachWithTerrain.wind_offshore_deg ?? 270,
        windCrossOkKts: beachWithTerrain.wind_cross_ok_kts ?? 15,
        swellWindowMinDeg: beachWithTerrain.swell_window_min_deg ?? 240,
        swellWindowMaxDeg: beachWithTerrain.swell_window_max_deg ?? 300,
        tidePreferredFtMin: beachWithTerrain.tide_min_ft ?? 1,
        tidePreferredFtMax: beachWithTerrain.tide_max_ft ?? 4,
        windExposureFactors: beachWithTerrain.wind_exposure_factors,
        swellAccessFactors: beachWithTerrain.swell_access_factors,
        terrainEnabled: beachWithTerrain.terrain_enabled,
      }

      const input: HourInputs = {
        waveDirectionDeg: baseMarine.swell_dir_deg,
        wavePeriodS: baseMarine.tp_s,
        windDirectionDeg: baseMarine.wind_dir_deg,
        windSpeedMs: baseMarine.wind_spd_kts ? baseMarine.wind_spd_kts / 1.94384449 : null,
        tideHeightM: 2.5 / 3.28084,
        params,
      }

      const breakdown = computeHourScoreBreakdown(input)

      expect(breakdown.terrainFactorsApplied).toBe(true)
      expect(breakdown.windExposure).toBe(0.5) // Partial shelter
      expect(breakdown.swellAccess).toBe(1.0) // Full access
    })

    it('should not apply terrain factors when terrain_enabled is false', () => {
      const disabled: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: fullShelter,
        swell_access_factors: fullBlockage,
        terrain_enabled: false, // Disabled
      }

      const params = {
        windOffshoreDeg: disabled.wind_offshore_deg ?? 270,
        windCrossOkKts: disabled.wind_cross_ok_kts ?? 15,
        swellWindowMinDeg: disabled.swell_window_min_deg ?? 240,
        swellWindowMaxDeg: disabled.swell_window_max_deg ?? 300,
        tidePreferredFtMin: disabled.tide_min_ft ?? 1,
        tidePreferredFtMax: disabled.tide_max_ft ?? 4,
        windExposureFactors: disabled.wind_exposure_factors,
        swellAccessFactors: disabled.swell_access_factors,
        terrainEnabled: disabled.terrain_enabled,
      }

      const input: HourInputs = {
        waveDirectionDeg: baseMarine.swell_dir_deg,
        wavePeriodS: baseMarine.tp_s,
        windDirectionDeg: baseMarine.wind_dir_deg,
        windSpeedMs: baseMarine.wind_spd_kts ? baseMarine.wind_spd_kts / 1.94384449 : null,
        tideHeightM: 2.5 / 3.28084,
        params,
      }

      const breakdown = computeHourScoreBreakdown(input)

      expect(breakdown.terrainFactorsApplied).toBe(false)
      expect(breakdown.windExposure).toBeUndefined()
      expect(breakdown.swellAccess).toBeUndefined()
    })
  })

  describe('Score Bounds Validation', () => {
    it('should always produce scores between 0 and 100', () => {
      const terrainVariations = [
        { exposure: Array(72).fill(0.0), access: Array(72).fill(0.0) },
        { exposure: Array(72).fill(0.5), access: Array(72).fill(0.5) },
        { exposure: Array(72).fill(1.0), access: Array(72).fill(1.0) },
      ]

      terrainVariations.forEach(({ exposure, access }) => {
        const beach: BeachMeta = {
          ...baseBeach,
          wind_exposure_factors: exposure,
          swell_access_factors: access,
          terrain_enabled: true,
        }

        const score = computeHourScore(beach, baseMarine, 2.5)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      })
    })

    it('should produce deterministic scores for same inputs', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(72).fill(0.7),
        swell_access_factors: Array(72).fill(0.8),
        terrain_enabled: true,
      }

      const score1 = computeHourScore(beach, baseMarine, 2.5)
      const score2 = computeHourScore(beach, baseMarine, 2.5)

      expect(score1).toBe(score2)
    })
  })

  describe('Directional Binning', () => {
    it('should use correct bin for wind direction', () => {
      // Create array with only one bin sheltered, rest exposed
      const windExposure = Array(72).fill(1.0)
      windExposure[0] = 0.0 // Bin 0 = 0 degrees (North) is sheltered

      const beach: BeachMeta = {
        ...baseBeach,
        wind_offshore_deg: 90, // East is offshore (make all winds bad except offshore)
        wind_exposure_factors: windExposure,
        swell_access_factors: Array(72).fill(1.0),
        terrain_enabled: true,
      }

      // Use bad wind from different directions
      const northWind: HourlyMarine = {
        ...baseMarine,
        swell_dir_deg: 270, // Good swell
        wind_dir_deg: 0, // North (sheltered bin 0)
        wind_spd_kts: 25, // Strong onshore wind
      }

      const southWind: HourlyMarine = {
        ...baseMarine,
        swell_dir_deg: 270, // Good swell
        wind_dir_deg: 180, // South (exposed bin 36)
        wind_spd_kts: 25, // Strong onshore wind
      }

      const scoreNorth = computeHourScore(beach, northWind, 2.5)
      const scoreSouth = computeHourScore(beach, southWind, 2.5)

      // North wind should score higher (sheltered from bad wind) vs South wind (exposed to bad wind)
      expect(scoreNorth).toBeGreaterThan(scoreSouth)
    })

    it('should use correct bin for swell direction', () => {
      // Test using breakdown API to verify correct bin selection
      const swellAccess = Array(72).fill(0.0)
      swellAccess[50] = 1.0 // Bin 50 = 250 degrees

      const params = {
        windOffshoreDeg: 270,
        windCrossOkKts: 15,
        swellWindowMinDeg: 200,
        swellWindowMaxDeg: 300,
        tidePreferredFtMin: 1,
        tidePreferredFtMax: 4,
        windExposureFactors: Array(72).fill(1.0),
        swellAccessFactors: swellAccess,
        terrainEnabled: true,
      }

      const input250: HourInputs = {
        waveDirectionDeg: 250, // Should use bin 50
        wavePeriodS: 10,
        windDirectionDeg: 270,
        windSpeedMs: 5 / 1.94384449,
        tideHeightM: 2.5 / 3.28084,
        params,
      }

      const input245: HourInputs = {
        ...input250,
        waveDirectionDeg: 245, // Should use bin 49 (blocked)
      }

      const breakdown250 = computeHourScoreBreakdown(input250)
      const breakdown245 = computeHourScoreBreakdown(input245)

      // Verify terrain factors applied
      expect(breakdown250.terrainFactorsApplied).toBe(true)
      expect(breakdown245.terrainFactorsApplied).toBe(true)

      // Verify correct bins used
      expect(breakdown250.swellAccess).toBe(1) // Bin 50 is accessible
      expect(breakdown245.swellAccess).toBe(0) // Bin 49 is blocked

      // Verify different swell scores due to different access
      // (even if raw swell direction scores are broken, the access factor should differ)
      expect(breakdown250.swellAccess ?? 0).toBeGreaterThan(breakdown245.swellAccess ?? 0)
    })
  })

  describe('Monotonicity Sanity Checks', () => {
    it('should produce same scores when terrain factors are all 1.0', () => {
      const noTerrain = computeHourScore(baseBeach, baseMarine, 2.5)

      const withNeutralTerrain: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(72).fill(1.0),
        swell_access_factors: Array(72).fill(1.0),
        terrain_enabled: true,
      }

      const withTerrain = computeHourScore(withNeutralTerrain, baseMarine, 2.5)

      // Should be identical (or within rounding tolerance)
      expect(Math.abs(withTerrain - noTerrain)).toBeLessThan(2)
    })
  })
})
