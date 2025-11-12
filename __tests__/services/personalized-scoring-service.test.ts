import {
  scoreBeachForUser,
  matchesWaveSize,
  matchesLearnedWaveRange,
  matchesLearnedWindPrefs,
  matchesLearnedTidePrefs,
  type PersonalizedScore,
} from '@/lib/services/personalized-scoring-service';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Mock Supabase client
let mockQueryResults: any[] = [];
let mockQueryIndex = 0;

const createMockQueryBuilder = () => {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => {
      const result = mockQueryResults[mockQueryIndex] || { data: null, error: null };
      mockQueryIndex++;
      return Promise.resolve(result);
    }),
    then: jest.fn((resolve) => {
      const result = mockQueryResults[mockQueryIndex] || { data: null, error: null };
      mockQueryIndex++;
      resolve(result);
      return Promise.resolve(result);
    }),
  };
  return builder;
};

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      return createMockQueryBuilder();
    }),
  })),
}));

// Mock preference-learning-service
let mockUserPreferences: any = null;
jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: jest.fn(() => Promise.resolve(mockUserPreferences)),
}));

// Mock forecast data
const createMockForecast = (
  waveHeight: string,
  windSpeed: string,
  windDirection: string,
  tideStatus: string
): EnhancedForecastEntity => ({
  id: 'forecast-123',
  beach_id: 'beach-456',
  forecast_date: '2025-11-03',
  forecast_time: '08:00:00',
  wave_height: waveHeight,
  wave_period: '12',
  wave_direction: '270',
  wind_speed: windSpeed,
  wind_direction: windDirection,
  tide_status: tideStatus,
  water_temp: '65',
  confidence_score: 85,
  data_source: 'CDIP',
  created_at: '2025-11-03T08:00:00Z',
  updated_at: '2025-11-03T08:00:00Z',
  swell_1_height: null,
  swell_1_period: null,
  swell_1_direction: null,
  swell_2_height: null,
  swell_2_period: null,
  swell_2_direction: null,
  wind_wave_height: null,
  wind_wave_period: null,
  wind_wave_direction: null,
  air_temperature: null,
  tide_height: null,
  next_tide_time: null,
  next_tide_type: null,
  next_tide_height: null,
  weather_condition: null,
  weather_description: null,
  raw_forecast: null,
});

