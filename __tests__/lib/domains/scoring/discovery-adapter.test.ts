/**
 * Tests for Discovery Adapter
 *
 * Tests the bridge between new scoring engine and surf-discovery-service.
 */

import {
  createDiscoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  computeFaceHeight,
  compositeToDetailedScore,
  scoreBeachWithEngine,
} from '@/lib/domains/scoring';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';
import { toFaceHeightFeet } from '@/lib/utils/wave-formatters';
import { createBeach as createBeachFixture, createForecast as createForecastFixture } from '../__fixtures__';

jest.mock('@/lib/monitoring/fallback-tracker', () => ({
  trackFallback: jest.fn(),
}));
const mockTrackFallback = trackFallback as jest.MockedFunction<typeof trackFallback>;

// Type-safe wrappers using the improved fixture typing
function createBeach(overrides: Partial<Beach> = {}): Beach {
  return createBeachFixture(overrides) as Beach;
}

function createForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return createForecastFixture(overrides) as EnhancedForecastEntity;
}

describe('Discovery Adapter', () => {
  describe('beachToSpotProfile', () => {
    it('should convert Beach to SpotProfile', () => {
      const beach = createBeach();
      const profile = beachToSpotProfile(beach);

      expect(profile.id).toBe('test-beach-id');
      expect(profile.name).toBe('Test Beach');
      expect(profile.timezone).toBe('America/Los_Angeles');
      expect(profile.swellWindow.minDeg).toBe(250);
      expect(profile.swellWindow.maxDeg).toBe(290);
      expect(profile.windThresholds.offshoreDeg).toBe(90);
      expect(profile.tidePreferences.minHeightFt).toBe(0);
      expect(profile.tidePreferences.maxHeightFt).toBe(5);
    });

    it('should use defaults when beach values are null', () => {
      const beach = createBeach({
        swell_window_min_deg: null,
        swell_window_max_deg: null,
        wind_offshore_deg: null,
      });
      const profile = beachToSpotProfile(beach);

      // Should use defaults
      expect(profile.swellWindow.minDeg).toBeDefined();
      expect(profile.windThresholds.offshoreDeg).toBeDefined();
    });
  });

  describe('forecastToSnapshot', () => {
    it('should convert EnhancedForecastEntity to ConditionsSnapshot', () => {
      const forecast = createForecast();
      const beach = createBeach();
      const snapshot = forecastToSnapshot(forecast, beach);

      // Default forecast: 4ft @ 12s, data_source='NOAA_NWS' → legacy pipeline.
      // Default beach has no terrain_enabled / swell_access_factors → dirFactor=1.0.
      // periodFactor(12) = 1.0 + (12-10)*0.05 = 1.1 → 4 * 1.0 * 1.1 * 1.0 = 4.4
      expect(snapshot.waveHeight).toBeCloseTo(4.4, 1);
      expect(snapshot.wavePeriod).toBe(12);
      expect(snapshot.wind.speedMph).toBe(5);
      expect(snapshot.wind.directionDeg).toBe(90);
      expect(snapshot.tide.heightFt).toBe(3);
      expect(snapshot.tide.direction).toBe('rising');
      expect(snapshot.confidence).toBe(80);
    });

    it('should parse primary swell data', () => {
      const forecast = createForecast({
        swell_1_height: '5',
        swell_1_period: '14s',
        swell_1_direction: '280',
      });
      const beach = createBeach();
      const snapshot = forecastToSnapshot(forecast, beach);

      expect(snapshot.primarySwell).not.toBeNull();
      expect(snapshot.primarySwell?.heightFt).toBe(5);
      expect(snapshot.primarySwell?.periodS).toBe(14);
    });

    it('should parse secondary swell data when available', () => {
      const forecast = createForecast({
        swell_2_height: '2',
        swell_2_period: '8s',
        swell_2_direction: '180',
      });
      const beach = createBeach();
      const snapshot = forecastToSnapshot(forecast, beach);

      expect(snapshot.secondarySwell).not.toBeNull();
      expect(snapshot.secondarySwell?.heightFt).toBe(2);
      expect(snapshot.secondarySwell?.directionDeg).toBe(180);
    });

    it('should handle missing wind direction gracefully', () => {
      const forecast = createForecast({
        wind_direction_deg: null,
        wind_direction: null,
      });
      const beach = createBeach();
      const snapshot = forecastToSnapshot(forecast, beach);

      expect(snapshot.wind.directionDeg).toBeNull();
    });

    it('should parse tide status correctly', () => {
      const beach = createBeach();

      const risingForecast = createForecast({ tide_status: 'Rising' });
      expect(forecastToSnapshot(risingForecast, beach).tide.direction).toBe('rising');

      const fallingForecast = createForecast({ tide_status: 'Falling' });
      expect(forecastToSnapshot(fallingForecast, beach).tide.direction).toBe('falling');

      const highForecast = createForecast({ tide_status: 'High Slack' });
      expect(forecastToSnapshot(highForecast, beach).tide.direction).toBe('slack');
    });

    describe('cardinal swell direction parsing', () => {
      it('should parse cardinal string swell_1_direction (WNW)', () => {
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'WNW', // Cardinal string, not degrees
        });
        const beach = createBeach();
        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.waveDirection).toBe(292.5); // WNW = 292.5 degrees
        expect(snapshot.primarySwell).not.toBeNull();
        expect(snapshot.primarySwell?.directionDeg).toBe(292.5);
      });

      it('should parse cardinal string swell_1_direction (W)', () => {
        const forecast = createForecast({
          swell_1_height: '4',
          swell_1_period: '14s',
          swell_1_direction: 'W',
        });
        const beach = createBeach();
        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.waveDirection).toBe(270); // W = 270 degrees
        expect(snapshot.primarySwell?.directionDeg).toBe(270);
      });

      it('should parse cardinal string swell_2_direction (NW)', () => {
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'W',
          swell_2_height: '2',
          swell_2_period: '8s',
          swell_2_direction: 'NW', // Cardinal string
        });
        const beach = createBeach();
        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.secondarySwell).not.toBeNull();
        expect(snapshot.secondarySwell?.directionDeg).toBe(315); // NW = 315 degrees
      });

      it('should parse cardinal string swell_2_direction (NNW)', () => {
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'W',
          swell_2_height: '1.5',
          swell_2_period: '10s',
          swell_2_direction: 'NNW',
        });
        const beach = createBeach();
        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.secondarySwell?.directionDeg).toBe(337.5); // NNW = 337.5 degrees
      });

      it('should default to 270 when swell_2_direction is missing', () => {
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'W',
          swell_2_height: '2',
          swell_2_period: '8s',
          swell_2_direction: null, // Missing direction
        });
        const beach = createBeach();
        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.secondarySwell).not.toBeNull();
        expect(snapshot.secondarySwell?.directionDeg).toBe(270); // Default to W
      });

      it('should handle numeric degree strings for backwards compatibility', () => {
        const forecast = createForecast({
          swell_1_height: '4',
          swell_1_period: '14s',
          swell_1_direction: '280', // Numeric string
          swell_2_height: '2',
          swell_2_period: '10s',
          swell_2_direction: '315', // Numeric string
        });
        const beach = createBeach();
        const snapshot = forecastToSnapshot(forecast, beach);

        // Numeric strings should still work (getDirectionDegrees handles both)
        expect(snapshot.primarySwell?.directionDeg).toBe(280);
        expect(snapshot.secondarySwell?.directionDeg).toBe(315);
      });

      it('should produce valid non-NaN scores with cardinal directions', () => {
        const engine = createDiscoveryScoringEngine();
        const beach = createBeach();
        const forecast = createForecast({
          wave_height: '3',
          wave_period: '12s',
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'WNW', // Cardinal string like real data
          swell_2_height: '1.5',
          swell_2_period: '14s',
          swell_2_direction: 'NW', // Cardinal string like real data
        });

        const result = scoreBeachWithEngine(engine, beach, forecast);

        // Score should be a valid number, not 0 or NaN
        expect(Number.isFinite(result.total)).toBe(true);
        expect(result.total).toBeGreaterThan(0);
        // Warnings should not contain 'undefined'
        expect(result.warnings.some(w => w.includes('undefined'))).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // Decomposed shoaling transform integration (Workstream B follow-up)
    //
    // `forecastToSnapshot` now feeds the score engine through
    // `transformToFaceHeightDecomposed`, the same per-component path the
    // display uses (`forecast-builder.getWaveHeight`). The decomposition
    // extracts swell_1 / swell_2 / wind_wave from the persisted WW3 columns
    // and alignment-weights each component against the beach's swell window.
    // Short-period (<=8s) components contribute zero face height.
    //
    // These tests lock in: (1) the Tourmaline mixed-day blowout is fixed,
    // (2) partial component data still decomposes, (3) missing components
    // fall back to the scalar legacy path via the transform's internal
    // fallback branch, and (4) the display and score paths compute the
    // same number for the same inputs.
    //
    // Unit note: `enhanced_forecasts.swell_*_height` are persisted as feet
    // strings (e.g. "2.5 ft") by `forecast-builder.metersToFeet`, so the
    // mock fixtures below pass feet values directly.
    // -------------------------------------------------------------------------
    describe('shoaling transform integration', () => {
      const tourmalineShoalingFactors = {
        version: 1 as const,
        type: 'period_lookup' as const,
        buckets: [
          { tp_min_s: 0, tp_max_s: 8, factor: 1.03 },
          { tp_min_s: 8, tp_max_s: 12, factor: 1.13 },
          { tp_min_s: 12, tp_max_s: 16, factor: 1.45 },
          { tp_min_s: 16, tp_max_s: 99, factor: 1.62 },
        ],
      };

      // Tourmaline swell window: center 247.5° WSW, halfwidth 67.5°
      // → window = [180°, 315°]. 200° (SSW) is inside. 274° (W) is inside
      // the geometric window but gets zeroed by the <=8s short-period gate.
      const tourmalineBeachOverrides = {
        shoaling_factors: tourmalineShoalingFactors,
        swell_window_center_deg: 247.5,
        swell_window_halfwidth_deg: 67.5,
      };

      it('zeroes the short-period wind-swell on Tourmaline mixed-period days', () => {
        // Tourmaline 2026-04-09: 1ft 14s SSW primary + 2.5ft 7s W wind-swell.
        // Scalar legacy: 3ft × 1.45 = 4.4 ft (the blowout).
        // Decomposed: 1ft 14s component passes alignment (1.0 × 1.45 × ~1 =
        // ~1 ft), 2.5ft 7s component zeroed by <=8s cutoff. RMS ≈ 1 ft.
        const beach = createBeach(tourmalineBeachOverrides);
        const forecast = createForecast({
          wave_height: '3',
          wave_period: '14s',
          data_source: 'CDIP',
          swell_1_height: '1',
          swell_1_period: '14s',
          swell_1_direction: '200',
          swell_2_height: '2.5',
          swell_2_period: '7s',
          swell_2_direction: '274',
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        // Upper bound — the 7s W component must be zeroed by the period cutoff.
        // With only the 1ft 14s SSW groundswell contributing, face height is
        // dominated by 1 × 1.45 × alignment ≈ 1.4 ft; assert well under 2.0.
        expect(snapshot.waveHeight).toBeLessThan(2.0);
        expect(snapshot.waveHeight).toBeGreaterThan(0);
        // Must NOT equal the scalar blowout result.
        expect(snapshot.waveHeight).not.toBeCloseTo(4.35, 1);
      });

      it('decomposes a single populated component when swell_2 is null', () => {
        // Only swell_1 is set — decomposition runs on the single component.
        // 4ft × 1.45 (12-16s bucket) × alignment(200°@14s into 247.5±67.5)
        // direction delta = 47.5°, normalized 47.5/67.5 ≈ 0.704,
        // cos²(0.704 × π/2) = cos²(1.1058) ≈ 0.2024.
        // face = 4 × 1.45 × 0.2024 ≈ 1.17 ft.
        const beach = createBeach(tourmalineBeachOverrides);
        const forecast = createForecast({
          wave_height: '4',
          wave_period: '14s',
          data_source: 'CDIP',
          swell_1_height: '4',
          swell_1_period: '14s',
          swell_1_direction: '200',
          swell_2_height: null,
          swell_2_period: null,
          swell_2_direction: null,
          wind_wave_height: null,
          wind_wave_period: null,
          wind_wave_direction: null,
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.waveHeight).toBeGreaterThan(0);
        // Single component with angular offset → well under linear 4 × 1.45.
        expect(snapshot.waveHeight).toBeLessThan(2.0);
      });

      it('falls back to the scalar legacy path when every component slot is null', () => {
        // All component columns null → decomposed transform falls through to
        // its internal `transformToFaceHeight` call with rawHeightFt / periodS
        // / swellDirectionDeg. That baseline must match the pre-decomposition
        // scalar result exactly so uncalibrated / legacy rows behave the same.
        const beach = createBeach({ shoaling_factors: null });
        const forecast = createForecast({
          wave_height: '3',
          wave_period: '14s',
          data_source: 'CDIP',
          swell_1_height: null,
          swell_1_period: null,
          swell_1_direction: null,
          swell_2_height: null,
          swell_2_period: null,
          swell_2_direction: null,
          wind_wave_height: null,
          wind_wave_period: null,
          wind_wave_direction: null,
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        // Legacy pipeline: 3 × BASE_SHOALING(1.0) × periodFactor(14)=1.2
        // × dirFactor(no terrain)=1.0 = 3.6 ft. Matches pre-decomposition
        // behavior on scalar-only rows.
        expect(snapshot.waveHeight).toBeCloseTo(3.6, 1);
      });

      it('does not crash when the row has components but no shoaling_factors', () => {
        // Uncalibrated beach with WW3 components populated → decomposition
        // still runs but falls back to BASE_SHOALING × calculatePeriodFactor
        // per component (no bucket lookup). Exercise the path so we know it
        // returns a finite number and does not throw.
        const beach = createBeach({
          shoaling_factors: null,
          swell_window_center_deg: null,
          swell_window_halfwidth_deg: null,
        });
        const forecast = createForecast({
          wave_height: '4',
          wave_period: '12s',
          data_source: 'NOAA_NWS',
          swell_1_height: '4',
          swell_1_period: '12s',
          swell_1_direction: '270',
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        expect(Number.isFinite(snapshot.waveHeight)).toBe(true);
        expect(snapshot.waveHeight).toBeGreaterThan(0);
      });

      it('handles a null/missing data_source gracefully (no crash)', () => {
        const beach = createBeach(tourmalineBeachOverrides);
        const forecast = createForecast({
          wave_height: '3',
          wave_period: '14s',
          data_source: null as unknown as string, // simulate legacy row with no source
          swell_1_direction: '200',
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        expect(Number.isFinite(snapshot.waveHeight)).toBe(true);
        expect(snapshot.waveHeight).toBeGreaterThanOrEqual(0);
      });

      it('returns 0 face height for a null wave_height string without crashing', () => {
        const beach = createBeach();
        const forecast = createForecast({
          wave_height: null,
          wave_period: '14s',
          data_source: 'CDIP',
          // Clear component columns too so the legacy fallback branch sees 0.
          swell_1_height: null,
          swell_1_period: null,
          swell_1_direction: null,
          swell_2_height: null,
          swell_2_period: null,
          swell_2_direction: null,
          wind_wave_height: null,
          wind_wave_period: null,
          wind_wave_direction: null,
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        expect(snapshot.waveHeight).toBe(0);
        expect(Number.isFinite(snapshot.waveHeight)).toBe(true);
      });

      it('matches the display-path face height for the same scalar fallback inputs', () => {
        // When all component slots are null the decomposed path delegates to
        // the same `transformToFaceHeight` the legacy display used, so the
        // snapshot still matches `toFaceHeightFeet`. This is the minimal
        // invariant — component-populated rows use a different display API
        // (`toFaceHeightFeetDecomposed`) and are covered by the forecast-
        // builder tests.
        const beach = createBeach({
          shoaling_factors: tourmalineShoalingFactors,
        });
        const forecast = createForecast({
          wave_height: '3',
          wave_period: '14s',
          data_source: 'CDIP',
          swell_1_direction: '200',
          swell_1_height: null,
          swell_1_period: null,
          swell_2_height: null,
          swell_2_period: null,
          swell_2_direction: null,
          wind_wave_height: null,
          wind_wave_period: null,
          wind_wave_direction: null,
        });

        const snapshot = forecastToSnapshot(forecast, beach);

        const displayHeightStr = toFaceHeightFeet({
          cdipSigFt: 3,
          periodS: 14,
          swellDirectionDeg: 200,
          beach: {
            swell_access_factors: beach.swell_access_factors ?? null,
            terrain_enabled: beach.terrain_enabled ?? false,
            shoaling_factors: tourmalineShoalingFactors,
          },
        });
        const displayHeight = parseFloat((displayHeightStr ?? '0').replace(/[^\d.]/g, ''));

        expect(snapshot.waveHeight).toBeCloseTo(displayHeight, 1);
      });
    });
  });

  describe('computeFaceHeight', () => {
    const tourmalineShoalingFactors = {
      version: 1 as const,
      type: 'period_lookup' as const,
      buckets: [
        { tp_min_s: 0, tp_max_s: 8, factor: 1.03 },
        { tp_min_s: 8, tp_max_s: 12, factor: 1.13 },
        { tp_min_s: 12, tp_max_s: 16, factor: 1.45 },
        { tp_min_s: 16, tp_max_s: 99, factor: 1.62 },
      ],
    };

    it('returns decomposed face height for a calibrated beach with components', () => {
      const beach = createBeach({
        shoaling_factors: tourmalineShoalingFactors,
        swell_window_center_deg: 247.5,
        swell_window_halfwidth_deg: 67.5,
      });
      const forecast = createForecast({
        wave_height: '3',
        wave_period: '14s',
        data_source: 'CDIP',
        swell_1_height: '1',
        swell_1_period: '14s',
        swell_1_direction: '200',
        swell_2_height: '2.5',
        swell_2_period: '7s',
        swell_2_direction: '274',
      });

      const result = computeFaceHeight(forecast, beach);

      // Same value forecastToSnapshot uses internally
      const snapshot = forecastToSnapshot(forecast, beach);
      expect(result.faceHeightFt).toBeCloseTo(snapshot.waveHeight, 5);
      expect(result.isCalibrated).toBe(true);
      expect(result.faceHeightFt).toBeLessThan(2.0);
    });

    it('returns legacy-path face height for an uncalibrated beach', () => {
      const beach = createBeach({ shoaling_factors: null });
      const forecast = createForecast({
        wave_height: '3',
        wave_period: '14s',
        data_source: 'NOAA_NWS',
        swell_1_height: '3',
        swell_1_period: '14s',
        swell_1_direction: '270',
      });

      const result = computeFaceHeight(forecast, beach);

      expect(result.isCalibrated).toBe(false);
      expect(Number.isFinite(result.faceHeightFt)).toBe(true);
      expect(result.faceHeightFt).toBeGreaterThan(0);
    });

    it('falls back to legacy when all component slots are null', () => {
      const beach = createBeach({ shoaling_factors: null });
      const forecast = createForecast({
        wave_height: '3',
        wave_period: '14s',
        data_source: 'CDIP',
        swell_1_height: null,
        swell_1_period: null,
        swell_1_direction: null,
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
        wind_wave_height: null,
        wind_wave_period: null,
        wind_wave_direction: null,
      });

      const result = computeFaceHeight(forecast, beach);

      // Legacy: 3 * 1.0 * periodFactor(14)=1.2 * 1.0 = 3.6
      expect(result.faceHeightFt).toBeCloseTo(3.6, 1);
      expect(result.isCalibrated).toBe(false);
    });
  });

  describe('createDiscoveryScoringEngine', () => {
    it('should create engine with all standard scorers', () => {
      const engine = createDiscoveryScoringEngine();
      const scorerNames = engine.getScorerNames();

      expect(scorerNames).toContain('baseConditions');
      expect(scorerNames).toContain('swellAlignment');
      expect(scorerNames).toContain('swellInterference');
      expect(scorerNames).toContain('windQuality');
      expect(scorerNames).toContain('tideFit');
      expect(scorerNames).toContain('tideDirection');
      expect(scorerNames).toContain('windowStability');
      expect(scorerNames).toContain('trendPreference');
      expect(scorerNames).toHaveLength(8);
    });
  });

  describe('scoreBeachWithEngine', () => {
    it('should score good conditions highly', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      const forecast = createForecast({
        wave_height: '4',
        wave_period: '14s',
        wind_speed: '3',
        wind_direction_deg: 90, // Offshore
        tide_height: '3',
      });

      const result = scoreBeachWithEngine(engine, beach, forecast);

      expect(result.total).toBeGreaterThanOrEqual(70);
      expect(result.matchQuality).toMatch(/perfect|excellent|good/);
    });

    it('should score poor conditions lower', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      const forecast = createForecast({
        wave_height: '1',
        wave_period: '5s',
        wind_speed: '15',
        wind_direction_deg: 270, // Onshore
        tide_height: '7', // Outside preferred range
      });

      const result = scoreBeachWithEngine(engine, beach, forecast);

      expect(result.total).toBeLessThan(70);
    });

    it('should apply affinity bonus', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      const forecast = createForecast();

      const withoutAffinity = scoreBeachWithEngine(engine, beach, forecast);
      const withAffinity = scoreBeachWithEngine(engine, beach, forecast, {
        affinityBonus: 10,
      });

      expect(withAffinity.total).toBe(
        Math.min(100, withoutAffinity.total + 10)
      );
      expect(withAffinity.subscores.affinityBonus).toBe(10);
    });

    it('should apply distance penalty', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      const forecast = createForecast();

      const withoutPenalty = scoreBeachWithEngine(engine, beach, forecast);
      const withPenalty = scoreBeachWithEngine(engine, beach, forecast, {
        distancePenalty: -15,
      });

      expect(withPenalty.total).toBe(
        Math.max(0, withoutPenalty.total - 15)
      );
      expect(withPenalty.subscores.distancePenalty).toBe(-15);
    });

    it('should apply preferred wave size penalty when waves too small', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      // Must set swell_1_* alongside wave_height so the decomposed transform
      // in `forecastToSnapshot` reports the small wave size — the default
      // fixture's swell_1_height is 4ft which would otherwise dominate.
      const forecast = createForecast({
        wave_height: '2',
        swell_1_height: '2',
        swell_1_period: '10s',
      }); // Small waves

      const withoutPref = scoreBeachWithEngine(engine, beach, forecast);
      const withLargePref = scoreBeachWithEngine(engine, beach, forecast, {
        preferredWaveSize: 'large', // Wants 6+ ft
      });

      // Should penalize small waves when user prefers large
      expect(withLargePref.total).toBeLessThan(withoutPref.total);
      expect(withLargePref.warnings.some(w => w.includes('smaller'))).toBe(true);
    });

    it('should apply preferred wave size penalty when waves are outside preferred range', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      // Use 5ft waves - above small preference (1-3ft ideal, 0.5-4ft acceptable)
      // Set skill level to 'intermediate' (6ft acceptable max) so skill ceiling doesn't interfere
      const forecast = createForecast({ wave_height: '5' });

      const withSmallPref = scoreBeachWithEngine(engine, beach, forecast, {
        preferredWaveSize: 'small', // Wants 1-3 ft (acceptable: 0.5-4 ft)
        userSkillLevel: 'intermediate', // Can handle up to 6ft
      });

      // Should get penalty for waves outside preference acceptable range
      const withoutPref = scoreBeachWithEngine(engine, beach, forecast, {
        userSkillLevel: 'intermediate',
      });
      expect(withSmallPref.total).toBeLessThan(withoutPref.total);
      expect(withSmallPref.warnings.some(w => w.includes('larger than preferred'))).toBe(true);
    });

    it('should give bonus when waves match preferred size', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      const forecast = createForecast({ wave_height: '4' }); // Medium waves

      const withoutPref = scoreBeachWithEngine(engine, beach, forecast);
      const withMediumPref = scoreBeachWithEngine(engine, beach, forecast, {
        preferredWaveSize: 'medium', // Wants 3-6 ft (ideal range match = +5 bonus)
      });

      // Now gives +5 bonus when waves match preferred ideal range
      expect(withMediumPref.total).toBeGreaterThanOrEqual(withoutPref.total);
    });

    it('should return valid DetailedScore structure', () => {
      const engine = createDiscoveryScoringEngine();
      const beach = createBeach();
      const forecast = createForecast();

      const result = scoreBeachWithEngine(engine, beach, forecast);

      // Check all required fields exist
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('subscores');
      expect(result).toHaveProperty('matchQuality');
      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('conditionBadges');

      // Check subscores structure
      expect(result.subscores).toHaveProperty('waveHeightFit');
      expect(result.subscores).toHaveProperty('periodEnergyScore');
      expect(result.subscores).toHaveProperty('windAlignment');
      expect(result.subscores).toHaveProperty('tideFit');
      expect(result.subscores).toHaveProperty('affinityBonus');
      expect(result.subscores).toHaveProperty('distancePenalty');

      // Check types
      expect(typeof result.total).toBe('number');
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('compositeToDetailedScore', () => {
    it('should convert CompositeScore to DetailedScore format', () => {
      const composite = {
        total: 75,
        subscores: new Map([
          ['baseConditions', 80],
          ['windQuality', 90],
          ['tideFit', 70],
        ]),
        matchQuality: 'excellent' as const,
        reasons: ['Good waves', 'Offshore wind'],
        warnings: ['Tide a bit high'],
        skipReason: null,
        confidence: 80,
      };

      const detailed = compositeToDetailedScore(composite, 5, -10);

      expect(detailed.total).toBe(70); // 75 + 5 - 10
      expect(detailed.matchQuality).toBe('excellent');
      expect(detailed.reasons).toContain('Good waves');
      expect(detailed.warnings).toContain('Tide a bit high');
      expect(detailed.subscores.affinityBonus).toBe(5);
      expect(detailed.subscores.distancePenalty).toBe(-10);
    });

    it('should clamp total to 0-100 range', () => {
      const highComposite = {
        total: 95,
        subscores: new Map(),
        matchQuality: 'perfect' as const,
        reasons: [],
        warnings: [],
        skipReason: null,
        confidence: 90,
      };

      const result = compositeToDetailedScore(highComposite, 15, 0);
      expect(result.total).toBe(100); // Clamped at 100

      const lowComposite = {
        total: 10,
        subscores: new Map(),
        matchQuality: 'fair' as const,
        reasons: [],
        warnings: [],
        skipReason: null,
        confidence: 50,
      };

      const lowResult = compositeToDetailedScore(lowComposite, 0, -20);
      expect(lowResult.total).toBe(0); // Clamped at 0
    });

    it('should map skip quality to fair', () => {
      const skipComposite = {
        total: 0,
        subscores: new Map(),
        matchQuality: 'skip' as const,
        reasons: [],
        warnings: ['Too windy'],
        skipReason: 'Too windy',
        confidence: 50,
      };

      const result = compositeToDetailedScore(skipComposite);
      expect(result.matchQuality).toBe('fair');
    });

    it('should NOT trackFallback for missing subscores on skip results', () => {
      mockTrackFallback.mockClear();

      const skipComposite = {
        total: 0,
        subscores: new Map([['baseConditions', 10]]), // windQuality + tideFit missing
        matchQuality: 'skip' as const,
        reasons: [],
        warnings: ['Flat conditions'],
        skipReason: 'Wave height below minimum',
        confidence: 50,
      };

      compositeToDetailedScore(skipComposite);

      // No subscore fallback calls should fire for skip results
      const subscoreCalls = mockTrackFallback.mock.calls.filter(
        ([arg]) => typeof arg === 'object' && 'field' in arg && arg.field.startsWith('subscore_')
      );
      expect(subscoreCalls).toHaveLength(0);
    });

    it('should trackFallback for missing subscores on non-skip results', () => {
      mockTrackFallback.mockClear();

      const nonSkipComposite = {
        total: 60,
        subscores: new Map([
          ['baseConditions', 70],
          ['windQuality', 80],
          // tideFit missing — should trigger fallback
        ]),
        matchQuality: 'good' as const,
        reasons: ['Decent waves'],
        warnings: [],
        skipReason: null,
        confidence: 70,
      };

      compositeToDetailedScore(nonSkipComposite);

      const subscoreCalls = mockTrackFallback.mock.calls.filter(
        ([arg]) => typeof arg === 'object' && 'field' in arg && arg.field.startsWith('subscore_')
      );
      expect(subscoreCalls).toHaveLength(1);
      expect(subscoreCalls[0][0]).toEqual({
        domain: 'discovery',
        field: 'subscore_tideFit',
        fallbackValue: 50,
      });
    });

    it('should NOT trackFallback when matchQuality is skip but all subscores present (low total, no early exit)', () => {
      mockTrackFallback.mockClear();

      // Edge case: all scorers ran but weighted total fell below 40,
      // so matchQuality is 'skip' while skipReason is null.
      const lowScoreComposite = {
        total: 30,
        subscores: new Map([
          ['baseConditions', 20],
          ['windQuality', 25],
          ['tideFit', 15],
        ]),
        matchQuality: 'skip' as const,
        reasons: [],
        warnings: [],
        skipReason: null,
        confidence: 60,
      };

      compositeToDetailedScore(lowScoreComposite);

      const subscoreCalls = mockTrackFallback.mock.calls.filter(
        ([arg]) => typeof arg === 'object' && 'field' in arg && arg.field.startsWith('subscore_')
      );
      expect(subscoreCalls).toHaveLength(0);
    });
  });
});
