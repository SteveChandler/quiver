import {
  computeUserPreferences,
  getUserSurfPreferences,
  percentile,
  findModeDirections,
  findModes,
  calculateConfidence,
  parseForecastNumber,
  parseWindDirection,
  normalizeTideStatus,
  type UserSurfPreferences,
} from '@/lib/services/preference-learning-service';

// Mock Supabase client
let mockQueryResult: any = { data: null, error: null };
let mockQueryBuilder: any;

const createMockQueryBuilder = () => {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockQueryResult),
    upsert: jest.fn((data, options) => {
      // Upsert should return success by default
      return Promise.resolve({ data: data, error: null });
    }),
    then: jest.fn((resolve) => {
      resolve(mockQueryResult);
      return Promise.resolve(mockQueryResult);
    }),
  };
  return builder;
};

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      mockQueryBuilder = createMockQueryBuilder();
      return mockQueryBuilder;
    }),
  })),
}));

// Mock data
const createMockSnapshot = (
  rating: number | null,
  waveHeight: number,
  wavePeriod: number,
  windSpeed: number,
  windDirection: number,
  tideStatus: string,
  options: {
    waveQuality?: number | null;
    actualConditions?: Record<string, unknown>;
    session?: Record<string, unknown>;
  } = {}
) => ({
  id: `snapshot-${rating}`,
  session_id: `session-${rating}`,
  forecast_snapshot: {
    wave_height: waveHeight,
    wave_period: wavePeriod,
    wind_speed: windSpeed,
    wind_direction: windDirection,
    tide_status: tideStatus,
  },
  actual_conditions: {
    rating,
    ...(options.waveQuality !== undefined ? { wave_quality: options.waveQuality } : {}),
    ...options.actualConditions,
  },
  ...(options.session ? { sessions: options.session } : {}),
});

