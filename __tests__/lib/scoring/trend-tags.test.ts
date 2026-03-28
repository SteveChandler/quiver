/**
 * @jest-environment node
 */

import { computeTrendTags } from '@/lib/scoring/trend-tags';
import type { EnhancedForecastEntity } from '@/types/forecast';

/**
 * Helper to create a minimal EnhancedForecastEntity for testing.
 * Only populates fields relevant to trend tag computation.
 */
function makeForecast(overrides: {
  wind_speed?: string | null;
  wind_direction_deg?: number | null;
  tide_height?: string | null;
  wave_period?: string | null;
}): EnhancedForecastEntity {
  return {
    id: 'test-id',
    beach_id: 'test-beach',
    forecast_at: '2026-01-24T08:00:00Z',
    forecast_date: '2026-01-24',
    forecast_time: '08:00:00',
    wave_height: '4',
    water_temp: '60',
    wind_speed: overrides.wind_speed ?? '10',
    wind_direction_deg: overrides.wind_direction_deg ?? 180,
    tide_height: overrides.tide_height ?? '3.0',
    wave_period: overrides.wave_period ?? '8',
  } as EnhancedForecastEntity;
}

describe('computeTrendTags', () => {
  describe('wind speed tags', () => {
    it('returns "Winds Dropping" when wind speed decreases >= 5 mph', () => {
      const forecasts = [
        makeForecast({ wind_speed: '15' }),
        makeForecast({ wind_speed: '12' }),
        makeForecast({ wind_speed: '9' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).toContain('Winds Dropping');
    });

    it('returns "Winds Building" when wind speed increases >= 5 mph', () => {
      const forecasts = [
        makeForecast({ wind_speed: '5' }),
        makeForecast({ wind_speed: '8' }),
        makeForecast({ wind_speed: '12' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).toContain('Winds Building');
    });

    it('does not return wind speed tag when change is < 5 mph', () => {
      const forecasts = [
        makeForecast({ wind_speed: '10' }),
        makeForecast({ wind_speed: '8' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Winds Dropping');
      expect(tags).not.toContain('Winds Building');
    });
  });

  describe('wind direction tag', () => {
    it('returns "Winds Cleaning Up" when speed stable but direction rotates >= 30 degrees toward offshore', () => {
      // Beach offshore direction is 0 degrees (North)
      // Wind starts at 50 degrees (50 off from offshore)
      // Wind ends at 10 degrees (10 off from offshore) - a 40 degree improvement
      const forecasts = [
        makeForecast({ wind_speed: '10', wind_direction_deg: 50 }),
        makeForecast({ wind_speed: '10', wind_direction_deg: 30 }),
        makeForecast({ wind_speed: '11', wind_direction_deg: 10 }),
      ];

      const tags = computeTrendTags(forecasts, { wind_offshore_deg: 0 });

      expect(tags).toContain('Winds Cleaning Up');
    });

    it('does not return "Winds Cleaning Up" when speed also changes >= 5 mph (speed takes priority)', () => {
      // Speed drops by 5+ mph AND direction improves - only "Winds Dropping" should appear
      const forecasts = [
        makeForecast({ wind_speed: '15', wind_direction_deg: 50 }),
        makeForecast({ wind_speed: '12', wind_direction_deg: 30 }),
        makeForecast({ wind_speed: '9', wind_direction_deg: 10 }),
      ];

      const tags = computeTrendTags(forecasts, { wind_offshore_deg: 0 });

      expect(tags).toContain('Winds Dropping');
      expect(tags).not.toContain('Winds Cleaning Up');
    });

    it('handles 0/360 degree boundary for wind direction', () => {
      // Beach offshore direction is 0 degrees (North)
      // Wind starts at 350 degrees (10 off from offshore via wrapping)
      // Wind ends at 5 degrees (5 off from offshore)
      // Angular difference from offshore: 10 -> 5, improvement of 5 degrees (not enough)
      //
      // Better test: offshore is 0, wind goes from 40 to 355
      // Angular diff from offshore: 40 -> 5, improvement of 35 degrees
      const forecasts = [
        makeForecast({ wind_speed: '10', wind_direction_deg: 40 }),
        makeForecast({ wind_speed: '10', wind_direction_deg: 20 }),
        makeForecast({ wind_speed: '11', wind_direction_deg: 355 }),
      ];

      const tags = computeTrendTags(forecasts, { wind_offshore_deg: 0 });

      expect(tags).toContain('Winds Cleaning Up');
    });

    it('does not return "Winds Cleaning Up" without beach offshore direction', () => {
      const forecasts = [
        makeForecast({ wind_speed: '10', wind_direction_deg: 50 }),
        makeForecast({ wind_speed: '10', wind_direction_deg: 10 }),
      ];

      // No beach provided - cannot determine offshore improvement
      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Winds Cleaning Up');
    });
  });

  describe('tide tags', () => {
    it('returns "Tide Filling In" when tide rises >= 1.0 ft', () => {
      const forecasts = [
        makeForecast({ tide_height: '2.0' }),
        makeForecast({ tide_height: '2.5' }),
        makeForecast({ tide_height: '3.2' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).toContain('Tide Filling In');
    });

    it('returns "Tide Draining" when tide drops >= 1.0 ft', () => {
      const forecasts = [
        makeForecast({ tide_height: '4.5' }),
        makeForecast({ tide_height: '3.8' }),
        makeForecast({ tide_height: '3.2' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).toContain('Tide Draining');
    });

    it('does not return tide tag when change is < 1.0 ft', () => {
      const forecasts = [
        makeForecast({ tide_height: '3.0' }),
        makeForecast({ tide_height: '3.5' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Tide Filling In');
      expect(tags).not.toContain('Tide Draining');
    });
  });

  describe('swell tag', () => {
    it('returns "Clean Swell" when avg period >= 10s and variance < 4', () => {
      const forecasts = [
        makeForecast({ wave_period: '12' }),
        makeForecast({ wave_period: '11' }),
        makeForecast({ wave_period: '12' }),
        makeForecast({ wave_period: '11' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).toContain('Clean Swell');
    });

    it('does not return "Clean Swell" when avg period < 10s', () => {
      const forecasts = [
        makeForecast({ wave_period: '7' }),
        makeForecast({ wave_period: '8' }),
        makeForecast({ wave_period: '7' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Clean Swell');
    });

    it('does not return "Clean Swell" when variance >= 4', () => {
      // High variance: periods of 8, 14, 8, 14 have variance of 12
      const forecasts = [
        makeForecast({ wave_period: '8' }),
        makeForecast({ wave_period: '14' }),
        makeForecast({ wave_period: '8' }),
        makeForecast({ wave_period: '14' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Clean Swell');
    });
  });

  describe('constraints', () => {
    it('returns max 3 tags', () => {
      // Set up conditions for many tags:
      // Winds Dropping (15 -> 9), Tide Filling In (2.0 -> 3.5), Clean Swell (12s low variance)
      // Also possible: more tags if we add more conditions
      const forecasts = [
        makeForecast({ wind_speed: '15', tide_height: '2.0', wave_period: '12' }),
        makeForecast({ wind_speed: '12', tide_height: '2.5', wave_period: '12' }),
        makeForecast({ wind_speed: '9', tide_height: '3.0', wave_period: '11' }),
        makeForecast({ wind_speed: '7', tide_height: '3.5', wave_period: '12' }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags.length).toBeLessThanOrEqual(3);
    });

    it('returns empty array for single forecast', () => {
      const forecasts = [makeForecast({ wind_speed: '10' })];

      const tags = computeTrendTags(forecasts);

      expect(tags).toEqual([]);
    });

    it('returns empty array for empty forecast array', () => {
      const tags = computeTrendTags([]);

      expect(tags).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles null wind_speed gracefully', () => {
      const forecasts = [
        makeForecast({ wind_speed: null }),
        makeForecast({ wind_speed: null }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Winds Dropping');
      expect(tags).not.toContain('Winds Building');
    });

    it('handles null tide_height gracefully', () => {
      const forecasts = [
        makeForecast({ tide_height: null }),
        makeForecast({ tide_height: null }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Tide Filling In');
      expect(tags).not.toContain('Tide Draining');
    });

    it('handles null wave_period gracefully', () => {
      const forecasts = [
        makeForecast({ wave_period: null }),
        makeForecast({ wave_period: null }),
      ];

      const tags = computeTrendTags(forecasts);

      expect(tags).not.toContain('Clean Swell');
    });

    it('handles null wind_direction_deg gracefully', () => {
      const forecasts = [
        makeForecast({ wind_speed: '10', wind_direction_deg: null }),
        makeForecast({ wind_speed: '10', wind_direction_deg: null }),
      ];

      const tags = computeTrendTags(forecasts, { wind_offshore_deg: 0 });

      expect(tags).not.toContain('Winds Cleaning Up');
    });
  });
});
