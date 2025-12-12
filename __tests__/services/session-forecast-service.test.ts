import {
  getSessionForecastSnapshot,
  getUserForecastHistory,
  analyzePreferredConditions,
  getDataSourceDistribution,
  getMonthlyCoverage,
  type SessionForecastSnapshot,
  type ForecastHistoryFilters,
} from '@/lib/services/session-forecast-service';

// Mock data
const mockSnapshot: SessionForecastSnapshot = {
  id: 'snapshot-1',
  session_id: 'session-1',
  user_id: 'user-1',
  beach_id: 'beach-1',
  forecast_snapshot: {
    wave_height: 4.5,
    wave_period: 12,
    wave_direction: 270,
    wind_speed: 8,
    wind_direction: 180,
    tide_status: 'rising',
    tide_height: 2.5,
    confidence_score: 85,
    data_source: 'CDIP',
    forecast_time: '2024-11-03T10:00:00Z',
    forecast_date: '2024-11-03',
    forecast_hour: 10,
  },
  actual_conditions: {
    wave_quality: 'good',
    water_temp: 62,
    crowd_level: 'moderate',
    parking_ease: 'easy',
    rating: 4,
    notes: 'Great session!',
    duration_minutes: 90,
    arrival_time: '2024-11-03T10:00:00Z',
  },
  forecast_confidence_score: 85,
  data_source: 'CDIP',
  session_date: '2024-11-03',
  created_at: '2024-11-03T10:00:00Z',
  updated_at: '2024-11-03T10:00:00Z',
};

const mockSnapshot2: SessionForecastSnapshot = {
  ...mockSnapshot,
  id: 'snapshot-2',
  session_id: 'session-2',
  beach_id: 'beach-2',
  forecast_snapshot: {
    ...mockSnapshot.forecast_snapshot,
    wave_height: 3.0,
    data_source: 'NOAA_NWS',
  },
  actual_conditions: {
    ...mockSnapshot.actual_conditions,
    rating: 5,
  },
  data_source: 'NOAA_NWS',
  session_date: '2024-11-02',
};

const mockSnapshot3: SessionForecastSnapshot = {
  ...mockSnapshot,
  id: 'snapshot-3',
  session_id: 'session-3',
  forecast_snapshot: {
    ...mockSnapshot.forecast_snapshot,
    wave_height: 2.0,
  },
  actual_conditions: {
    ...mockSnapshot.actual_conditions,
    rating: 2,
  },
  session_date: '2024-10-15',
};

// Mock Supabase client
let mockQueryResult: any = { data: null, error: null };
let mockQueryBuilder: any;

const createMockQueryBuilder = () => {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockQueryResult),
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

