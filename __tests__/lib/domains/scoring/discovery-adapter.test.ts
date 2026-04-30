/**
 * Tests for Discovery Adapter
 *
 * Tests the bridge between new scoring engine and surf-discovery-service.
 */

import {
  createDiscoveryScoringEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  compositeToDetailedScore,
  scoreBeachWithEngine,
} from '@/lib/domains/scoring';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';
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
      const snapshot = forecastToSnapshot(forecast);

      expect(snapshot.waveHeight).toBe(4);
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
      const snapshot = forecastToSnapshot(forecast);

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
      const snapshot = forecastToSnapshot(forecast);

      expect(snapshot.secondarySwell).not.toBeNull();
      expect(snapshot.secondarySwell?.heightFt).toBe(2);
      expect(snapshot.secondarySwell?.directionDeg).toBe(180);
    });

    it('should leave secondarySwell null when swell_2_height is null', () => {
      // Post real-partition pipeline: when NOAA has no secondary partition we
      // null the swell_2_* fields rather than fabricating them. The scoring
      // snapshot must treat that as "no second swell train," not error.
      const forecast = createForecast({
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
      });
      const snapshot = forecastToSnapshot(forecast);

      expect(snapshot.secondarySwell).toBeNull();
    });

    it('should handle missing wind direction gracefully', () => {
      const forecast = createForecast({
        wind_direction_deg: null,
        wind_direction: null,
      });
      const snapshot = forecastToSnapshot(forecast);

      expect(snapshot.wind.directionDeg).toBeNull();
    });

    it('should parse tide status correctly', () => {
      const risingForecast = createForecast({ tide_status: 'Rising' });
      expect(forecastToSnapshot(risingForecast).tide.direction).toBe('rising');

      const fallingForecast = createForecast({ tide_status: 'Falling' });
      expect(forecastToSnapshot(fallingForecast).tide.direction).toBe('falling');

      const highForecast = createForecast({ tide_status: 'High Slack' });
      expect(forecastToSnapshot(highForecast).tide.direction).toBe('slack');
    });

    describe('cardinal swell direction parsing', () => {
      it('should parse cardinal string swell_1_direction (WNW)', () => {
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'WNW', // Cardinal string, not degrees
        });
        const snapshot = forecastToSnapshot(forecast);

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
        const snapshot = forecastToSnapshot(forecast);

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
        const snapshot = forecastToSnapshot(forecast);

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
        const snapshot = forecastToSnapshot(forecast);

        expect(snapshot.secondarySwell?.directionDeg).toBe(337.5); // NNW = 337.5 degrees
      });

      it('drops a partition entirely when its direction is missing (no fabricated W)', () => {
        // Previously this defaulted missing direction to 270 (W), which fed a
        // phantom west swell into the geometric scorers. The post-fix
        // semantics: a partition without a parseable direction is not material
        // — drop it so the relevant scorer goes neutral instead of scoring
        // against fabricated geometry.
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: 'W',
          swell_2_height: '2',
          swell_2_period: '8s',
          swell_2_direction: null, // Missing direction
        });
        const snapshot = forecastToSnapshot(forecast);

        expect(snapshot.secondarySwell).toBeNull();
      });

      it('returns null primarySwell when the dominant partition has no parseable direction', () => {
        // Same defensive behavior at the primary level: if no partition has a
        // direction, snapshot.primarySwell is null and the alignment /
        // interference scorers fall through to their neutral paths rather than
        // scoring against a fabricated W heading.
        const forecast = createForecast({
          swell_1_height: '3',
          swell_1_period: '12s',
          swell_1_direction: null,
          swell_2_height: null,
          swell_2_period: null,
          swell_2_direction: null,
        });
        const snapshot = forecastToSnapshot(forecast);

        expect(snapshot.primarySwell).toBeNull();
        expect(snapshot.waveDirection).toBeNull();
      });

      it('keeps primarySwell paired with wavePeriod/waveDirection on swell_1-dominant rows', () => {
        const forecast = createForecast({
          wave_height: '4',
          wave_period: '14s',
          swell_1_height: '4',
          swell_1_period: '14s',
          swell_1_direction: 'WNW',
        });
        const snapshot = forecastToSnapshot(forecast);

        expect(snapshot.primarySwell?.periodS).toBe(snapshot.wavePeriod);
        expect(snapshot.primarySwell?.directionDeg).toBe(snapshot.waveDirection);
      });

      it('makes primarySwell follow the dominant partition on mixed-swell rows (wind_wave taller than swell_1)', () => {
        // Background SSW groundswell at 1ft 14s + dominant WNW wind sea at 3ft 6s.
        // Without the dominant-picker fix, primarySwell would be 1ft/14s SSW
        // (raw swell_1) while wavePeriod = 6 (dominant). The relevance gate
        // would then read 14s and grant full credit to direction-only scorers
        // — defeating the OBP fix.
        const forecast = createForecast({
          wave_height: '3',
          wave_period: '6s',
          swell_1_height: '1',
          swell_1_period: '14s',
          swell_1_direction: '200',
          wind_wave_height: '3',
          wind_wave_period: '6s',
          wind_wave_direction: '290',
        });
        const snapshot = forecastToSnapshot(forecast);

        expect(snapshot.primarySwell?.heightFt).toBe(3);
        expect(snapshot.primarySwell?.periodS).toBe(6);
        expect(snapshot.primarySwell?.directionDeg).toBe(290);
        expect(snapshot.waveDirection).toBe(290);
        // The non-dominant 14s SSW swell should still be exposed as a swell train.
        expect(snapshot.secondarySwell?.periodS).toBe(14);
        // wind_wave is dominant → should NOT also appear in windWave (no double-count).
        expect(snapshot.windWave).toBeNull();
      });

      it('exposes wind_wave separately when swell_1 is dominant', () => {
        const forecast = createForecast({
          wave_height: '4',
          wave_period: '14s',
          swell_1_height: '4',
          swell_1_period: '14s',
          swell_1_direction: '270',
          wind_wave_height: '1',
          wind_wave_period: '5s',
          wind_wave_direction: '315',
        });
        const snapshot = forecastToSnapshot(forecast);

        expect(snapshot.primarySwell?.heightFt).toBe(4);
        expect(snapshot.windWave?.heightFt).toBe(1);
        expect(snapshot.windWave?.periodS).toBe(5);
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
        const snapshot = forecastToSnapshot(forecast);

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