describe('preference-learning-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult = { data: null, error: null };
    console.error = jest.fn();
    console.log = jest.fn();
  });

  // ============================================================================
  // Helper Functions Tests
  // ============================================================================

  describe('percentile', () => {
    it('should calculate 50th percentile (median)', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('should calculate 10th percentile', () => {
      const result = percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10);
      expect(result).toBeCloseTo(1.9, 1);
    });

    it('should calculate 90th percentile', () => {
      const result = percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90);
      expect(result).toBeCloseTo(9.1, 1);
    });

    it('should handle single element array', () => {
      expect(percentile([5], 50)).toBe(5);
      expect(percentile([5], 90)).toBe(5);
    });

    it('should handle empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });

    it('should handle two element array', () => {
      expect(percentile([1, 3], 50)).toBe(2);
    });

    it('should interpolate between values', () => {
      const result = percentile([1, 2, 3, 4, 5], 75);
      expect(result).toBeCloseTo(4, 0);
    });

    it('should handle unsorted arrays', () => {
      expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    });
  });

  describe('findModeDirections', () => {
    it('should find most common cardinal direction', () => {
      // Mostly north (0°) and south (180°)
      const directions = [5, 10, 355, 180, 185, 190, 0];
      const modes = findModeDirections(directions, 45);

      expect(modes).toContain(0); // North
      expect(modes).toContain(180); // South
    });

    it('should normalize directions to 8 cardinals', () => {
      // All directions near east (90°)
      const directions = [85, 90, 95, 88, 92];
      const modes = findModeDirections(directions, 45);

      expect(modes).toContain(90); // East
      expect(modes.length).toBe(1);
    });

    it('should filter by minimum frequency (15%)', () => {
      // 10 north, 1 east (east is 10% < 15% threshold)
      const directions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90];
      const modes = findModeDirections(directions, 45);

      expect(modes).toContain(0); // North passes threshold
      expect(modes).not.toContain(90); // East below threshold
    });

    it('should return up to 3 modes', () => {
      // 4 different directions, all above threshold
      const directions = [0, 0, 45, 45, 90, 90, 135, 135];
      const modes = findModeDirections(directions, 45);

      expect(modes.length).toBeLessThanOrEqual(3);
    });

    it('should handle wrap-around at 360°', () => {
      // North: 355° and 5° should cluster at 0°
      const directions = [355, 0, 5, 358, 2];
      const modes = findModeDirections(directions, 45);

      expect(modes).toContain(0); // North
    });

    it('should handle empty array', () => {
      expect(findModeDirections([], 45)).toEqual([]);
    });

    it('should handle all same direction', () => {
      const modes = findModeDirections([90, 90, 90, 90], 45);
      expect(modes).toEqual([90]);
    });
  });

  describe('findModes', () => {
    it('should find modes above frequency threshold', () => {
      const modes = findModes(['rising', 'rising', 'high', 'low'], 0.2);

      expect(modes).toContain('rising'); // 50% frequency
      expect(modes).toContain('high'); // 25% frequency
      expect(modes).toContain('low'); // 25% frequency
    });

    it('should filter by minimum frequency (20%)', () => {
      const modes = findModes(['a', 'a', 'a', 'a', 'a', 'b'], 0.2);

      expect(modes).toContain('a'); // 83% frequency
      expect(modes).not.toContain('b'); // 17% frequency (below 20%)
    });

    it('should sort by frequency (most common first)', () => {
      const modes = findModes(['a', 'a', 'a', 'b', 'b', 'c'], 0.2);

      expect(modes[0]).toBe('a'); // 50%
      expect(modes[1]).toBe('b'); // 33%
      // 'c' is 17% which is < 20% threshold, so it should not be included
      expect(modes.length).toBe(2);
    });

    it('should handle empty array', () => {
      expect(findModes([], 0.2)).toEqual([]);
    });

    it('should handle all same value', () => {
      expect(findModes(['x', 'x', 'x'], 0.2)).toEqual(['x']);
    });

    it('should handle custom frequency threshold', () => {
      const modes = findModes(['a', 'a', 'b', 'b', 'c'], 0.3);

      expect(modes).toContain('a'); // 40%
      expect(modes).toContain('b'); // 40%
      expect(modes).not.toContain('c'); // 20% (below 30% threshold)
    });

    it('should work with numbers', () => {
      const modes = findModes([1, 1, 1, 2, 2, 3], 0.2);

      expect(modes).toContain(1);
      expect(modes).toContain(2);
    });
  });

  describe('calculateConfidence', () => {
    it('should return ~0.5 for 5 sessions', () => {
      const confidence = calculateConfidence(5);
      expect(confidence).toBeCloseTo(0.5, 1);
    });

    it('should return ~0.73 for 10 sessions', () => {
      const confidence = calculateConfidence(10);
      expect(confidence).toBeCloseTo(0.73, 1);
    });

    it('should return ~0.95 for 20 sessions', () => {
      const confidence = calculateConfidence(20);
      expect(confidence).toBeCloseTo(0.95, 1);
    });

    it('should return 0 for 0 sessions', () => {
      expect(calculateConfidence(0)).toBe(0);
    });

    it('should return 0 for negative sessions', () => {
      expect(calculateConfidence(-5)).toBe(0);
    });

    it('should increase monotonically', () => {
      const conf5 = calculateConfidence(5);
      const conf10 = calculateConfidence(10);
      const conf15 = calculateConfidence(15);
      const conf20 = calculateConfidence(20);

      expect(conf5).toBeLessThan(conf10);
      expect(conf10).toBeLessThan(conf15);
      expect(conf15).toBeLessThan(conf20);
    });

    it('should approach 1.0 asymptotically', () => {
      const conf50 = calculateConfidence(50);
      const conf100 = calculateConfidence(100);

      expect(conf50).toBeGreaterThan(0.99);
      expect(conf100).toBeGreaterThan(0.99);
      expect(conf50).toBeLessThanOrEqual(1.0);
      expect(conf100).toBeLessThanOrEqual(1.0);
    });

    it('should round to 2 decimal places', () => {
      const confidence = calculateConfidence(7);
      const decimals = confidence.toString().split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  describe('stored forecast value parsing', () => {
    it('should parse numeric display strings', () => {
      expect(parseForecastNumber('1 ft')).toBe(1);
      expect(parseForecastNumber('8s')).toBe(8);
      expect(parseForecastNumber('4 mph')).toBe(4);
      expect(parseForecastNumber('2-3 ft')).toBe(2.5);
      expect(parseForecastNumber('flat')).toBeNull();
      expect(parseForecastNumber(null)).toBeNull();
    });

    it('should parse compass wind directions', () => {
      expect(parseWindDirection('ESE')).toBe(112.5);
      expect(parseWindDirection('270°')).toBe(270);
      expect(parseWindDirection(-10)).toBe(350);
      expect(parseWindDirection('variable')).toBeNull();
    });

    it('should normalize tide status strings', () => {
      expect(normalizeTideStatus('Falling')).toBe('falling');
      expect(normalizeTideStatus('High Tide')).toBe('high_tide');
      expect(normalizeTideStatus(null)).toBeNull();
    });
  });

  // ============================================================================
  // Main Functions Tests
  // ============================================================================

  describe('computeUserPreferences', () => {
    it('should compute preferences with sufficient data', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(4, 3.5, 11, 7, 45, 'high'),
        createMockSnapshot(5, 5.0, 13, 10, 0, 'rising'),
        createMockSnapshot(3, 3.0, 10, 6, 90, 'low'),
        createMockSnapshot(4, 4.5, 12, 9, 0, 'rising'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.sample_size).toBe(5);
      expect(result?.wave_min_ft).toBeGreaterThan(0);
      expect(result?.wave_max_ft).toBeGreaterThan(result!.wave_min_ft!);
      expect(result?.confidence).toBeCloseTo(0.5, 1);
    });

    it('should only include sessions with rating >= 3', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(4, 3.5, 11, 7, 45, 'high'),
        createMockSnapshot(3, 5.0, 13, 10, 0, 'rising'),
        createMockSnapshot(3, 3.0, 10, 6, 90, 'low'),
        createMockSnapshot(3, 4.5, 12, 9, 0, 'rising'),
        createMockSnapshot(2, 2.0, 9, 5, 180, 'low'), // Should be excluded
        createMockSnapshot(1, 1.5, 8, 4, 90, 'flat'), // Should be excluded
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.sample_size).toBe(5); // Only ratings 3, 4, 5 (5 sessions >= 3)
    });

    it('does not learn small-wave preference from high rating when wave_quality is low', async () => {
      const mockSnapshots = Array.from({ length: 5 }, (_, i) =>
        createMockSnapshot(5, 1.0 + i * 0.1, 8, 5, 270, 'rising', {
          waveQuality: 2,
        })
      );

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.sample_size).toBe(5);
      expect(result?.wave_min_ft).toBeNull();
      expect(result?.wave_max_ft).toBeNull();
    });

    it('learns wave preference from high wave_quality even when rating is null', async () => {
      const mockSnapshots = [
        createMockSnapshot(null, 3.0, 11, 7, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(null, 3.5, 12, 8, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(null, 4.0, 13, 9, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(null, 4.5, 14, 10, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(null, 5.0, 15, 11, 270, 'rising', { waveQuality: 4 }),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBeCloseTo(3.2, 1);
      expect(result?.wave_max_ft).toBeCloseTo(4.8, 1);
    });

    it('ignores null wave_quality rows when enough wave_quality history exists', async () => {
      const positiveWaveQualityRows = [
        createMockSnapshot(3, 3.0, 11, 7, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(3, 3.5, 12, 8, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(3, 4.0, 13, 9, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(3, 4.5, 14, 10, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(3, 5.0, 15, 11, 270, 'rising', { waveQuality: 4 }),
      ];
      const nullWaveQualityRows = Array.from({ length: 5 }, () =>
        createMockSnapshot(5, 1.0, 8, 5, 270, 'rising')
      );

      mockQueryResult = {
        data: [...positiveWaveQualityRows, ...nullWaveQualityRows],
        error: null,
      };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBeGreaterThan(3);
      expect(result?.wave_max_ft).toBeGreaterThan(4);
    });

    it('excludes seeded similarity rows from preference learning', async () => {
      const seededRows = Array.from({ length: 5 }, () =>
        createMockSnapshot(5, 1.0, 8, 5, 270, 'rising', {
          waveQuality: 5,
          actualConditions: { notes: '[SEED_SIMILARITY_V2]' },
        })
      );
      const realRows = [
        createMockSnapshot(4, 3.0, 11, 7, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(4, 3.5, 12, 8, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(5, 4.0, 13, 9, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(5, 4.5, 14, 10, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(4, 5.0, 15, 11, 270, 'rising', { waveQuality: 4 }),
      ];

      mockQueryResult = { data: [...seededRows, ...realRows], error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.sample_size).toBe(5);
      expect(result?.wave_min_ft).toBeGreaterThan(3);
    });

    it('prefers actual logged condition fields over forecast snapshot fields', async () => {
      const mockSnapshots = Array.from({ length: 5 }, (_, i) =>
        createMockSnapshot(4, 1.0, 8, 20, 90, 'low', {
          waveQuality: 4,
          actualConditions: {
            wave_height_ft: 4 + i * 0.5,
            wind_speed_mph: 6 + i,
            wind_direction: 'W',
            tide_status: 'Falling',
            tide_height_ft: 2 + i * 0.1,
          },
        })
      );

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBeGreaterThan(4);
      expect(result?.max_wind_mph).toBeLessThan(11);
      expect(result?.preferred_wind_directions).toContain(270);
      expect(result?.preferred_tide_statuses).toContain('falling');
    });

    it('keeps small longboard sessions out of global wave preference', async () => {
      const smallLongboardRows = Array.from({ length: 5 }, () =>
        createMockSnapshot(5, 1.0, 8, 5, 270, 'rising', {
          waveQuality: 5,
          session: {
            board_id: 'longboard-1',
            board_snapshot: { board_type: 'longboard', name: 'Log' },
            goals: ['practice'],
          },
        })
      );
      const normalRows = [
        createMockSnapshot(4, 3.0, 11, 7, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(4, 3.5, 12, 8, 270, 'rising', { waveQuality: 4 }),
        createMockSnapshot(5, 4.0, 13, 9, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(5, 4.5, 14, 10, 270, 'rising', { waveQuality: 5 }),
        createMockSnapshot(4, 5.0, 15, 11, 270, 'rising', { waveQuality: 4 }),
      ];

      mockQueryResult = { data: [...smallLongboardRows, ...normalRows], error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBeGreaterThan(3);
    });

    it('should return null with insufficient data (<5 sessions)', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(4, 3.5, 11, 7, 45, 'high'),
        createMockSnapshot(3, 3.0, 10, 6, 90, 'low'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Not enough data')
      );
    });

    it('should return null with no sessions', async () => {
      mockQueryResult = { data: [], error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).toBeNull();
    });

    it('should calculate wave ranges correctly (percentiles)', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 2.0, 10, 5, 0, 'rising'),
        createMockSnapshot(4, 3.0, 11, 6, 0, 'high'),
        createMockSnapshot(5, 4.0, 12, 7, 0, 'rising'),
        createMockSnapshot(3, 5.0, 13, 8, 0, 'low'),
        createMockSnapshot(4, 6.0, 14, 9, 0, 'rising'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result?.wave_min_ft).toBeCloseTo(2.4, 1); // 10th percentile of [2,3,4,5,6]
      expect(result?.wave_max_ft).toBeCloseTo(5.6, 1); // 90th percentile
    });

    it('should calculate wave period ranges correctly', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 8, 5, 0, 'rising'),
        createMockSnapshot(4, 4.0, 10, 6, 0, 'high'),
        createMockSnapshot(5, 4.0, 12, 7, 0, 'rising'),
        createMockSnapshot(3, 4.0, 14, 8, 0, 'low'),
        createMockSnapshot(4, 4.0, 16, 9, 0, 'rising'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result?.wave_period_min_s).toBeGreaterThan(0);
      expect(result?.wave_period_max_s).toBeGreaterThan(result!.wave_period_min_s!);
    });

    it('should calculate max wind tolerance (90th percentile)', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 5, 0, 'rising'),
        createMockSnapshot(4, 4.0, 12, 10, 0, 'high'),
        createMockSnapshot(5, 4.0, 12, 15, 0, 'rising'),
        createMockSnapshot(3, 4.0, 12, 20, 0, 'low'),
        createMockSnapshot(4, 4.0, 12, 25, 0, 'rising'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result?.max_wind_mph).toBeGreaterThan(20); // 90th percentile
    });

    it('should find preferred wind directions (modes)', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'), // N
        createMockSnapshot(4, 4.0, 12, 8, 5, 'high'), // N
        createMockSnapshot(5, 4.0, 12, 8, 355, 'rising'), // N
        createMockSnapshot(3, 4.0, 12, 8, 180, 'low'), // S
        createMockSnapshot(4, 4.0, 12, 8, 185, 'rising'), // S
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result?.preferred_wind_directions).toContain(0); // North
      expect(result?.preferred_wind_directions).toContain(180); // South
    });

    it('should find preferred tide statuses (modes)', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(4, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(3, 4.0, 12, 8, 0, 'high'),
        createMockSnapshot(4, 4.0, 12, 8, 0, 'low'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result?.preferred_tide_statuses).toContain('rising'); // 60% frequency
    });

    it('should calculate confidence based on sample size', async () => {
      const mockSnapshots = Array.from({ length: 20 }, (_, i) =>
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising')
      );

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result?.sample_size).toBe(20);
      expect(result?.confidence).toBeGreaterThan(0.9); // High confidence
    });

    it('should compute preferences from stored display strings', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 1 as any, 8 as any, 4 as any, 90 as any, 'Falling'),
        createMockSnapshot(4, 2.5 as any, 9 as any, 5 as any, 90 as any, 'Falling'),
        createMockSnapshot(5, 4 as any, 10 as any, 6 as any, 90 as any, 'Rising'),
        createMockSnapshot(3, 5 as any, 11 as any, 7 as any, 90 as any, 'Falling'),
        createMockSnapshot(4, 6 as any, 12 as any, 8 as any, 90 as any, 'High'),
      ].map((snapshot, index) => ({
        ...snapshot,
        forecast_snapshot: {
          wave_height: ['1 ft', '2-3 ft', '4 ft', '5 ft', '6 ft'][index],
          wave_period: `${8 + index}s`,
          wind_speed: `${4 + index} mph`,
          wind_direction: 'ESE',
          tide_status: snapshot.forecast_snapshot.tide_status,
        },
      }));

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBeGreaterThan(0);
      expect(result?.wave_max_ft).toBeGreaterThan(result!.wave_min_ft!);
      expect(result?.wave_period_min_s).toBeGreaterThan(0);
      expect(result?.max_wind_mph).toBeGreaterThan(0);
      expect(result?.preferred_wind_directions).toContain(90);
      expect(result?.preferred_tide_statuses).toContain('falling');
    });

    it('should upsert preferences to database', async () => {
      const mockSnapshots = Array.from({ length: 5 }, (_, i) =>
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising')
      );

      mockQueryResult = { data: mockSnapshots, error: null };

      await computeUserPreferences('user-1');

      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          sample_size: 5,
        }),
        expect.objectContaining({
          onConflict: 'user_id',
        })
      );
    });

    it('should handle database fetch errors gracefully', async () => {
      mockQueryResult = { data: null, error: { message: 'Database error' } };

      const result = await computeUserPreferences('user-1');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle database upsert errors', async () => {
      const mockSnapshots = Array.from({ length: 5 }, (_, i) =>
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising')
      );

      // First query succeeds, upsert fails
      const mockFrom = jest.fn((table: string) => {
        if (table === 'session_forecast_snapshots') {
          return {
            ...createMockQueryBuilder(),
            then: jest.fn((resolve) => {
              resolve({ data: mockSnapshots, error: null });
              return Promise.resolve({ data: mockSnapshots, error: null });
            }),
          };
        } else {
          // user_surf_preferences table
          return {
            ...createMockQueryBuilder(),
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Upsert failed' },
            }),
          };
        }
      });

      const { createSupabaseServiceRoleClient } = require('@/lib/supabase/server');
      const originalMock = createSupabaseServiceRoleClient.getMockImplementation();
      createSupabaseServiceRoleClient.mockReturnValue({ from: mockFrom });

      // Function catches error and returns null (graceful degradation)
      const result = await computeUserPreferences('user-1');
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();

      // Restore original mock to prevent test interference
      if (originalMock) {
        createSupabaseServiceRoleClient.mockImplementation(originalMock);
      } else {
        // Reset to default mock
        createSupabaseServiceRoleClient.mockReturnValue({
          from: jest.fn(() => createMockQueryBuilder()),
        });
      }
    });

    it('should handle null values in forecast data', async () => {
      const mockSnapshots = [
        {
          id: '1',
          session_id: 's1',
          forecast_snapshot: {
            wave_height: null,
            wave_period: null,
            wind_speed: null,
            wind_direction: null,
            tide_status: null,
          },
          actual_conditions: { rating: 5 },
        },
        createMockSnapshot(4, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(5, 3.0, 11, 7, 45, 'high'),
        createMockSnapshot(3, 5.0, 13, 10, 90, 'low'),
        createMockSnapshot(4, 4.5, 12, 9, 180, 'rising'),
        createMockSnapshot(3, 3.5, 11, 8, 270, 'rising'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.sample_size).toBe(6);
      // Should compute preferences from non-null values (4 non-null wave heights)
      expect(result?.wave_min_ft).toBeGreaterThan(0);
    });

    it('should work with exactly 5 sessions (boundary case)', async () => {
      const mockSnapshots = [
        createMockSnapshot(5, 4.0, 12, 8, 0, 'rising'),
        createMockSnapshot(5, 4.5, 12, 8, 0, 'rising'),
        createMockSnapshot(5, 5.0, 12, 8, 0, 'rising'),
        createMockSnapshot(5, 5.5, 12, 8, 0, 'rising'),
        createMockSnapshot(5, 6.0, 12, 8, 0, 'rising'),
      ];

      mockQueryResult = { data: mockSnapshots, error: null };

      const result = await computeUserPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.sample_size).toBe(5);
      expect(result?.confidence).toBeCloseTo(0.5, 1);
    });
  });

  describe('getUserSurfPreferences', () => {
    it('should return preferences for existing user', async () => {
      const mockPreferences = {
        user_id: 'user-1',
        wave_min_ft: 3.0,
        wave_max_ft: 6.0,
        wave_period_min_s: 10.0,
        wave_period_max_s: 14.0,
        max_wind_mph: 12.0,
        preferred_wind_directions: [0, 180],
        preferred_tide_statuses: ['rising', 'high'],
        confidence: 0.85,
        sample_size: 15,
        last_computed_at: '2024-11-03T10:00:00Z',
        created_at: '2024-11-01T10:00:00Z',
        updated_at: '2024-11-03T10:00:00Z',
      };

      mockQueryResult = { data: mockPreferences, error: null };

      const result = await getUserSurfPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBe(3.0);
      expect(result?.wave_max_ft).toBe(6.0);
      expect(result?.confidence).toBe(0.85);
      expect(result?.sample_size).toBe(15);
    });

    it('should return null for non-existent user', async () => {
      mockQueryResult = {
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      };

      const result = await getUserSurfPreferences('nonexistent');

      expect(result).toBeNull();
      // Should not log error for expected "not found"
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockQueryResult = {
        data: null,
        error: { code: 'OTHER', message: 'Database error' },
      };

      const result = await getUserSurfPreferences('user-1');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should return null when data is null (no error)', async () => {
      mockQueryResult = { data: null, error: null };

      const result = await getUserSurfPreferences('user-1');

      expect(result).toBeNull();
    });

    it('should extract all preference fields correctly', async () => {
      const mockPreferences = {
        user_id: 'user-1',
        wave_min_ft: 2.5,
        wave_max_ft: 5.5,
        wave_period_min_s: 9.5,
        wave_period_max_s: 13.5,
        max_wind_mph: 15.0,
        preferred_wind_directions: [0, 45, 90],
        preferred_tide_statuses: ['rising'],
        confidence: 0.73,
        sample_size: 10,
        last_computed_at: '2024-11-03T10:00:00Z',
        created_at: '2024-11-01T10:00:00Z',
        updated_at: '2024-11-03T10:00:00Z',
      };

      mockQueryResult = { data: mockPreferences, error: null };

      const result = await getUserSurfPreferences('user-1');

      expect(result).toEqual({
        wave_min_ft: 2.5,
        wave_max_ft: 5.5,
        wave_period_min_s: 9.5,
        wave_period_max_s: 13.5,
        max_wind_mph: 15.0,
        preferred_wind_directions: [0, 45, 90],
        preferred_tide_statuses: ['rising'],
        confidence: 0.73,
        sample_size: 10,
      });
    });

    it('should handle null preference values', async () => {
      const mockPreferences = {
        user_id: 'user-1',
        wave_min_ft: null,
        wave_max_ft: null,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: null,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0.0,
        sample_size: 0,
        last_computed_at: null,
        created_at: '2024-11-01T10:00:00Z',
        updated_at: '2024-11-03T10:00:00Z',
      };

      mockQueryResult = { data: mockPreferences, error: null };

      const result = await getUserSurfPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.wave_min_ft).toBeNull();
      expect(result?.confidence).toBe(0.0);
    });
  });
});
