import { computeSurfCall } from '@/lib/utils/surf-call-logic';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// ============================================================================
// Test Factories
// ============================================================================

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'test-beach-id',
    name: 'Test Beach',
    slug: 'test-beach',
    lat: 32.75,
    lon: -117.25,
    city: 'San Diego',
    state: 'CA',
    country: 'US',
    break_type: 'beach break',
    wind_offshore_deg: 90,
    ...overrides,
  } as Beach;
}

function makeForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'test-beach-id',
    forecast_date: '2026-01-22',
    forecast_time: '08:00:00',
    wave_height: '3-4 ft',
    wave_period: '12s',
    wind_speed: '8',
    wind_direction: 'NW',
    wind_direction_deg: 315,
    tide_status: 'Rising',
    confidence_score: 75,
    data_source: 'NOAA_BUOY',
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeWindow(overrides: Partial<PersonalizedForecastWindow> = {}): PersonalizedForecastWindow {
  const start = new Date('2026-01-22T08:00:00Z');
  const end = new Date('2026-01-22T11:00:00Z'); // 3 hours = 180 min
  return {
    start,
    end,
    tide: 'Rising',
    wind: '8 NW',
    waveHeight: '3-4 ft',
    wavePeriod: '12s',
    dataSource: 'NOAA_BUOY',
    confidence: 75,
    timezone: 'America/Los_Angeles',
    score: 75,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('computeSurfCall', () => {
  describe('hard NO gates', () => {
    it('returns NO with message when no forecasts', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No forecast data available');
    });

    it('returns NO with message when forecasts array is empty', () => {
      const result = computeSurfCall(makeWindow(), [], makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No forecast data available');
    });

    it('returns NO when max wave height is below minimum rideable', () => {
      const forecasts = [makeForecast({ wave_height: '0.5 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('uses higher minimum for reef breaks', () => {
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('allows reef break when waves are above minimum', () => {
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('YES');
    });

    it('returns NO when window is null', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable surf window today.');
    });
  });

  describe('score-based verdicts', () => {
    const forecasts = [makeForecast()];

    it('returns YES for score >= 70', () => {
      const window = makeWindow({ score: 70 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('returns YES for score = 100', () => {
      const window = makeWindow({ score: 100 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('returns MAYBE for score = 69', () => {
      const window = makeWindow({ score: 69 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('returns MAYBE for score = 40', () => {
      const window = makeWindow({ score: 40 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('returns NO for score = 39', () => {
      const window = makeWindow({ score: 39 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });

    it('returns NO for score = 0', () => {
      const window = makeWindow({ score: 0 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });
  });

  describe('window duration gates', () => {
    const forecasts = [makeForecast()];

    it('returns NO for window < 30 minutes with "Window too short" message', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:25:00Z'); // 25 min
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable window long enough to surf.');
    });

    it('returns NO for window exactly 29 minutes', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:29:00Z'); // 29 min
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable window long enough to surf.');
    });

    it('caps YES to MAYBE for window between 30-44 minutes', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:40:00Z'); // 40 min
      const window = makeWindow({ start, end, score: 85 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('allows YES for window >= 45 minutes with high score', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:45:00Z'); // 45 min
      const window = makeWindow({ start, end, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('does not cap MAYBE to NO for 30-44 min windows', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:40:00Z'); // 40 min
      const window = makeWindow({ start, end, score: 50 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });
  });

  describe('confidence gates', () => {
    const forecasts = [makeForecast()];

    it('downgrades YES to MAYBE when confidence < 20 and score near YES threshold', () => {
      const window = makeWindow({ score: 72, confidence: 15 }); // score within 5 of 70
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('downgrades MAYBE to NO when confidence < 20 and score near MAYBE threshold', () => {
      const window = makeWindow({ score: 42, confidence: 10 }); // score within 5 of 40
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });

    it('does NOT downgrade when confidence >= 20', () => {
      const window = makeWindow({ score: 72, confidence: 25 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('does NOT downgrade when score is far from threshold', () => {
      const window = makeWindow({ score: 85, confidence: 10 }); // 15 from threshold
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('sets lowForecastConfidence when confidence < 35', () => {
      const window = makeWindow({ score: 80, confidence: 30 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.lowForecastConfidence).toBe(true);
    });

    it('does not set lowForecastConfidence when confidence >= 35', () => {
      const window = makeWindow({ score: 80, confidence: 40 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.lowForecastConfidence).toBe(false);
    });
  });

  describe('score clamping', () => {
    const forecasts = [makeForecast()];

    it('clamps negative scores to 0', () => {
      const window = makeWindow({ score: -10 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBe(0);
      expect(result.verdict).toBe('NO');
    });

    it('clamps scores above 100 to 100', () => {
      const window = makeWindow({ score: 150 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBe(100);
      expect(result.verdict).toBe('YES');
    });

    it('defaults undefined score to 0', () => {
      const window = makeWindow({ score: undefined });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBe(0);
    });
  });

  describe('wind description', () => {
    it('returns "glassy" for wind < 5 mph', () => {
      const forecasts = [makeForecast({ wind_speed: '3', wind_direction_deg: 90 } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.windDescription).toBe('glassy');
    });

    it('returns structured wind for offshore-aligned wind', () => {
      // Beach offshore is 90 deg, wind dir is 90 deg → 0 diff → offshore
      const forecasts = [makeForecast({ wind_speed: '8', wind_direction: 'NW', wind_direction_deg: 90 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 8 mph (offshore)');
      expect(result.windSpeed).toBe('8 mph');
      expect(result.windCompass).toBe('NW');
      expect(result.windType).toBe('offshore');
    });

    it('returns structured wind for onshore wind', () => {
      // Beach offshore is 90, wind is 270 → 180 diff → onshore
      const forecasts = [makeForecast({ wind_speed: '8', wind_direction: 'NW', wind_direction_deg: 270 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 8 mph (onshore)');
      expect(result.windSpeed).toBe('8 mph');
      expect(result.windType).toBe('onshore');
    });

    it('returns structured wind for cross-shore wind', () => {
      // Beach offshore is 0, wind is 90 → 90 diff → cross-shore
      const forecasts = [makeForecast({ wind_speed: '12', wind_direction: 'NW', wind_direction_deg: 90 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 0 } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 12 mph (cross-shore)');
      expect(result.windSpeed).toBe('12 mph');
      expect(result.windType).toBe('cross-shore');
    });

    it('returns speed without type when no offshore data', () => {
      const forecasts = [makeForecast({ wind_speed: '25', wind_direction: 'NW', wind_direction_deg: null } as any)];
      const beach = makeBeach({ wind_offshore_deg: null } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 25 mph');
      expect(result.windSpeed).toBe('25 mph');
      expect(result.windType).toBeNull();
    });

    it('returns "Unknown" when wind speed is missing', () => {
      const forecasts = [makeForecast({ wind_speed: null } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.windDescription).toBe('Unknown');
    });
  });

  describe('tide description', () => {
    it('returns "rising" for Rising tide status', () => {
      const forecasts = [makeForecast({ tide_status: 'Rising' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('rising');
    });

    it('returns "falling" for Falling tide status', () => {
      const forecasts = [makeForecast({ tide_status: 'Falling' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('falling');
    });

    it('returns "high slack" for High Slack status', () => {
      const forecasts = [makeForecast({ tide_status: 'High Slack' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('high slack');
    });

    it('returns "low slack" for Low Slack status', () => {
      const forecasts = [makeForecast({ tide_status: 'Low Slack' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('low slack');
    });

    it('returns "Unknown" when tide_status is null', () => {
      const forecasts = [makeForecast({ tide_status: null } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('Unknown');
    });
  });

  describe('output structure', () => {
    const forecasts = [makeForecast()];

    it('includes window start/end as ISO strings', () => {
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.bestWindowStart).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.bestWindowEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes updatedAt as ISO string', () => {
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('calculates windowMinutes correctly', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T10:30:00Z'); // 150 min
      const window = makeWindow({ start, end, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.windowMinutes).toBe(150);
    });

    it('passes through waveHeight from window (unless Unknown)', () => {
      const window = makeWindow({ waveHeight: '4-6 ft', score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.waveHeight).toBe('4-6 ft');
    });

    it('sets waveHeight to null when window waveHeight is Unknown', () => {
      const window = makeWindow({ waveHeight: 'Unknown', score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.waveHeight).toBeNull();
    });

    it('returns null fields for NO with no window', () => {
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.bestWindowStart).toBeNull();
      expect(result.bestWindowEnd).toBeNull();
      expect(result.windowMinutes).toBeNull();
    });
  });

  describe('why sentence generation', () => {
    const forecasts = [makeForecast()];

    it('generates explanatory sentence for YES verdict', () => {
      const window = makeWindow({ score: 85 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
      // YES sentences explain what makes it good (tide, swell, offshore, etc.)
      expect(result.whySentence.length).toBeGreaterThan(10);
      expect(result.whySentence).toMatch(/\./); // ends with period
    });

    it('generates explanatory sentence for MAYBE verdict', () => {
      const window = makeWindow({ score: 55 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
      // MAYBE sentences explain the limiting factor
      expect(result.whySentence.length).toBeGreaterThan(10);
      expect(result.whySentence).toMatch(/\./); // ends with period
    });

    it('generates choppy sentence for NO with onshore wind', () => {
      const forecasts = [makeForecast({ wind_speed: '20', wind_direction_deg: 270 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const window = makeWindow({ score: 30 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toContain('choppy');
    });

    it('uses "No forecast data available" for empty forecasts', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.whySentence).toBe('No forecast data available');
    });
  });

  describe('break type minimums', () => {
    it('uses 1.5 ft for beach break', () => {
      const beach = makeBeach({ break_type: 'beach break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.4 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('uses 2.0 ft for point break', () => {
      const beach = makeBeach({ break_type: 'point break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.9 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('uses 1.5 ft default for unknown break type', () => {
      const beach = makeBeach({ break_type: 'jetty' } as any);
      const forecasts = [makeForecast({ wave_height: '1.4 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('uses 1.5 ft default when break_type is null', () => {
      const beach = makeBeach({ break_type: null } as any);
      const forecasts = [makeForecast({ wave_height: '1.6 ft' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, beach);
      // 1.6 > 1.5 default, so waves pass
      expect(result.whySentence).not.toBe('Waves too small for this spot.');
    });
  });

  describe('peakTime', () => {
    const forecasts = [makeForecast()];

    it('returns peakTime as ISO string when window has a peakTime Date', () => {
      const peakTime = new Date('2026-01-22T09:30:00Z');
      const window = makeWindow({ score: 80, peakTime });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.peakTime).toBe('2026-01-22T09:30:00.000Z');
    });

    it('returns peakTime as null when no window exists', () => {
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.peakTime).toBeNull();
    });

    it('returns peakTime as null when window has no peakTime', () => {
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.peakTime).toBeNull();
    });
  });

  describe('trendTags', () => {
    it('returns trendTags with expected tags when window forecasts have clear trends', () => {
      // Wind dropping from 15→5 mph across 4 forecasts within the window
      const forecasts = [
        makeForecast({
          forecast_time: '08:00:00',
          wind_speed: '15',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '2.0',
        } as any),
        makeForecast({
          forecast_time: '09:00:00',
          wind_speed: '12',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '2.5',
        } as any),
        makeForecast({
          forecast_time: '10:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '3.0',
        } as any),
        makeForecast({
          forecast_time: '11:00:00',
          wind_speed: '5',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '3.5',
        } as any),
      ];
      const window = makeWindow({ score: 80 });
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.trendTags).toContain('Winds Dropping');
    });

    it('returns trendTags as empty array when no window exists', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.trendTags).toEqual([]);
    });

    it('returns trendTags as empty array when window is too short', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:25:00Z'); // 25 min - below minimum
      const forecasts = [
        makeForecast({
          forecast_time: '08:00:00',
          wind_speed: '15',
          wind_direction_deg: 90,
        } as any),
        makeForecast({
          forecast_time: '08:15:00',
          wind_speed: '5',
          wind_direction_deg: 90,
        } as any),
      ];
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.trendTags).toEqual([]);
    });

    it('includes Tide Filling In when tide rises >= 1.0 ft across window', () => {
      const forecasts = [
        makeForecast({
          forecast_time: '08:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '1.0',
        } as any),
        makeForecast({
          forecast_time: '09:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '1.5',
        } as any),
        makeForecast({
          forecast_time: '10:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '2.0',
        } as any),
        makeForecast({
          forecast_time: '11:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '2.5',
        } as any),
      ];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.trendTags).toContain('Tide Filling In');
    });

    it('returns trendTags as empty array when no forecasts exist', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.trendTags).toEqual([]);
    });
  });

  describe('wave height parsing', () => {
    it('parses range format "3-4 ft"', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES'); // waves pass
    });

    it('parses single number "2.5"', () => {
      const forecasts = [makeForecast({ wave_height: '2.5' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES'); // 2.5 > 1.5
    });

    it('handles "Unknown" wave height', () => {
      const forecasts = [makeForecast({ wave_height: 'Unknown' })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      // All forecasts have Unknown → maxWave is -Infinity → below minRideable → NO
      expect(result.verdict).toBe('NO');
    });

    it('handles null wave height', () => {
      const forecasts = [makeForecast({ wave_height: null })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });

    it('uses max wave from multiple forecasts', () => {
      const forecasts = [
        makeForecast({ wave_height: '1.0 ft' }),
        makeForecast({ wave_height: '4.0 ft', forecast_time: '10:00:00' }),
      ];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      // Max wave is 4.0, above 1.5 minimum
      expect(result.whySentence).not.toBe('Waves too small for this spot.');
    });
  });
});
