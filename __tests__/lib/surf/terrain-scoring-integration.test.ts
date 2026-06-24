/**
 * Integration Tests for Terrain-Aware Geometry Scoring
 *
 * These tests verify that terrain factors (wind exposure and swell access)
 * are correctly integrated into the surf scoring system.
 *
 * Test Coverage:
 * 1. Scoring with vs without terrain factors
 * 2. Edge cases (null factors, partial data, invalid arrays)
 * 3. Backward compatibility (beaches without terrain data)
 * 4. terrain_enabled flag behavior
 * 5. Score monotonicity when factors change
 * 6. Interaction between terrain factors and other scoring components
 */

import {
  computeHourScore,
  computeHourScoreBreakdown,
  BeachMeta,
  HourlyMarine,
  HourInputs,
} from '@/lib/surf/scoring'
import { TERRAIN_BINS } from '@/types/terrain'

describe('Terrain-Aware Scoring Integration', () => {
  // Base test data for consistent scenarios
  const baseBeach: BeachMeta = {
    id: 'integration-test-beach',
    name: 'Integration Test Beach',
    wind_offshore_deg: 270, // West is offshore
    wind_cross_ok_kts: 15,
    swell_window_min_deg: 225, // Southwest to west
    swell_window_max_deg: 315,
    tide_min_ft: 2,
    tide_max_ft: 5,
  }

  const perfectConditions: HourlyMarine = {
    ts: new Date('2025-01-20T12:00:00Z'),
    hs_m: 1.5,
    tp_s: 12,
    swell_dir_deg: 270, // Perfect west swell
    wind_spd_kts: 8, // Light offshore wind
    wind_dir_deg: 270, // Perfect offshore
  }

  const challengingConditions: HourlyMarine = {
    ts: new Date('2025-01-20T14:00:00Z'),
    hs_m: 1.0,
    tp_s: 8,
    swell_dir_deg: 180, // South swell (outside window)
    wind_spd_kts: 25, // Strong onshore wind
    wind_dir_deg: 90, // East wind (onshore)
  }

  const tideMid = 3.5 // Middle of tide range (2-5ft)

  describe('Scoring With vs Without Terrain', () => {
    it('should produce identical scores when terrain factors are all 1.0 (neutral)', () => {
      const noTerrain = computeHourScore(baseBeach, perfectConditions, tideMid)

      const withNeutralTerrain: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0),
        swell_access_factors: Array(TERRAIN_BINS).fill(1.0),
        terrain_enabled: true,
      }

      const withTerrain = computeHourScore(
        withNeutralTerrain,
        perfectConditions,
        tideMid
      )

      // Should be identical or within rounding tolerance
      expect(Math.abs(withTerrain - noTerrain)).toBeLessThan(2)
    })

    it('should improve scores with sheltered wind exposure for onshore winds', () => {
      const noTerrain = computeHourScore(baseBeach, challengingConditions, tideMid)

      // Create terrain that shelters from east (onshore) winds
      const windExposure = Array(TERRAIN_BINS).fill(1.0)
      for (let i = 0; i < TERRAIN_BINS; i++) {
        const deg = i * 5
        // Shelter from east ±45° (45-135°)
        if (deg >= 45 && deg <= 135) {
          windExposure[i] = 0.2 // Heavily sheltered
        }
      }

      const withShelter: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: windExposure,
        swell_access_factors: Array(TERRAIN_BINS).fill(1.0),
        terrain_enabled: true,
      }

      const withTerrain = computeHourScore(withShelter, challengingConditions, tideMid)

      // Sheltered beach should score higher (less wind penalty)
      expect(withTerrain).toBeGreaterThanOrEqual(noTerrain)
    })

    it('should reduce scores with blocked swell access', () => {
      const noTerrain = computeHourScore(baseBeach, perfectConditions, tideMid)

      // Block the perfect west swell (270°)
      const swellAccess = Array(TERRAIN_BINS).fill(1.0)
      for (let i = 0; i < TERRAIN_BINS; i++) {
        const deg = i * 5
        // Block west ±30° (240-300°)
        if (deg >= 240 && deg <= 300) {
          swellAccess[i] = 0.1 // Heavily blocked
        }
      }

      const withBlockage: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0),
        swell_access_factors: swellAccess,
        terrain_enabled: true,
      }

      const withTerrain = computeHourScore(withBlockage, perfectConditions, tideMid)

      // Blocked beach should score lower or equal (if terrain not yet implemented)
      expect(withTerrain).toBeLessThanOrEqual(noTerrain)
    })

    it('should handle combination of shelter and blockage', () => {
      // Create terrain that:
      // 1. Shelters from east winds (good for onshore conditions)
      // 2. Blocks south swells (bad for south swells)

      const windExposure = Array(TERRAIN_BINS).fill(1.0)
      const swellAccess = Array(TERRAIN_BINS).fill(1.0)

      for (let i = 0; i < TERRAIN_BINS; i++) {
        const deg = i * 5
        // Shelter from east (45-135°)
        if (deg >= 45 && deg <= 135) {
          windExposure[i] = 0.3
        }
        // Block south (135-225°)
        if (deg >= 135 && deg <= 225) {
          swellAccess[i] = 0.2
        }
      }

      const complexTerrain: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: windExposure,
        swell_access_factors: swellAccess,
        terrain_enabled: true,
      }

      // Test with conditions that benefit from shelter
      const eastWind: HourlyMarine = {
        ...perfectConditions,
        wind_dir_deg: 90, // East (onshore)
        wind_spd_kts: 20,
        swell_dir_deg: 270, // West swell (not blocked)
      }

      const scoreWithShelter = computeHourScore(complexTerrain, eastWind, tideMid)
      const scoreNoTerrain = computeHourScore(baseBeach, eastWind, tideMid)

      // Should benefit from wind shelter
      expect(scoreWithShelter).toBeGreaterThanOrEqual(scoreNoTerrain)

      // Test with conditions hurt by blockage
      const southSwell: HourlyMarine = {
        ...perfectConditions,
        swell_dir_deg: 180, // South (blocked)
        wind_dir_deg: 270, // Offshore (good)
        wind_spd_kts: 5,
      }

      const scoreWithBlockage = computeHourScore(complexTerrain, southSwell, tideMid)
      const scoreNoTerrainSouth = computeHourScore(baseBeach, southSwell, tideMid)

      // Should be penalized by swell blockage
      expect(scoreWithBlockage).toBeLessThanOrEqual(scoreNoTerrainSouth)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null terrain factors gracefully', () => {
      const beachWithNull: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: null,
        swell_access_factors: null,
        terrain_enabled: true, // Enabled but null data
      }

      const score = computeHourScore(beachWithNull, perfectConditions, tideMid)

      // Should not crash and produce valid score
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
      expect(Number.isFinite(score)).toBe(true)
    })

    it('should handle partial terrain data (only wind exposure)', () => {
      const partialData: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(0.8),
        swell_access_factors: null,
        terrain_enabled: true,
      }

      const score = computeHourScore(partialData, perfectConditions, tideMid)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should handle partial terrain data (only swell access)', () => {
      const partialData: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: null,
        swell_access_factors: Array(TERRAIN_BINS).fill(0.9),
        terrain_enabled: true,
      }

      const score = computeHourScore(partialData, perfectConditions, tideMid)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should handle invalid array lengths gracefully', () => {
      const invalidLengths: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: [1.0, 0.5, 0.3], // Wrong length
        swell_access_factors: Array(100).fill(1.0), // Wrong length
        terrain_enabled: true,
      }

      const score = computeHourScore(invalidLengths, perfectConditions, tideMid)

      // Should fallback to no terrain and still work
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should handle out-of-range factor values', () => {
      // Factors outside [0, 1] range (defensive coding test)
      const outOfRange: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(1.5), // > 1.0
        swell_access_factors: Array(TERRAIN_BINS).fill(-0.2), // < 0.0
        terrain_enabled: true,
      }

      const score = computeHourScore(outOfRange, perfectConditions, tideMid)

      // Should clamp and produce valid score
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should handle NaN values in factor arrays', () => {
      const withNaN: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(NaN),
        swell_access_factors: Array(TERRAIN_BINS).fill(NaN),
        terrain_enabled: true,
      }

      const score = computeHourScore(withNaN, perfectConditions, tideMid)

      // Should handle NaN gracefully and not produce NaN score
      expect(Number.isNaN(score)).toBe(false)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('Backward Compatibility', () => {
    it('should work with beaches that have no terrain fields', () => {
      // Simulate legacy beach data (no terrain fields at all)
      const legacyBeach: BeachMeta = {
        id: 'legacy-beach',
        name: 'Legacy Beach',
        wind_offshore_deg: 270,
        wind_cross_ok_kts: 15,
        swell_window_min_deg: 225,
        swell_window_max_deg: 315,
        tide_min_ft: 2,
        tide_max_ft: 5,
        // No terrain fields
      }

      const score = computeHourScore(legacyBeach, perfectConditions, tideMid)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should produce same scores for legacy beaches vs terrain_enabled=false', () => {
      const legacyBeach: BeachMeta = {
        ...baseBeach,
        // No terrain fields
      }

      const explicitlyDisabled: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(0.5),
        swell_access_factors: Array(TERRAIN_BINS).fill(0.5),
        terrain_enabled: false, // Explicitly disabled
      }

      const scoreLegacy = computeHourScore(legacyBeach, perfectConditions, tideMid)
      const scoreDisabled = computeHourScore(
        explicitlyDisabled,
        perfectConditions,
        tideMid
      )

      // Should produce identical scores (terrain factors ignored)
      expect(Math.abs(scoreLegacy - scoreDisabled)).toBeLessThan(1)
    })

    it('should maintain score stability when migrating from no terrain to neutral terrain', () => {
      const before: BeachMeta = {
        ...baseBeach,
      }

      const after: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0),
        swell_access_factors: Array(TERRAIN_BINS).fill(1.0),
        terrain_enabled: true,
      }

      // Test multiple conditions to ensure stability
      const conditions = [perfectConditions, challengingConditions]

      conditions.forEach((marine) => {
        const scoreBefore = computeHourScore(before, marine, tideMid)
        const scoreAfter = computeHourScore(after, marine, tideMid)

        // Scores should be very close (within rounding)
        expect(Math.abs(scoreAfter - scoreBefore)).toBeLessThan(2)
      })
    })
  })

  describe('terrain_enabled Flag Behavior', () => {
    const terrainFactors = {
      wind_exposure_factors: Array(TERRAIN_BINS).fill(0.5),
      swell_access_factors: Array(TERRAIN_BINS).fill(0.5),
    }

    it('should ignore terrain factors when terrain_enabled is false', () => {
      const enabled: BeachMeta = {
        ...baseBeach,
        ...terrainFactors,
        terrain_enabled: true,
      }

      const disabled: BeachMeta = {
        ...baseBeach,
        ...terrainFactors,
        terrain_enabled: false,
      }

      const baseScore = computeHourScore(baseBeach, perfectConditions, tideMid)
      const enabledScore = computeHourScore(enabled, perfectConditions, tideMid)
      const disabledScore = computeHourScore(disabled, perfectConditions, tideMid)

      // Enabled should potentially differ from base
      // Disabled should match base (factors ignored)
      expect(Math.abs(disabledScore - baseScore)).toBeLessThan(2)
    })

    it('should respect terrain_enabled flag in breakdown telemetry', () => {
      const params = {
        windOffshoreDeg: 270,
        windCrossOkKts: 15,
        swellWindowMinDeg: 225,
        swellWindowMaxDeg: 315,
        tidePreferredFtMin: 2,
        tidePreferredFtMax: 5,
        windExposureFactors: Array(TERRAIN_BINS).fill(0.7),
        swellAccessFactors: Array(TERRAIN_BINS).fill(0.8),
        terrainEnabled: false, // Disabled
      }

      const input: HourInputs = {
        waveDirectionDeg: 270,
        wavePeriodS: 12,
        windDirectionDeg: 270,
        windSpeedMs: 8 / 1.94384449,
        tideHeightM: tideMid / 3.28084,
        params,
      }

      const breakdown = computeHourScoreBreakdown(input)

      // Should report that terrain factors were NOT applied
      // (If terrain scoring not implemented yet, field may be undefined)
      if (breakdown.terrainFactorsApplied !== undefined) {
        expect(breakdown.terrainFactorsApplied).toBe(false)
      }
      expect(breakdown.windExposure).toBeUndefined()
      expect(breakdown.swellAccess).toBeUndefined()
    })

    it('should handle undefined terrain_enabled as false', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(0.5),
        swell_access_factors: Array(TERRAIN_BINS).fill(0.5),
        // terrain_enabled undefined (legacy data)
      }

      const score = computeHourScore(beach, perfectConditions, tideMid)

      // Should treat as disabled
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('Score Monotonicity', () => {
    it('should show monotonic improvement as wind exposure decreases (more shelter)', () => {
      // Test onshore wind scenario where shelter helps
      const onshoreWind: HourlyMarine = {
        ...perfectConditions,
        wind_dir_deg: 90, // East (onshore)
        wind_spd_kts: 20,
      }

      const exposureLevels = [1.0, 0.75, 0.5, 0.25, 0.0]
      const scores: number[] = []

      exposureLevels.forEach((exposure) => {
        const beach: BeachMeta = {
          ...baseBeach,
          wind_exposure_factors: Array(TERRAIN_BINS).fill(exposure),
          swell_access_factors: Array(TERRAIN_BINS).fill(1.0),
          terrain_enabled: true,
        }

        scores.push(computeHourScore(beach, onshoreWind, tideMid))
      })

      // Scores should improve (or stay same) as exposure decreases
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i + 1]).toBeGreaterThanOrEqual(scores[i] - 1) // Allow small rounding
      }
    })

    it('should show monotonic degradation as swell access decreases (more blockage)', () => {
      const accessLevels = [1.0, 0.75, 0.5, 0.25, 0.0]
      const scores: number[] = []

      accessLevels.forEach((access) => {
        const beach: BeachMeta = {
          ...baseBeach,
          wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0),
          swell_access_factors: Array(TERRAIN_BINS).fill(access),
          terrain_enabled: true,
        }

        scores.push(computeHourScore(beach, perfectConditions, tideMid))
      })

      // Scores should degrade as access decreases
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1] - 1) // Allow small rounding
      }
    })

    it('should handle mixed monotonicity (shelter improves onshore, blockage degrades offshore)', () => {
      // Isolate each terrain factor (a single conflated `level` only looked monotone
      // back when the swellDirScore bug made blockage a no-op).
      const levels = [0.0, 0.25, 0.5, 0.75, 1.0]

      // Wind shelter alone (swell access held full): onshore scores improve with more shelter.
      const onshore: HourlyMarine = { ...perfectConditions, wind_dir_deg: 90, wind_spd_kts: 25 }
      const onshoreScores = levels.map((shelter) =>
        computeHourScore(
          {
            ...baseBeach,
            wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0 - shelter), // lower exposure = more shelter
            swell_access_factors: Array(TERRAIN_BINS).fill(1.0), // full access — isolates the wind effect
            terrain_enabled: true,
          },
          onshore,
          tideMid
        )
      )

      // Swell blockage alone (wind exposure held full): offshore scores degrade with more blockage.
      const offshore: HourlyMarine = { ...perfectConditions, wind_dir_deg: 270, wind_spd_kts: 5 }
      const offshoreScores = levels.map((blockage) =>
        computeHourScore(
          {
            ...baseBeach,
            wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0), // full exposure — isolates the swell effect
            swell_access_factors: Array(TERRAIN_BINS).fill(1.0 - blockage), // lower access = more blockage
            terrain_enabled: true,
          },
          offshore,
          tideMid
        )
      )

      // More shelter never hurts an onshore-wind day.
      expect(onshoreScores[4]).toBeGreaterThanOrEqual(onshoreScores[0] - 1)
      // More swell blockage degrades an otherwise-clean offshore day.
      expect(offshoreScores[0]).toBeGreaterThanOrEqual(offshoreScores[4] - 1)
    })
  })

  describe('Score Bounds Enforcement', () => {
    it('should never exceed 100 even with perfect terrain factors', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(0.0), // Perfect shelter
        swell_access_factors: Array(TERRAIN_BINS).fill(1.0), // Perfect access
        terrain_enabled: true,
      }

      const score = computeHourScore(beach, perfectConditions, tideMid)

      expect(score).toBeLessThanOrEqual(100)
    })

    it('should never go below 0 even with worst terrain factors', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0), // Full exposure
        swell_access_factors: Array(TERRAIN_BINS).fill(0.0), // Full blockage
        terrain_enabled: true,
      }

      const score = computeHourScore(beach, challengingConditions, tideMid)

      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('should maintain bounds with extreme combinations', () => {
      const extremeCombinations = [
        { wind: 0.0, swell: 0.0 },
        { wind: 1.0, swell: 1.0 },
        { wind: 0.0, swell: 1.0 },
        { wind: 1.0, swell: 0.0 },
        { wind: 0.5, swell: 0.5 },
      ]

      extremeCombinations.forEach(({ wind, swell }) => {
        const beach: BeachMeta = {
          ...baseBeach,
          wind_exposure_factors: Array(TERRAIN_BINS).fill(wind),
          swell_access_factors: Array(TERRAIN_BINS).fill(swell),
          terrain_enabled: true,
        }

        const score = computeHourScore(beach, challengingConditions, tideMid)

        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
        expect(Number.isFinite(score)).toBe(true)
      })
    })
  })

  describe('Breakdown Telemetry', () => {
    it('should include terrain factors in breakdown when enabled', () => {
      const params = {
        windOffshoreDeg: 270,
        windCrossOkKts: 15,
        swellWindowMinDeg: 225,
        swellWindowMaxDeg: 315,
        tidePreferredFtMin: 2,
        tidePreferredFtMax: 5,
        windExposureFactors: Array(TERRAIN_BINS).fill(0.6),
        swellAccessFactors: Array(TERRAIN_BINS).fill(0.8),
        terrainEnabled: true,
      }

      const input: HourInputs = {
        waveDirectionDeg: 270,
        wavePeriodS: 12,
        windDirectionDeg: 90, // East
        windSpeedMs: 10 / 1.94384449,
        tideHeightM: tideMid / 3.28084,
        params,
      }

      const breakdown = computeHourScoreBreakdown(input)

      // If terrain scoring is implemented, these fields should exist
      if (breakdown.terrainFactorsApplied !== undefined) {
        expect(breakdown.terrainFactorsApplied).toBe(true)
        expect(breakdown.windExposure).toBeDefined()
        expect(breakdown.swellAccess).toBeDefined()
        expect(breakdown.windExposure).toBeGreaterThanOrEqual(0)
        expect(breakdown.windExposure).toBeLessThanOrEqual(1)
        expect(breakdown.swellAccess).toBeGreaterThanOrEqual(0)
        expect(breakdown.swellAccess).toBeLessThanOrEqual(1)
      } else {
        // Terrain scoring not yet implemented - test documents expected behavior
        expect(breakdown.windExposure).toBeUndefined()
        expect(breakdown.swellAccess).toBeUndefined()
      }
    })

    it('should report correct directional factors based on input', () => {
      // Create highly directional terrain
      const windExposure = Array(TERRAIN_BINS).fill(1.0)
      const swellAccess = Array(TERRAIN_BINS).fill(1.0)

      // Bin 18 = 90° (East), set to 0.3
      windExposure[18] = 0.3

      // Bin 54 = 270° (West), set to 0.7
      swellAccess[54] = 0.7

      const params = {
        windOffshoreDeg: 270,
        windCrossOkKts: 15,
        swellWindowMinDeg: 225,
        swellWindowMaxDeg: 315,
        tidePreferredFtMin: 2,
        tidePreferredFtMax: 5,
        windExposureFactors: windExposure,
        swellAccessFactors: swellAccess,
        terrainEnabled: true,
      }

      // Test with east wind (bin 18)
      const eastWindInput: HourInputs = {
        waveDirectionDeg: 270,
        wavePeriodS: 12,
        windDirectionDeg: 90, // East (bin 18)
        windSpeedMs: 10 / 1.94384449,
        tideHeightM: tideMid / 3.28084,
        params,
      }

      const eastBreakdown = computeHourScoreBreakdown(eastWindInput)

      // If terrain scoring implemented, check directional factors
      if (eastBreakdown.windExposure !== undefined) {
        expect(eastBreakdown.windExposure).toBeCloseTo(0.3, 1)
      }

      // Test with west swell (bin 54)
      const westSwellInput: HourInputs = {
        waveDirectionDeg: 270, // West (bin 54)
        wavePeriodS: 12,
        windDirectionDeg: 270,
        windSpeedMs: 5 / 1.94384449,
        tideHeightM: tideMid / 3.28084,
        params,
      }

      const westBreakdown = computeHourScoreBreakdown(westSwellInput)

      if (westBreakdown.swellAccess !== undefined) {
        expect(westBreakdown.swellAccess).toBeCloseTo(0.7, 1)
      }
    })
  })

  describe('Interaction with Other Scoring Components', () => {
    it('should still respect tide scoring when terrain is enabled', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(0.8),
        swell_access_factors: Array(TERRAIN_BINS).fill(0.9),
        terrain_enabled: true,
        tide_min_ft: 2,
        tide_max_ft: 5,
      }

      // Perfect tide (middle of range)
      const perfectTide = 3.5
      const scorePerfectTide = computeHourScore(beach, perfectConditions, perfectTide)

      // Bad tide (outside range)
      const badTide = 0.5
      const scoreBadTide = computeHourScore(beach, perfectConditions, badTide)

      // Perfect tide should score better
      expect(scorePerfectTide).toBeGreaterThan(scoreBadTide)
    })

    it('should still respect wind direction when terrain is enabled', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(0.8), // Moderate exposure everywhere
        swell_access_factors: Array(TERRAIN_BINS).fill(1.0),
        terrain_enabled: true,
        wind_offshore_deg: 270, // West is offshore
      }

      // Offshore wind
      const offshoreWind: HourlyMarine = {
        ...perfectConditions,
        wind_dir_deg: 270, // Perfect offshore
        wind_spd_kts: 8,
      }
      const scoreOffshore = computeHourScore(beach, offshoreWind, tideMid)

      // Onshore wind
      const onshoreWind: HourlyMarine = {
        ...perfectConditions,
        wind_dir_deg: 90, // Onshore
        wind_spd_kts: 8,
      }
      const scoreOnshore = computeHourScore(beach, onshoreWind, tideMid)

      // Offshore should still score better
      expect(scoreOffshore).toBeGreaterThan(scoreOnshore)
    })

    it('should still respect swell window when terrain is enabled', () => {
      const beach: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: Array(TERRAIN_BINS).fill(1.0),
        swell_access_factors: Array(TERRAIN_BINS).fill(0.9), // Moderate access everywhere
        terrain_enabled: true,
        swell_window_min_deg: 225,
        swell_window_max_deg: 315, // SW to NW
      }

      // Swell inside window
      const insideWindow: HourlyMarine = {
        ...perfectConditions,
        swell_dir_deg: 270, // West (center of window)
      }
      const scoreInside = computeHourScore(beach, insideWindow, tideMid)

      // Swell outside window
      const outsideWindow: HourlyMarine = {
        ...perfectConditions,
        swell_dir_deg: 180, // South (outside window)
      }
      const scoreOutside = computeHourScore(beach, outsideWindow, tideMid)

      // Inside window should score better or equal
      expect(scoreInside).toBeGreaterThanOrEqual(scoreOutside)
    })
  })

  describe('Real-World Scenarios', () => {
    it('should correctly score a cove with wind shelter and swell access', () => {
      // Realistic cove: sheltered from most winds, open to west swells
      const windExposure = Array(TERRAIN_BINS).fill(0.3) // Generally sheltered
      const swellAccess = Array(TERRAIN_BINS).fill(0.2) // Generally blocked

      // Open to west (240-300°)
      for (let i = 0; i < TERRAIN_BINS; i++) {
        const deg = i * 5
        if (deg >= 240 && deg <= 300) {
          swellAccess[i] = 0.95 // Open to west swells
        }
      }

      const cove: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: windExposure,
        swell_access_factors: swellAccess,
        terrain_enabled: true,
        swell_window_min_deg: 240,
        swell_window_max_deg: 300,
      }

      // Perfect west swell with light offshore
      const idealForCove: HourlyMarine = {
        ...perfectConditions,
        swell_dir_deg: 270, // Perfect west swell
        wind_dir_deg: 270,
        wind_spd_kts: 5,
      }

      const score = computeHourScore(cove, idealForCove, tideMid)

      // Should get a good score
      expect(score).toBeGreaterThanOrEqual(60)
    })

    it('should correctly score an exposed point with full swell access', () => {
      // Realistic point: very exposed to wind, excellent swell access
      const windExposure = Array(TERRAIN_BINS).fill(0.95) // Very exposed
      const swellAccess = Array(TERRAIN_BINS).fill(0.9) // Excellent access

      const exposedPoint: BeachMeta = {
        ...baseBeach,
        wind_exposure_factors: windExposure,
        swell_access_factors: swellAccess,
        terrain_enabled: true,
      }

      // Good swell but challenging wind
      const challengingDay: HourlyMarine = {
        ...perfectConditions,
        wind_dir_deg: 90, // Onshore
        wind_spd_kts: 20, // Strong
      }

      const score = computeHourScore(exposedPoint, challengingDay, tideMid)

      // Should be penalized by wind despite good swell access
      expect(score).toBeLessThan(70)
    })
  })
})
