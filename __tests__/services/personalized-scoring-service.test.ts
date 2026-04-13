import {
  scoreBeachForUser,
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

// Mock implicit-preferences-service
let mockImplicitPreferences: any = null;
jest.mock('@/lib/services/implicit-preferences-service', () => ({
  getImplicitPreferences: jest.fn(() => Promise.resolve(mockImplicitPreferences)),
  calculateImplicitBonus: jest.fn(() => ({ total: 0, breakdown: { waveRange: 0, breakType: 0, topEngaged: 0 } })),
  isTopEngagedBeach: jest.fn(() => false),
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
  forecast_at: '2025-11-03T08:00:00Z',
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
    mockImplicitPreferences = null;
    console.error = jest.fn();
    console.log = jest.fn();
  });

  // ============================================================================
  // Helper Functions Tests
  // ============================================================================

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
      // No affinity
      mockQueryResults = [
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
      expect(result.breakdown.multiplier).toBe(1.0);
    });

    it('should apply learned preferences bonus multiplicatively', async () => {
      // No affinity
      mockQueryResults = [
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

      // multiplier = 1.0 + (26.4/50)*0.15 = 1.0792, score = round(75*1.0792) = 81
      expect(result.breakdown.multiplier).toBeCloseTo(1.0792, 3);
      expect(result.score).toBe(81);
    });

    it('should not apply learned preferences when confidence is low', async () => {
      mockQueryResults = [
        { data: null, error: null }, // Affinity
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

    it('should apply beach affinity bonus multiplicatively', async () => {
      mockQueryResults = [
        { data: { affinity_score: 80, session_count: 15 }, error: null },
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.score).toBeGreaterThan(75);
      expect(result.personalized).toBe(true);
      expect(result.breakdown.affinity).toBeCloseTo(12, 0); // 80 * 0.15 = 12

      // multiplier = 1.0 + (12/50)*0.15 = 1.036, score = round(75*1.036) = 78
      expect(result.breakdown.multiplier).toBeCloseTo(1.036, 4);
      expect(result.score).toBe(78);
    });

    it('should cap affinity bonus at 15 points', async () => {
      mockQueryResults = [
        { data: { affinity_score: 100, session_count: 20 }, error: null },
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.breakdown.affinity).toBe(15); // Capped at 15

      // multiplier = 1.0 + (15/50)*0.15 = 1.045, score = round(75*1.045) = 78
      expect(result.breakdown.multiplier).toBeCloseTo(1.045, 4);
      expect(result.score).toBe(78);
    });

    it('should combine learned + affinity bonuses multiplicatively', async () => {
      mockQueryResults = [
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
      expect(result.breakdown.learnedPrefs).toBeCloseTo(29.7, 0); // (15+10+8)*0.9
      expect(result.breakdown.affinity).toBeCloseTo(9, 0); // 60*0.15

      // totalBonus = 29.7 + 9 = 38.7
      // multiplier = 1.0 + (38.7/50)*0.15 = 1.1161
      expect(result.breakdown.multiplier).toBeCloseTo(1.1161, 3);
    });

    it('should cap final score at 100', async () => {
      mockQueryResults = [
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
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 95); // High base

      // totalBonus = learned (15+10+8) + affinity (15) = 48
      // multiplier = 1.0 + (48/50)*0.15 ≈ 1.144
      // 95 * 1.144 ≈ 108.68 -> capped at 100
      expect(result.score).toBe(100);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown.multiplier).toBeCloseTo(1.144, 3);
    });

    it('should ignore low affinity scores (< 10)', async () => {
      mockQueryResults = [
        { data: { affinity_score: 8, session_count: 2 }, error: null },
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.breakdown.affinity).toBe(0); // No bonus for low affinity
    });
  });

  // ============================================================================
  // Implicit Preference Integration Tests
  // ============================================================================

  describe('implicit preference integration', () => {
    it('applies implicit bonus when explicit confidence is low', async () => {
      // Setup: low explicit confidence (0.2), high implicit confidence (0.8)
      // Expected: implicitWeight = 0.8 * (1 - 0.2) = 0.64

      // Low explicit confidence
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 5.0,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: null,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0.2, // LOW confidence
        sample_size: 5,
      };

      // High implicit confidence
      mockImplicitPreferences = {
        user_id: 'user-123',
        confidence: 0.8, // HIGH confidence
        inferred_wave_min_ft: 3.0,
        inferred_wave_max_ft: 5.5,
        break_type_weights: { beach: 0.6, reef: 0.3, point: 0.1 },
        location_centroid_lat: 32.7157,
        location_centroid_lon: -117.2566,
        typical_travel_radius_miles: 30,
        top_engaged_beach_ids: [],
        sample_session_count: 25,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
      };

      // Import and mock the function
      const implicitService = jest.requireMock('@/lib/services/implicit-preferences-service');
      implicitService.calculateImplicitBonus.mockReturnValueOnce({
        total: 11.52,
        breakdown: { waveRange: 6.4, breakType: 5.12, topEngaged: 0 },
      });

      // Set up queries: Beach break type (implicit lookup), Affinity
      mockQueryResults = [
        { data: { break_type: 'beach' }, error: null }, // Beach query for break type
        { data: null, error: null }, // Affinity
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising'); // Matches implicit wave range
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      // With implicitWeight = 0.8 * (1 - 0.2) = 0.64
      // Wave range match: 10 * 0.64 = 6.4
      // Break type match: 8 * 0.64 = 5.12
      // Total: 11.52
      expect(result.breakdown.implicitPrefs).toBeGreaterThan(0);
      expect(result.personalized).toBe(true);
    });

    it('reduces implicit bonus when explicit confidence is high', async () => {
      // Setup: high explicit confidence (0.9), high implicit confidence (0.8)
      // Expected: implicitWeight = 0.8 * (1 - 0.9) = 0.08 (below 0.1 threshold)
      mockQueryResults = [
        { data: null, error: null }, // Affinity
      ];

      // High explicit confidence
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 5.0,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: 15,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 0.9, // HIGH confidence
        sample_size: 30,
      };

      // High implicit confidence (but will be reduced by high explicit)
      mockImplicitPreferences = {
        user_id: 'user-123',
        confidence: 0.8, // HIGH confidence
        inferred_wave_min_ft: 3.0,
        inferred_wave_max_ft: 5.5,
        break_type_weights: { beach: 0.6, reef: 0.3, point: 0.1 },
        location_centroid_lat: 32.7157,
        location_centroid_lon: -117.2566,
        typical_travel_radius_miles: 30,
        top_engaged_beach_ids: [],
        sample_session_count: 25,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
      };

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      // implicitWeight = 0.8 * (1 - 0.9) = 0.08 < 0.1 threshold
      // No implicit bonus should be applied
      expect(result.breakdown.implicitPrefs).toBe(0);
    });

    it('skips implicit bonus when implicit confidence is too low', async () => {
      // Setup: implicit confidence = 0.05 (< 0.1 threshold)
      mockQueryResults = [
        { data: null, error: null }, // Affinity
      ];

      // Low explicit confidence
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 5.0,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: null,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0.2, // Low
        sample_size: 5,
      };

      // Very low implicit confidence
      mockImplicitPreferences = {
        user_id: 'user-123',
        confidence: 0.05, // VERY LOW confidence (< 0.1 threshold)
        inferred_wave_min_ft: 3.0,
        inferred_wave_max_ft: 5.5,
        break_type_weights: { beach: 0.6, reef: 0.3, point: 0.1 },
        location_centroid_lat: 32.7157,
        location_centroid_lon: -117.2566,
        typical_travel_radius_miles: 30,
        top_engaged_beach_ids: [],
        sample_session_count: 25,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
      };

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      // Implicit confidence is below 0.1 threshold, should not apply
      expect(result.breakdown.implicitPrefs).toBe(0);
      expect(result.personalized).toBe(false);
    });

    it('blends implicit and explicit preferences correctly', async () => {
      // Setup: medium explicit confidence (0.6), medium implicit confidence (0.5)
      // Expected: implicitWeight = 0.5 * (1 - 0.6) = 0.2

      // Medium explicit confidence
      mockUserPreferences = {
        wave_min_ft: 2.5,
        wave_max_ft: 6.0,
        wave_period_min_s: 10,
        wave_period_max_s: 14,
        max_wind_mph: 15,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 0.6, // MEDIUM confidence
        sample_size: 15,
      };

      // Medium implicit confidence
      mockImplicitPreferences = {
        user_id: 'user-123',
        confidence: 0.5, // MEDIUM confidence
        inferred_wave_min_ft: 3.0,
        inferred_wave_max_ft: 5.5,
        break_type_weights: { beach: 0.8, reef: 0.15, point: 0.05 },
        location_centroid_lat: 32.7157,
        location_centroid_lon: -117.2566,
        typical_travel_radius_miles: 30,
        top_engaged_beach_ids: ['beach-456'], // This beach is top engaged!
        sample_session_count: 20,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
      };

      // Import and mock the function
      const implicitService = jest.requireMock('@/lib/services/implicit-preferences-service');
      implicitService.calculateImplicitBonus.mockReturnValueOnce({
        total: 5.6,
        breakdown: { waveRange: 2, breakType: 1.6, topEngaged: 2 },
      });

      mockQueryResults = [
        { data: { break_type: 'beach' }, error: null }, // Beach query for break type
        { data: null, error: null }, // Affinity
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      // implicitWeight = 0.5 * (1 - 0.6) = 0.2 > 0.1 threshold
      // Wave range bonus: 10 * 0.2 = 2
      // Break type bonus: 8 * 0.2 = 1.6
      // Top engaged bonus: 2 (flat)
      // Total implicit: 5.6
      expect(result.breakdown.implicitPrefs).toBeCloseTo(5.6, 0);
      expect(result.personalized).toBe(true);

      // Learned prefs should also apply
      expect(result.breakdown.learnedPrefs).toBeGreaterThan(0);

      // Total should be base + learned + implicit
      expect(result.score).toBeGreaterThan(75);
    });

    it('does not apply implicit bonus when implicit prefs is null', async () => {
      // Setup: no implicit preferences data

      // Medium confidence with all preferences defined (threshold is 0.5)
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 5.0,
        wave_period_min_s: 10,
        wave_period_max_s: 14,
        max_wind_mph: 15,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 0.6, // Above 0.5 threshold for learned prefs
        sample_size: 15,
      };

      // No implicit preferences
      mockImplicitPreferences = null;

      mockQueryResults = [
        { data: null, error: null }, // Affinity
      ];

      const forecast = createMockForecast('4.0', '10', '180', 'rising'); // Matches learned prefs
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      expect(result.breakdown.implicitPrefs).toBe(0);
      // Should still apply learned prefs if conditions match
      // Wave: 15*0.6=9, Wind: 10*0.6=6, Tide: 8*0.6=4.8 = 19.8 total
      expect(result.breakdown.learnedPrefs).toBeCloseTo(19.8, 0);
    });

    it('prioritizes explicit preferences over implicit when both available', async () => {
      // Setup: both explicit and implicit available with good matches
      // Explicit should be weighted more heavily
      mockQueryResults = [
        { data: { affinity_score: 50, session_count: 10 }, error: null }, // Affinity
      ];

      // High explicit confidence
      mockUserPreferences = {
        wave_min_ft: 3.0,
        wave_max_ft: 6.0,
        wave_period_min_s: 10,
        wave_period_max_s: 14,
        max_wind_mph: 15,
        preferred_wind_directions: [180],
        preferred_tide_statuses: ['rising'],
        confidence: 0.95, // VERY HIGH confidence
        sample_size: 50,
      };

      // High implicit confidence (but should be downweighted)
      mockImplicitPreferences = {
        user_id: 'user-123',
        confidence: 0.9,
        inferred_wave_min_ft: 2.0,
        inferred_wave_max_ft: 7.0,
        break_type_weights: { beach: 0.9, reef: 0.08, point: 0.02 },
        location_centroid_lat: 32.7157,
        location_centroid_lon: -117.2566,
        typical_travel_radius_miles: 30,
        top_engaged_beach_ids: [],
        sample_session_count: 100,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-25T00:00:00Z',
      };

      const forecast = createMockForecast('4.5', '10', '180', 'rising');
      const result = await scoreBeachForUser('user-123', 'beach-456', forecast, 75);

      // Learned prefs should dominate (high confidence: 0.95)
      // implicitWeight = 0.9 * (1 - 0.95) = 0.045 < 0.1 threshold
      // So minimal/no implicit bonus
      expect(result.breakdown.learnedPrefs).toBeGreaterThan(0);
      expect(result.breakdown.implicitPrefs).toBe(0); // Should be below threshold

      // Onboarding prefs no longer contribute
      expect(result.breakdown.onboardingPrefs).toBe(0);

      // Total should use multiplicative scoring
      const totalBonus = result.breakdown.onboardingPrefs + result.breakdown.learnedPrefs + result.breakdown.implicitPrefs + result.breakdown.affinity;
      const expectedMultiplier = 1.0 + Math.min(totalBonus / 50, 1.0) * 0.15;
      expect(result.score).toBe(Math.min(100, Math.round(75 * expectedMultiplier)));
    });
  });
});