describe('personalized-scoring-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResults = [];
    mockQueryIndex = 0;
    mockUserPreferences = null;
    console.error = jest.fn();
    console.log = jest.fn();
  });

  // ============================================================================
  // Helper Functions Tests
  // ============================================================================

  describe('matchesWaveSize', () => {
    it('should match small waves (1-3 ft)', () => {
      const forecast = createMockForecast('2.5', '5', '180', 'rising');
      expect(matchesWaveSize(forecast, 'small')).toBe(true);
    });

    it('should match medium waves (3-6 ft)', () => {
      const forecast = createMockForecast('4.5', '5', '180', 'rising');
      expect(matchesWaveSize(forecast, 'medium')).toBe(true);
    });

    it('should match large waves (6+ ft)', () => {
      const forecast = createMockForecast('7.5', '5', '180', 'rising');
      expect(matchesWaveSize(forecast, 'large')).toBe(true);
    });

    it('should not match when wave size is out of range', () => {
      const forecast = createMockForecast('2.5', '5', '180', 'rising');
      expect(matchesWaveSize(forecast, 'medium')).toBe(false);
      expect(matchesWaveSize(forecast, 'large')).toBe(false);
    });

    it('should handle boundary values correctly', () => {
      // Small: 1-3 ft
      expect(matchesWaveSize(createMockForecast('1.0', '5', '180', 'rising'), 'small')).toBe(
        true
      );
      expect(matchesWaveSize(createMockForecast('3.0', '5', '180', 'rising'), 'small')).toBe(
        true
      );

      // Medium: 3-6 ft (exclusive lower bound)
      expect(matchesWaveSize(createMockForecast('3.1', '5', '180', 'rising'), 'medium')).toBe(
        true
      );
      expect(matchesWaveSize(createMockForecast('6.0', '5', '180', 'rising'), 'medium')).toBe(
        true
      );

      // Large: 6+ ft (exclusive lower bound)
      expect(matchesWaveSize(createMockForecast('6.1', '5', '180', 'rising'), 'large')).toBe(
        true
      );
    });

    it('should return false for invalid preference', () => {
      const forecast = createMockForecast('4.5', '5', '180', 'rising');
      expect(matchesWaveSize(forecast, 'invalid')).toBe(false);
    });
  });

  describe('matchesLearnedWaveRange', () => {
    it('should match wave height within learned range', () => {
      const forecast = createMockForecast('4.0', '5', '180', 'rising');
      const prefs = { wave_min_ft: 3.0, wave_max_ft: 5.0 };
      expect(matchesLearnedWaveRange(forecast, prefs)).toBe(true);
    });

    it('should not match wave height outside learned range', () => {
      const forecast = createMockForecast('6.0', '5', '180', 'rising');
      const prefs = { wave_min_ft: 3.0, wave_max_ft: 5.0 };
      expect(matchesLearnedWaveRange(forecast, prefs)).toBe(false);
    });

    it('should handle boundary values correctly', () => {
      const prefs = { wave_min_ft: 3.0, wave_max_ft: 5.0 };

      // On boundaries - should match
      expect(
        matchesLearnedWaveRange(createMockForecast('3.0', '5', '180', 'rising'), prefs)
      ).toBe(true);
      expect(
        matchesLearnedWaveRange(createMockForecast('5.0', '5', '180', 'rising'), prefs)
      ).toBe(true);

      // Just outside boundaries - should not match
      expect(
        matchesLearnedWaveRange(createMockForecast('2.9', '5', '180', 'rising'), prefs)
      ).toBe(false);
      expect(
        matchesLearnedWaveRange(createMockForecast('5.1', '5', '180', 'rising'), prefs)
      ).toBe(false);
    });

    it('should return false when wave height is null', () => {
      const forecast = createMockForecast('0', '5', '180', 'rising');
      forecast.wave_height = null;
      const prefs = { wave_min_ft: 3.0, wave_max_ft: 5.0 };
      expect(matchesLearnedWaveRange(forecast, prefs)).toBe(false);
    });

    it('should return false when preferences are null', () => {
      const forecast = createMockForecast('4.0', '5', '180', 'rising');
      expect(matchesLearnedWaveRange(forecast, { wave_min_ft: null, wave_max_ft: 5.0 })).toBe(
        false
      );
      expect(matchesLearnedWaveRange(forecast, { wave_min_ft: 3.0, wave_max_ft: null })).toBe(
        false
      );
    });
  });

  describe('matchesLearnedWindPrefs', () => {
    it('should match when wind speed is within tolerance', () => {
      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const prefs = { max_wind_mph: 15, preferred_wind_directions: null };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should not match when wind speed exceeds tolerance', () => {
      const forecast = createMockForecast('4.0', '20', '180', 'rising');
      const prefs = { max_wind_mph: 15, preferred_wind_directions: null };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(false);
    });

    it('should match when wind direction is within ±30 degrees', () => {
      const forecast = createMockForecast('4.0', '10', '15', 'rising'); // 15° (near North 0°)
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [0] }; // North
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should not match when wind direction is outside ±30 degrees', () => {
      const forecast = createMockForecast('4.0', '10', '90', 'rising'); // 90° (East)
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [0] }; // North
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(false);
    });

    it('should handle direction wrapping around 0/360', () => {
      // 350° is 10° from North (0°), should match
      const forecast1 = createMockForecast('4.0', '10', '350', 'rising');
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [0] };
      expect(matchesLearnedWindPrefs(forecast1, prefs)).toBe(true);

      // 340° is 20° from North (0°), should match
      const forecast2 = createMockForecast('4.0', '10', '340', 'rising');
      expect(matchesLearnedWindPrefs(forecast2, prefs)).toBe(true);

      // 320° is 40° from North (0°), should not match
      const forecast3 = createMockForecast('4.0', '10', '320', 'rising');
      expect(matchesLearnedWindPrefs(forecast3, prefs)).toBe(false);
    });

    it('should match any of multiple preferred directions', () => {
      const forecast = createMockForecast('4.0', '10', '95', 'rising'); // ~East
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [0, 90, 180] }; // N, E, S
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should reject if speed exceeds max even with good direction', () => {
      const forecast = createMockForecast('4.0', '20', '0', 'rising'); // Perfect direction, too windy
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [0] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(false);
    });

    it('should handle only direction preferences (no speed limit)', () => {
      const forecast = createMockForecast('4.0', '25', '0', 'rising'); // High wind, good direction
      const prefs = { max_wind_mph: null, preferred_wind_directions: [0] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should match exact 0° (North) wind direction with 0° preference', () => {
      const forecast = createMockForecast('4.0', '5', '0', 'rising');
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [0] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should NOT match 0° wind direction when user prefers South (180°)', () => {
      const forecast = createMockForecast('4.0', '5', '0', 'rising');
      const prefs = { max_wind_mph: 15, preferred_wind_directions: [180] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(false);
    });

    // Edge cases for windSpeed = 0 (calm conditions)
    it('should match 0 mph wind with max_wind_mph = 0 (both calm)', () => {
      const forecast = createMockForecast('4.0', '0', '180', 'rising');
      const prefs = { max_wind_mph: 0, preferred_wind_directions: null };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should match 0 mph wind with max_wind_mph = 10 (calm within tolerance)', () => {
      const forecast = createMockForecast('4.0', '0', '180', 'rising');
      const prefs = { max_wind_mph: 10, preferred_wind_directions: null };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should NOT match 5 mph wind when max_wind_mph = 0 (too windy for calm preference)', () => {
      const forecast = createMockForecast('4.0', '5', '180', 'rising');
      const prefs = { max_wind_mph: 0, preferred_wind_directions: null };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(false);
    });

    it('should handle 0 mph wind with direction preferences', () => {
      const forecast = createMockForecast('4.0', '0', '180', 'rising');
      const prefs = { max_wind_mph: 10, preferred_wind_directions: [180] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should handle 0 mph wind with 0° direction', () => {
      const forecast = createMockForecast('4.0', '0', '0', 'rising');
      const prefs = { max_wind_mph: 10, preferred_wind_directions: [0] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should handle both 0 mph wind and 0° direction together', () => {
      const forecast = createMockForecast('4.0', '0', '0', 'rising');
      const prefs = { max_wind_mph: 0, preferred_wind_directions: [0] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(true);
    });

    it('should NOT match 0 mph wind with 0° direction when preferring opposite direction', () => {
      const forecast = createMockForecast('4.0', '0', '0', 'rising');
      const prefs = { max_wind_mph: 10, preferred_wind_directions: [180] };
      expect(matchesLearnedWindPrefs(forecast, prefs)).toBe(false);
    });
  });

  describe('matchesLearnedTidePrefs', () => {
    it('should match when tide status is in preferred list', () => {
      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const prefs = { preferred_tide_statuses: ['rising', 'high'] };
      expect(matchesLearnedTidePrefs(forecast, prefs)).toBe(true);
    });

    it('should not match when tide status is not in preferred list', () => {
      const forecast = createMockForecast('4.0', '10', '180', 'falling');
      const prefs = { preferred_tide_statuses: ['rising', 'high'] };
      expect(matchesLearnedTidePrefs(forecast, prefs)).toBe(false);
    });

    it('should return false when tide status is null', () => {
      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      forecast.tide_status = null;
      const prefs = { preferred_tide_statuses: ['rising', 'high'] };
      expect(matchesLearnedTidePrefs(forecast, prefs)).toBe(false);
    });

    it('should return false when preferences are null', () => {
      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const prefs = { preferred_tide_statuses: null };
      expect(matchesLearnedTidePrefs(forecast, prefs)).toBe(false);
    });
  });

  // ============================================================================
  // scoreBeachForUser Integration Tests
  // ============================================================================

  describe('scoreBeachForUser', () => {
    it('should return base score when no personalization data exists', async () => {
      // No profile data, no affinity
      mockQueryResults = [
        { data: null, error: null }, // Profile query
        { data: null, error: null }, // Affinity query
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBe(75);
      expect(result.personalized).toBe(false);
      expect(result.breakdown.base).toBe(75);
      expect(result.breakdown.onboardingPrefs).toBe(0);
      expect(result.breakdown.learnedPrefs).toBe(0);
      expect(result.breakdown.affinity).toBe(0);
    });

    it('should add onboarding wave size bonus', async () => {
      // Mock profile with wave size preference, no affinity
      mockQueryResults = [
        {
          data: { preferred_wave_size: 'medium', preferred_break_type: null },
          error: null,
        },
        { data: null, error: null }, // Affinity query
      ];

      const forecast = createMockForecast('4.5', '10', '180', 'rising'); // Medium waves
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBe(85); // 75 + 10
      expect(result.personalized).toBe(true);
      expect(result.breakdown.onboardingPrefs).toBe(10);
    });

    it('should add onboarding break type bonus', async () => {
      // First query: profile with break type preference
      // Second query: beach with matching break type
      // Third query: affinity
      mockQueryResults = [
        {
          data: { preferred_wave_size: 'any', preferred_break_type: 'beach' },
          error: null,
        },
        { data: { break_type: 'beach' }, error: null },
        { data: null, error: null }, // Affinity query
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBe(83); // 75 + 8 for break type
      expect(result.personalized).toBe(true);
      expect(result.breakdown.onboardingPrefs).toBe(8);
    });

    it('should add learned preferences bonus', async () => {
      // No onboarding prefs, no affinity
      mockQueryResults = [
        { data: { preferred_wave_size: 'any' }, error: null },
        { data: null, error: null }, // Affinity
      ];

      // Mock learned preferences with good conditions match
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 5.0,
        wave_period_min_s: 10,
        wave_period_max_s: 14,
        max_wind_mph: 15,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 0.8,
        sample_size: 15,
      };

      const forecast = createMockForecast('4.0', '10', '180', 'rising'); // Perfect match
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBeGreaterThan(75);
      expect(result.personalized).toBe(true);
      expect(result.breakdown.learnedPrefs).toBeGreaterThan(0);

      // With 0.8 confidence: wave (+15*0.8=12) + wind (+10*0.8=8) + tide (+8*0.8=6.4) = 26.4
      expect(result.breakdown.learnedPrefs).toBeCloseTo(26.4, 0);
    });

    it('should not apply learned preferences when confidence is low', async () => {
      mockQueryResults = [
        { data: null, error: null },
        { data: null, error: null },
      ];

      // Low confidence preferences
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 5.0,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: 15,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0.4, // Below 0.5 threshold
        sample_size: 3,
      };

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBe(75); // No bonus applied
      expect(result.breakdown.learnedPrefs).toBe(0);
    });

    it('should add beach affinity bonus', async () => {
      // Profile query, then affinity query
      mockQueryResults = [
        { data: { preferred_wave_size: 'any' }, error: null },
        { data: { affinity_score: 80, session_count: 15 }, error: null },
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBeGreaterThan(75);
      expect(result.personalized).toBe(true);
      expect(result.breakdown.affinity).toBeCloseTo(12, 0); // 80 * 0.15 = 12
    });

    it('should cap affinity bonus at 15 points', async () => {
      mockQueryResults = [
        { data: { preferred_wave_size: 'any' }, error: null },
        { data: { affinity_score: 100, session_count: 20 }, error: null },
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.breakdown.affinity).toBe(15); // Capped at 15
    });

    it('should combine all bonuses correctly', async () => {
      // Profile with both preferences, beach query, affinity query
      mockQueryResults = [
        {
          data: { preferred_wave_size: 'medium', preferred_break_type: 'beach' },
          error: null,
        },
        { data: { break_type: 'beach' }, error: null },
        { data: { affinity_score: 60, session_count: 10 }, error: null },
      ];

      // Mock learned preferences
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 6.0,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: 15,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 0.9,
        sample_size: 25,
      };

      const forecast = createMockForecast('4.5', '10', '180', 'rising'); // All conditions match
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 70);

      expect(result.personalized).toBe(true);
      expect(result.breakdown.base).toBe(70);
      expect(result.breakdown.onboardingPrefs).toBe(18); // 10 + 8
      expect(result.breakdown.learnedPrefs).toBeCloseTo(29.7, 0); // (15+10+8)*0.9
      expect(result.breakdown.affinity).toBeCloseTo(9, 0); // 60*0.15
    });

    it('should cap final score at 100', async () => {
      // Setup perfect match with high base score
      mockQueryResults = [
        {
          data: { preferred_wave_size: 'medium', preferred_break_type: 'beach' },
          error: null,
        },
        { data: { break_type: 'beach' }, error: null },
        { data: { affinity_score: 100, session_count: 20 }, error: null },
      ];

      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 6.0,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: 20,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 1.0,
        sample_size: 50,
      };

      const forecast = createMockForecast('4.5', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 90); // High base

      expect(result.score).toBe(100); // Capped at 100
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should ignore low affinity scores (< 10)', async () => {
      mockQueryResults = [
        { data: { preferred_wave_size: 'any' }, error: null },
        { data: { affinity_score: 8, session_count: 2 }, error: null },
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.breakdown.affinity).toBe(0); // No bonus for low affinity
    });
  });
});
