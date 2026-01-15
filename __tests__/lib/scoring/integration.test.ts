/**
 * Integration tests for the unified scoring module.
 *
 * These tests verify the full flow works correctly end-to-end,
 * especially testing that the original bug (8/10 score showing as "Maybe") is fixed.
 */

import {
  scoreConditions,
  calculateOptimalWindow,
  toForecastForScoring,
  type BeachWithThresholds,
  type ForecastForScoring,
} from '@/lib/scoring';
import type { EnhancedForecastEntity } from '@/types/forecast';

describe('Unified Scoring Integration', () => {
  // Ocean Beach Pier configuration - typical San Diego break
  const oceanBeachPier: BeachWithThresholds = {
    id: 'ob-pier',
    name: 'Ocean Beach Pier',
    wind_offshore_deg: 90, // E wind is offshore
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2.0,
    preferred_tide_ft_max: 5.0,
    swell_window_min_deg: 200,
    swell_window_max_deg: 320,
    preferred_tide_direction: 'any',
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 18,
  } as BeachWithThresholds;

  /**
   * Helper to create a partial EnhancedForecastEntity for testing
   */
  function createForecast(
    overrides: Partial<EnhancedForecastEntity>
  ): EnhancedForecastEntity {
    return {
      id: 'test-forecast',
      beach_id: 'ob-pier',
      forecast_date: '2026-01-14',
      forecast_time: '07:00:00',
      wave_height: '3.0',
      wave_period: '12s',
      wind_speed: '5',
      wind_direction: 'E',
      wind_direction_deg: 90,
      tide_height: '3.0',
      tide_status: 'Rising',
      water_temp: '60',
      air_temperature: '65',
      weather_condition: 'Partly Cloudy',
      confidence_score: 80,
      data_source: 'NOAA_NWS',
      created_at: '2026-01-14T00:00:00Z',
      updated_at: '2026-01-14T00:00:00Z',
      ...overrides,
    } as EnhancedForecastEntity;
  }

  describe('Morning Intel scenario', () => {
    it('produces consistent score and recommendation for good conditions', () => {
      const forecast = toForecastForScoring(
        createForecast({
          forecast_date: '2026-01-14',
          forecast_time: '07:00:00',
          wave_height: '2.5',
          wave_period: '12s',
          wind_speed: '5',
          wind_direction_deg: 90,
          tide_height: '3.0',
          tide_status: 'Rising',
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      // Good conditions should score well
      expect(result.total).toBeGreaterThanOrEqual(70);
      expect(result.recommendationLabel).toBe('Worth it');
      expect(result.message).toMatch(/worth it/i);
    });

    it('handles the 8/10 = Maybe bug correctly', () => {
      // Simulate the original bug: good score but categorical "acceptable"
      // The bug was that categorical classification of individual factors
      // could result in "Maybe" even when the total score was high
      const forecast = toForecastForScoring(
        createForecast({
          forecast_date: '2026-01-14',
          forecast_time: '07:00:00',
          wave_height: '3.0',
          wave_period: '10s', // "acceptable" period (between 10-14s)
          wind_speed: '8',
          wind_direction_deg: 90, // Offshore
          tide_height: '3.0',
          tide_status: 'Rising',
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      // Score should drive the label, not categorical classification
      // The key fix: high total scores result in "Worth it", not "Maybe"
      if (result.total >= 70) {
        expect(result.recommendationLabel).toBe('Worth it');
      } else if (result.total >= 40) {
        expect(result.recommendationLabel).toBe('Maybe');
      }
      // Verify the label matches the score-based thresholds
      expect(['Worth it', 'Maybe', 'Skip']).toContain(result.recommendationLabel);
    });

    it('produces "Skip" when conditions are truly poor', () => {
      const forecast = toForecastForScoring(
        createForecast({
          wind_speed: '20', // Exceeds max_wind_any_mph
          wind_direction_deg: 270, // Onshore
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      expect(result.matchQuality).toBe('skip');
      expect(result.recommendationLabel).toBe('Skip');
      expect(result.total).toBe(0);
    });
  });

  describe('Discovery Service scenario', () => {
    it('calculates optimal window with interpolation', () => {
      const forecasts = [
        { hour: 6, tide: 1.8, wind: 5 }, // Below tide range
        { hour: 7, tide: 2.4, wind: 5 }, // Tide enters range ~6:20
        { hour: 8, tide: 3.0, wind: 5 }, // Good conditions
        { hour: 9, tide: 3.5, wind: 12 }, // Wind picks up
      ].map(({ hour, tide, wind }) =>
        toForecastForScoring(
          createForecast({
            forecast_date: '2026-01-14',
            forecast_time: `${String(hour).padStart(2, '0')}:00:00`,
            wave_height: '3.0',
            wave_period: '12s',
            wind_speed: String(wind),
            wind_direction_deg: 90,
            tide_height: String(tide),
            tide_status: 'Rising',
          })
        )
      );

      const window = calculateOptimalWindow(forecasts, oceanBeachPier);

      expect(window).not.toBeNull();
      if (window) {
        // Window should start after 6:00 when conditions become favorable
        expect(window.start.getUTCHours()).toBeGreaterThanOrEqual(6);
        // Window should have a valid end time
        expect(window.end.getTime()).toBeGreaterThan(window.start.getTime());
        // Message should be generated
        expect(window.message).toBeTruthy();
      }
    });

    it('returns null when no viable window exists', () => {
      const forecasts = [
        { hour: 6, wind: 20 },
        { hour: 7, wind: 22 },
        { hour: 8, wind: 25 },
      ].map(({ hour, wind }) =>
        toForecastForScoring(
          createForecast({
            forecast_date: '2026-01-14',
            forecast_time: `${String(hour).padStart(2, '0')}:00:00`,
            wave_height: '3.0',
            wind_speed: String(wind), // All above max threshold
            wind_direction_deg: 270, // Onshore
          })
        )
      );

      const window = calculateOptimalWindow(forecasts, oceanBeachPier);

      expect(window).toBeNull();
    });

    it('respects sunset time constraint', () => {
      const forecasts = [
        { hour: 14, score: 75 },
        { hour: 15, score: 80 },
        { hour: 16, score: 85 },
        { hour: 17, score: 90 }, // After sunset
        { hour: 18, score: 85 }, // After sunset
      ].map(({ hour }) =>
        toForecastForScoring(
          createForecast({
            forecast_date: '2026-01-14',
            forecast_time: `${String(hour).padStart(2, '0')}:00:00`,
            wave_height: '3.0',
            wave_period: '14s',
            wind_speed: '3',
            wind_direction_deg: 90,
            tide_height: '3.5',
          })
        )
      );

      const sunset = new Date('2026-01-14T16:30:00Z');
      const window = calculateOptimalWindow(forecasts, oceanBeachPier, {
        sunsetTime: sunset,
      });

      expect(window).not.toBeNull();
      if (window) {
        // Window end should not exceed sunset
        expect(window.end.getTime()).toBeLessThanOrEqual(sunset.getTime());
      }
    });
  });

  describe('Skip conditions override high scores', () => {
    it('skip for excessive wind overrides wave/tide scores', () => {
      // Perfect waves and tide, but too windy
      const forecast = toForecastForScoring(
        createForecast({
          wave_height: '4.0',
          wave_period: '14s',
          tide_height: '3.5',
          wind_speed: '25', // Way over threshold
          wind_direction_deg: 90,
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      expect(result.matchQuality).toBe('skip');
      expect(result.recommendationLabel).toBe('Skip');
      expect(result.total).toBe(0);
      expect(result.warnings.some((w) => /windy/i.test(w))).toBe(true);
    });

    it('skip for strong onshore wind despite good waves', () => {
      const forecast = toForecastForScoring(
        createForecast({
          wave_height: '3.5',
          wave_period: '12s',
          tide_height: '3.0',
          wind_speed: '12', // Above onshore threshold
          wind_direction_deg: 270, // West - onshore for this beach
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      expect(result.matchQuality).toBe('skip');
      expect(result.warnings.some((w) => /onshore/i.test(w))).toBe(true);
    });
  });

  describe('Full flow: EnhancedForecastEntity to score to window', () => {
    it('transforms entity, scores, and calculates window end-to-end', () => {
      // Create raw forecast entities as they would come from database
      const entities: EnhancedForecastEntity[] = [
        createForecast({
          forecast_time: '06:00:00',
          wave_height: '2.5',
          wave_period: '10s',
          wind_speed: '5',
          wind_direction_deg: 90,
          tide_height: '2.0',
        }),
        createForecast({
          forecast_time: '07:00:00',
          wave_height: '3.0',
          wave_period: '12s',
          wind_speed: '4',
          wind_direction_deg: 90,
          tide_height: '2.8',
        }),
        createForecast({
          forecast_time: '08:00:00',
          wave_height: '3.5',
          wave_period: '14s',
          wind_speed: '3',
          wind_direction_deg: 90,
          tide_height: '3.5',
        }),
        createForecast({
          forecast_time: '09:00:00',
          wave_height: '3.5',
          wave_period: '12s',
          wind_speed: '6',
          wind_direction_deg: 85,
          tide_height: '4.2',
        }),
      ];

      // Step 1: Transform entities to scoring format
      const forecasts = entities.map(toForecastForScoring);

      // Verify transformation worked
      expect(forecasts).toHaveLength(4);
      expect(forecasts[0].waveHeight).toBe(2.5);
      expect(forecasts[0].wavePeriod).toBe(10);

      // Step 2: Score individual forecasts
      const scores = forecasts.map((f) => scoreConditions(f, oceanBeachPier));

      // Verify scores are calculated
      expect(scores.every((s) => typeof s.total === 'number')).toBe(true);

      // Step 3: Calculate optimal window
      const window = calculateOptimalWindow(forecasts, oceanBeachPier);

      // Window should exist for these good conditions
      expect(window).not.toBeNull();
      if (window) {
        expect(window.message).toBeTruthy();
        expect(window.startReason).toBeDefined();
        expect(window.endReason).toBeDefined();
      }
    });
  });

  describe('Message generation includes relevant context', () => {
    it('includes wind context for offshore conditions', () => {
      const forecast = toForecastForScoring(
        createForecast({
          wind_speed: '5',
          wind_direction_deg: 90, // Offshore
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      // Should mention favorable wind in reasons or message
      const hasWindContext =
        result.reasons.some((r) => /offshore|wind|glassy/i.test(r)) ||
        /offshore|wind|glassy/i.test(result.message);
      expect(hasWindContext).toBe(true);
    });

    it('includes wave context for good swell', () => {
      const forecast = toForecastForScoring(
        createForecast({
          wave_height: '4.0',
          wave_period: '14s',
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      // Should mention wave size or energy
      const hasWaveContext = result.reasons.some(
        (r) => /wave|swell|energy|ft/i.test(r)
      );
      expect(hasWaveContext).toBe(true);
    });

    it('includes warnings for marginal conditions', () => {
      // Low tide - outside preferred range
      const forecast = toForecastForScoring(
        createForecast({
          tide_height: '1.0', // Below preferred_tide_ft_min of 2.0
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      // Should warn about tide
      expect(result.warnings.some((w) => /tide/i.test(w))).toBe(true);
    });
  });

  describe('Consistency between Morning Intel and Best Bet', () => {
    it('same conditions produce same score regardless of context', () => {
      const entity = createForecast({
        wave_height: '3.5',
        wave_period: '12s',
        wind_speed: '5',
        wind_direction_deg: 90,
        tide_height: '3.0',
      });

      // Score the same entity twice
      const forecast = toForecastForScoring(entity);
      const score1 = scoreConditions(forecast, oceanBeachPier);
      const score2 = scoreConditions(forecast, oceanBeachPier);

      // Results should be identical
      expect(score1.total).toBe(score2.total);
      expect(score1.matchQuality).toBe(score2.matchQuality);
      expect(score1.recommendationLabel).toBe(score2.recommendationLabel);
    });

    it('score thresholds map to consistent labels', () => {
      // Test that score-based labels are consistent across various conditions
      const forecast1 = toForecastForScoring(
        createForecast({
          wave_height: '3.5',
          wave_period: '12s',
          wind_speed: '3', // Low wind = high score
          wind_direction_deg: 90,
          tide_height: '3.0',
        })
      );

      const result1 = scoreConditions(forecast1, oceanBeachPier);

      // Low wind should produce high scores - perfect, excellent, or good
      expect(['perfect', 'excellent', 'good']).toContain(result1.matchQuality);
      // High scores should map to "Worth it"
      if (result1.total >= 70) {
        expect(result1.recommendationLabel).toBe('Worth it');
      }

      const forecast2 = toForecastForScoring(
        createForecast({
          wave_height: '3.5',
          wave_period: '12s',
          wind_speed: '10', // Moderate wind
          wind_direction_deg: 90,
          tide_height: '3.0',
        })
      );

      const result2 = scoreConditions(forecast2, oceanBeachPier);

      // Moderate conditions should still be viable
      expect(['perfect', 'excellent', 'good', 'fair']).toContain(result2.matchQuality);
      // Label should match score thresholds
      if (result2.total >= 70) {
        expect(result2.recommendationLabel).toBe('Worth it');
      } else if (result2.total >= 40) {
        expect(result2.recommendationLabel).toBe('Maybe');
      }
    });
  });

  describe('Edge cases in integration', () => {
    it('handles empty forecast array for window calculation', () => {
      const window = calculateOptimalWindow([], oceanBeachPier);
      expect(window).toBeNull();
    });

    it('handles single forecast for window calculation', () => {
      const forecasts = [
        toForecastForScoring(
          createForecast({
            forecast_time: '07:00:00',
          })
        ),
      ];

      // Single forecast can't form a meaningful window
      const window = calculateOptimalWindow(forecasts, oceanBeachPier);
      expect(window).toBeNull();
    });

    it('handles missing wind direction gracefully', () => {
      const forecast = toForecastForScoring(
        createForecast({
          wind_direction_deg: null as unknown as number,
          wind_direction: null as unknown as string,
        })
      );

      const result = scoreConditions(forecast, oceanBeachPier);

      // Should still produce a valid result
      expect(result).toBeDefined();
      expect(typeof result.total).toBe('number');
    });

    it('handles string number parsing in entity conversion', () => {
      const forecast = toForecastForScoring(
        createForecast({
          wave_height: '3.5',
          wave_period: '12s',
          wind_speed: '5',
          tide_height: '3.0',
        })
      );

      expect(forecast.waveHeight).toBe(3.5);
      expect(forecast.wavePeriod).toBe(12);
      expect(forecast.windSpeed).toBe(5);
      expect(forecast.tideHeight).toBe(3.0);
    });
  });
});
