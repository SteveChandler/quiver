/**
 * @jest-environment node
 */

import {
  checkSkillGate,
  checkSwellGate,
  checkWindGate,
  evaluateDigestMatch,
} from '@/lib/services/forecast-digest-service';
import type {
  BeachMetadata,
  EnhancedForecastEntity,
} from '@/lib/services/magic-hour-finder';

describe('Forecast Digest Service', () => {
  describe('checkSkillGate', () => {
    it('should pass when user skill >= beach skill', () => {
      const result = checkSkillGate('advanced', 'intermediate');
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('advanced');
      expect(result.reason).toContain('intermediate');
    });

    it('should fail when user skill < beach skill', () => {
      const result = checkSkillGate('beginner', 'expert');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('expert');
    });

    it('should pass when user skill equals beach skill', () => {
      const result = checkSkillGate('intermediate', 'intermediate');
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('perfect');
    });

    it('should default user to intermediate when null', () => {
      const result = checkSkillGate(null, 'beginner');
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('intermediate');
    });

    it('should default beach to beginner when null', () => {
      const result = checkSkillGate('beginner', null);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('beginner');
    });
  });

  describe('checkSwellGate', () => {
    const mockBeach: BeachMetadata = {
      id: 'beach-1',
      name: 'Test Beach',
      slug: 'test-beach',
      skill_level: 'intermediate',
      swell_window_center_deg: 270, // W
      swell_window_halfwidth_deg: 45,
      wind_offshore_deg: 90, // E
      wind_offshore_tol_deg: 30,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 5,
    };

    const mockForecast: EnhancedForecastEntity = {
      id: 'forecast-1',
      beach_id: 'beach-1',
      forecast_date: '2025-01-07',
      forecast_time: '12:00:00',
      wave_height: '4',
      wave_period: '12',
      wave_direction: 'NW', // 315 degrees
      wind_direction_deg: 90,
      wind_speed: '10',
      tide_height: '3.5',
      created_at: '2025-01-07T00:00:00Z',
      updated_at: '2025-01-07T00:00:00Z',
    };

    it('should pass when swell is in window', () => {
      const forecasts = [mockForecast];
      const result = checkSwellGate(forecasts, mockBeach);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('optimal');
      expect(result.reason).toContain('window');
    });

    it('should fail when swell is outside window', () => {
      const forecasts = [
        {
          ...mockForecast,
          wave_direction: 'E', // 90 degrees - outside W window
        },
      ];
      const result = checkSwellGate(forecasts, mockBeach);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('outside');
    });

    it('should pass when beach has no swell window configured', () => {
      const beachNoWindow: BeachMetadata = {
        ...mockBeach,
        swell_window_center_deg: null,
        swell_window_halfwidth_deg: null,
      };
      const result = checkSwellGate([mockForecast], beachNoWindow);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('No specific');
    });

    it('should fail when no forecast data available', () => {
      const result = checkSwellGate([], mockBeach);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('No swell');
    });
  });

  describe('checkWindGate', () => {
    const mockBeach: BeachMetadata = {
      id: 'beach-1',
      name: 'Test Beach',
      slug: 'test-beach',
      skill_level: 'intermediate',
      swell_window_center_deg: 270,
      swell_window_halfwidth_deg: 45,
      wind_offshore_deg: 90, // E offshore
      wind_offshore_tol_deg: 30,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 5,
    };

    const mockForecast: EnhancedForecastEntity = {
      id: 'forecast-1',
      beach_id: 'beach-1',
      forecast_date: '2025-01-07',
      forecast_time: '12:00:00',
      wave_height: '4',
      wave_period: '12',
      wave_direction: 'NW',
      wind_direction_deg: 90, // E - perfect offshore
      wind_speed: '8',
      tide_height: '3.5',
      created_at: '2025-01-07T00:00:00Z',
      updated_at: '2025-01-07T00:00:00Z',
    };

    it('should pass with perfect offshore winds', () => {
      const forecasts = [mockForecast];
      const result = checkWindGate(forecasts, mockBeach);
      expect(result.passed).toBe(true);
      expect(result.quality).toContain('offshore');
      expect(result.reason).toContain('clean');
    });

    it('should pass with light onshore winds', () => {
      const forecasts = [
        {
          ...mockForecast,
          wind_direction_deg: 270, // W - onshore
          wind_speed: '4', // light
        },
      ];
      const result = checkWindGate(forecasts, mockBeach);
      expect(result.passed).toBe(true); // Wind gate never blocks
      expect(result.quality).toContain('onshore');
      expect(result.reason).toContain('light');
    });

    it('should pass but warn about strong onshore winds', () => {
      const forecasts = [
        {
          ...mockForecast,
          wind_direction_deg: 270, // W - onshore
          wind_speed: '15', // strong
        },
      ];
      const result = checkWindGate(forecasts, mockBeach);
      expect(result.passed).toBe(true); // Wind gate never blocks
      expect(result.quality).toContain('onshore');
      expect(result.reason).toContain('choppy');
    });

    it('should pass when beach has no wind preferences', () => {
      const beachNoWind: BeachMetadata = {
        ...mockBeach,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
      };
      const result = checkWindGate([mockForecast], beachNoWind);
      expect(result.passed).toBe(true);
      expect(result.quality).toContain('acceptable');
    });
  });

  describe('evaluateDigestMatch', () => {
    const mockBeach: BeachMetadata = {
      id: 'beach-1',
      name: 'Ocean Beach',
      slug: 'ocean-beach',
      skill_level: 'intermediate',
      swell_window_center_deg: 270,
      swell_window_halfwidth_deg: 45,
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 30,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 5,
    };

    // Create realistic forecast window (next 24 hours in 3-hour blocks)
    const now = new Date();
    const mockForecasts: EnhancedForecastEntity[] = Array.from({ length: 8 }, (_, i) => {
      const forecastTime = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);
      const dateStr = forecastTime.toISOString().split('T')[0];
      const timeStr = forecastTime.toISOString().split('T')[1].split('.')[0];

      return {
        id: `forecast-${i}`,
        beach_id: 'beach-1',
        forecast_date: dateStr,
        forecast_time: timeStr,
        wave_height: '4',
        wave_period: '12',
        wave_direction: 'NW', // 315 degrees - in window
        wind_direction_deg: 90, // E - offshore
        wind_speed: '8',
        tide_height: '3.5',
        created_at: '2025-01-07T00:00:00Z',
        updated_at: '2025-01-07T00:00:00Z',
      };
    });

    it('should return match for qualified user with good conditions', () => {
      const result = evaluateDigestMatch(mockForecasts, mockBeach, 'intermediate', null);
      expect(result.isMatch).toBe(true);
      expect(result.matchQuality).not.toBe('no_match');
      expect(result.skillGate.passed).toBe(true);
      expect(result.swellGate.passed).toBe(true);
      expect(result.windGate.passed).toBe(true);
      expect(result.whyText.length).toBeGreaterThan(0);
    });

    it('should not match when user skill is insufficient', () => {
      const result = evaluateDigestMatch(mockForecasts, mockBeach, 'beginner', null);
      expect(result.isMatch).toBe(false);
      expect(result.matchQuality).toBe('no_match');
      expect(result.skillGate.passed).toBe(false);
      expect(result.bestWindow).toBeNull();
    });

    it('should not match when swell is outside window', () => {
      const badSwellForecasts = [
        {
          ...mockForecasts[0],
          wave_direction: 'E', // 90 degrees - outside W window
        },
      ];
      const result = evaluateDigestMatch(badSwellForecasts, mockBeach, 'intermediate', null);
      expect(result.isMatch).toBe(false);
      expect(result.matchQuality).toBe('no_match');
      expect(result.swellGate.passed).toBe(false);
    });

    it('should generate why text when matching', () => {
      const result = evaluateDigestMatch(mockForecasts, mockBeach, 'advanced', null);
      expect(result.isMatch).toBe(true);
      expect(result.whyText.length).toBeGreaterThan(0);
      expect(result.whyText.join(' ')).toContain('Ocean Beach');
    });

    it('should handle expert user on expert spot', () => {
      const expertBeach: BeachMetadata = {
        ...mockBeach,
        skill_level: 'expert',
      };
      const result = evaluateDigestMatch(mockForecasts, expertBeach, 'expert', null);
      expect(result.isMatch).toBe(true);
      expect(result.skillGate.passed).toBe(true);
      expect(result.skillGate.reason).toContain('perfect');
    });
  });
});