describe('session-forecast-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult = { data: null, error: null };
    console.error = jest.fn(); // Suppress error logs in tests
  });

  describe('getSessionForecastSnapshot', () => {
    it('should return snapshot for valid session ID', async () => {
      mockQueryResult = { data: mockSnapshot, error: null };

      const result = await getSessionForecastSnapshot('session-1');

      expect(result).toEqual(mockSnapshot);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('session_id', 'session-1');
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });

    it('should return null when snapshot not found', async () => {
      mockQueryResult = { data: null, error: { message: 'Not found' } };

      const result = await getSessionForecastSnapshot('nonexistent');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockQueryResult = { data: null, error: { message: 'Database error' } };

      const result = await getSessionForecastSnapshot('session-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserForecastHistory', () => {
    beforeEach(() => {
      mockQueryResult = {
        data: [mockSnapshot, mockSnapshot2, mockSnapshot3],
        error: null,
      };
    });

    it('should return user history without filters', async () => {
      const result = await getUserForecastHistory('user-1');

      expect(result).toHaveLength(3);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('session_date', {
        ascending: false,
      });
    });

    it('should filter by start date', async () => {
      const startDate = new Date('2024-11-01');
      const filters: ForecastHistoryFilters = { startDate };

      await getUserForecastHistory('user-1', filters);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('session_date', '2024-11-01');
    });

    it('should filter by end date', async () => {
      const endDate = new Date('2024-11-03');
      const filters: ForecastHistoryFilters = { endDate };

      await getUserForecastHistory('user-1', filters);

      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('session_date', '2024-11-03');
    });

    it('should filter by beach ID', async () => {
      const filters: ForecastHistoryFilters = { beachId: 'beach-1' };

      await getUserForecastHistory('user-1', filters);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('beach_id', 'beach-1');
    });

    it('should filter by data source', async () => {
      const filters: ForecastHistoryFilters = { dataSource: 'CDIP' };

      await getUserForecastHistory('user-1', filters);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('data_source', 'CDIP');
    });

    it('should filter by minimum confidence', async () => {
      const filters: ForecastHistoryFilters = { minConfidence: 80 };

      await getUserForecastHistory('user-1', filters);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'forecast_confidence_score',
        80
      );
    });

    it('should filter by minimum rating (client-side)', async () => {
      const filters: ForecastHistoryFilters = { minRating: 4 };

      const result = await getUserForecastHistory('user-1', filters);

      // Should only include snapshots with rating >= 4
      expect(result).toHaveLength(2);
      expect(result.every((s) => (s.actual_conditions.rating ?? 0) >= 4)).toBe(
        true
      );
    });

    it('should apply multiple filters', async () => {
      const startDate = new Date('2024-11-01');
      const filters: ForecastHistoryFilters = {
        startDate,
        beachId: 'beach-1',
        dataSource: 'CDIP',
        minRating: 4,
      };

      await getUserForecastHistory('user-1', filters);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('session_date', '2024-11-01');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('beach_id', 'beach-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('data_source', 'CDIP');
    });

    it('should return empty array on error', async () => {
      mockQueryResult = { data: null, error: { message: 'Database error' } };

      const result = await getUserForecastHistory('user-1');

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('analyzePreferredConditions', () => {
    beforeEach(() => {
      mockQueryResult = {
        data: [mockSnapshot, mockSnapshot2, mockSnapshot3],
        error: null,
      };
    });

    it('should analyze preferred conditions from highly-rated sessions', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-1');
      expect(result?.totalSessions).toBe(3);
      expect(result?.highlyRatedSessions).toBe(2); // ratings 4 and 5
    });

    it('should calculate average wave height', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      // Average of 4.5 (rating 4) and 3.0 (rating 5)
      expect(result?.averageConditions.waveHeight).toBeCloseTo(3.75, 1);
    });

    it('should calculate average wave period', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.averageConditions.wavePeriod).toBe(12);
    });

    it('should calculate average wind speed', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.averageConditions.windSpeed).toBe(8);
    });

    it('should aggregate tide status counts', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.averageConditions.tideStatus).toEqual({ rising: 2 });
    });

    it('should identify preferred data source', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      // 1 CDIP, 1 NOAA_NWS - should pick first alphabetically or most common
      expect(result?.preferredDataSource).toBeTruthy();
    });

    it('should calculate average confidence', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.averageConfidence).toBe(85);
    });

    it('should rank beaches by frequency', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.beachFrequency).toHaveLength(2);
      expect(result?.beachFrequency[0].sessionCount ?? 0).toBeGreaterThanOrEqual(
        result?.beachFrequency[1].sessionCount ?? 0
      );
    });

    it('should calculate average rating per beach', async () => {
      const result = await analyzePreferredConditions('user-1', 4);

      const beach1 = result?.beachFrequency.find(
        (b) => b.beachId === 'beach-1'
      );
      expect(beach1?.averageRating).toBe(4);
    });

    it('should handle users with no highly-rated sessions', async () => {
      mockQueryResult = { data: [mockSnapshot3], error: null }; // Only rating 2

      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.highlyRatedSessions).toBe(0);
      expect(result?.averageConditions.waveHeight).toBeNull();
      expect(result?.beachFrequency).toEqual([]);
    });

    it('should return null on database error', async () => {
      mockQueryResult = { data: null, error: { message: 'Database error' } };

      const result = await analyzePreferredConditions('user-1');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should use custom minimum rating', async () => {
      const result = await analyzePreferredConditions('user-1', 5);

      expect(result?.highlyRatedSessions).toBe(1); // Only rating 5
    });

    it('should handle null values in forecast data', async () => {
      const snapshotWithNulls: SessionForecastSnapshot = {
        ...mockSnapshot,
        forecast_snapshot: {
          ...mockSnapshot.forecast_snapshot,
          wave_height: null,
          wave_period: null,
          wind_speed: null,
        },
      };
      mockQueryResult = { data: [snapshotWithNulls], error: null };

      const result = await analyzePreferredConditions('user-1', 4);

      expect(result?.averageConditions.waveHeight).toBeNull();
      expect(result?.averageConditions.wavePeriod).toBeNull();
      expect(result?.averageConditions.windSpeed).toBeNull();
    });
  });

  describe('getDataSourceDistribution', () => {
    it('should return distribution of data sources', async () => {
      mockQueryResult = {
        data: [
          { data_source: 'CDIP' },
          { data_source: 'CDIP' },
          { data_source: 'NOAA_NWS' },
          { data_source: null },
        ],
        error: null,
      };

      const result = await getDataSourceDistribution('user-1');

      expect(result).toEqual({
        CDIP: 2,
        NOAA_NWS: 1,
        UNKNOWN: 1,
      });
    });

    it('should return empty object on error', async () => {
      mockQueryResult = { data: null, error: { message: 'Database error' } };

      const result = await getDataSourceDistribution('user-1');

      expect(result).toEqual({});
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getMonthlyCoverage', () => {
    it('should return monthly session counts', async () => {
      mockQueryResult = {
        data: [
          { session_date: '2024-11-03' },
          { session_date: '2024-11-02' },
          { session_date: '2024-10-15' },
          { session_date: '2024-10-10' },
        ],
        error: null,
      };

      const result = await getMonthlyCoverage('user-1', 12);

      expect(result).toContainEqual({ month: '2024-11', count: 2 });
      expect(result).toContainEqual({ month: '2024-10', count: 2 });
    });

    it('should sort months in descending order', async () => {
      mockQueryResult = {
        data: [
          { session_date: '2024-10-15' },
          { session_date: '2024-11-03' },
        ],
        error: null,
      };

      const result = await getMonthlyCoverage('user-1', 12);

      expect(result[0].month).toBe('2024-11');
      expect(result[1].month).toBe('2024-10');
    });

    it('should filter by number of months', async () => {
      await getMonthlyCoverage('user-1', 6);

      expect(mockQueryBuilder.gte).toHaveBeenCalled();
      // Should filter to approximately 6 months ago
    });

    it('should return empty array on error', async () => {
      mockQueryResult = { data: null, error: { message: 'Database error' } };

      const result = await getMonthlyCoverage('user-1');

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
