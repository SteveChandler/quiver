/**
 * Unit tests for Forecast Batch Fetcher
 *
 * Tests the batchFetchForecasts function that fetches forecasts from cache
 * for multiple beaches with staleness tracking.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Mock beaches
const mockBeach1: Partial<Beach> = {
  id: 'beach-1',
  name: 'Beach One',
  slug: 'beach-one',
  lat: 32.7157,
  lon: -117.1611,
  city: 'San Diego',
  state: 'CA',
  is_private: false,
};

const mockBeach2: Partial<Beach> = {
  id: 'beach-2',
  name: 'Beach Two',
  slug: 'beach-two',
  lat: 32.8000,
  lon: -117.2000,
  city: 'La Jolla',
  state: 'CA',
  is_private: false,
};

const mockBeach3: Partial<Beach> = {
  id: 'beach-3',
  name: 'Beach Three',
  slug: 'beach-three',
  lat: 32.9000,
  lon: -117.2500,
  city: 'Del Mar',
  state: 'CA',
  is_private: false,
};

// Mock forecast data (using string types to match EnhancedForecastEntity)
const mockForecast: Partial<EnhancedForecastEntity> = {
  id: 'forecast-1',
  beach_id: 'beach-1',
  forecast_at: '2024-01-15T06:00Z',
  forecast_date: '2024-01-15',
  forecast_time: '06:00',
  wave_height: '3-5',
  wave_period: '12',
  swell_1_direction: '270',
  wind_speed: '5',
  wind_direction: 'NW',
  confidence_score: 0.85,
  data_source: 'NOAA_NWS',
  water_temp: '62',
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

// Mock return value that will be modified per test
let mockBatchResults = new Map<
  string,
  {
    beachId: string;
    forecasts: EnhancedForecastEntity[];
    metadata: {
      cached: boolean;
      stale: boolean;
      missing: boolean;
      reason: string | null;
    };
  }
>();

// Mock the forecast service utils
jest.mock('@/lib/utils/forecast-service-utils', () => ({
  getBatchFreshForecastsFromCache: jest.fn(() => Promise.resolve(mockBatchResults)),
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  createContextLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import after mocks are set up
import { batchFetchForecasts, DEFAULT_FORECAST_WINDOW_HOURS } from '@/lib/services/discovery/forecast-batch-fetcher';
import { getBatchFreshForecastsFromCache } from '@/lib/utils/forecast-service-utils';

describe('batchFetchForecasts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchResults = new Map();
  });

  describe('successful forecast fetching', () => {
    it('should return successful forecasts for beaches with fresh data', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: {
          cached: true,
          stale: false,
          missing: false,
          reason: null,
        },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].beach.id).toBe('beach-1');
      expect(result.successful[0].forecasts).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(result.staleCount).toBe(0);
    });

    it('should handle multiple beaches with fresh data', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: { cached: true, stale: false, missing: false, reason: null },
      });
      mockBatchResults.set('beach-2', {
        beachId: 'beach-2',
        forecasts: [{ ...mockForecast, id: 'forecast-2', beach_id: 'beach-2' } as EnhancedForecastEntity],
        metadata: { cached: true, stale: false, missing: false, reason: null },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach, mockBeach2 as Beach]);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.staleCount).toBe(0);
    });
  });

  describe('stale forecast handling', () => {
    it('should track stale forecasts separately', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: {
          cached: true,
          stale: true,
          missing: false,
          reason: 'Data is 3 hours old (threshold: 4 hours)',
        },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].stale).toBe(true);
      expect(result.failed[0].reason).toContain('3 hours old');
      expect(result.staleCount).toBe(1);
    });

    it('should count stale beaches correctly among mixed results', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: { cached: true, stale: false, missing: false, reason: null },
      });
      mockBatchResults.set('beach-2', {
        beachId: 'beach-2',
        forecasts: [],
        metadata: { cached: true, stale: true, missing: false, reason: 'Stale data' },
      });
      mockBatchResults.set('beach-3', {
        beachId: 'beach-3',
        forecasts: [],
        metadata: { cached: false, stale: false, missing: true, reason: 'No data found' },
      });

      const result = await batchFetchForecasts([
        mockBeach1 as Beach,
        mockBeach2 as Beach,
        mockBeach3 as Beach,
      ]);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(2);
      expect(result.staleCount).toBe(1);

      const staleBeach = result.failed.find((f) => f.stale);
      expect(staleBeach?.beach.id).toBe('beach-2');
    });
  });

  describe('missing/failed data handling', () => {
    it('should categorize missing data as failed (not stale)', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: {
          cached: false,
          stale: false,
          missing: true,
          reason: 'No forecast data exists for this beach',
        },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].stale).toBe(false);
      expect(result.failed[0].reason).toContain('No forecast data');
      expect(result.staleCount).toBe(0);
    });

    it('should handle beaches with no result from batch fetch', async () => {
      // Don't add beach-1 to mockBatchResults
      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('No result returned from batch fetch');
      expect(result.failed[0].stale).toBe(false);
    });

    it('should handle empty forecasts array as failed', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: { cached: true, stale: false, missing: false, reason: null },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('No forecasts available');
      expect(result.failed[0].stale).toBe(false);
    });
  });

  describe('options handling', () => {
    it('should use default forecast window hours', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: { cached: true, stale: false, missing: false, reason: null },
      });

      await batchFetchForecasts([mockBeach1 as Beach]);

      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(
        ['beach-1'],
        DEFAULT_FORECAST_WINDOW_HOURS,
        false
      );
    });

    it('should use custom forecast window hours when provided', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: { cached: true, stale: false, missing: false, reason: null },
      });

      await batchFetchForecasts([mockBeach1 as Beach], { forecastWindowHours: 24 });

      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(['beach-1'], 24, false);
    });
  });

  describe('empty input handling', () => {
    it('should handle empty beaches array', async () => {
      const result = await batchFetchForecasts([]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.staleCount).toBe(0);
      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith([], DEFAULT_FORECAST_WINDOW_HOURS, false);
    });
  });

  describe('default reason handling', () => {
    it('should use default reason for missing data when none provided', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: {
          cached: false,
          stale: false,
          missing: true,
          reason: null,
        },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.failed[0].reason).toBe('Missing data');
    });

    it('should use default reason for stale data when none provided', async () => {
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: {
          cached: true,
          stale: true,
          missing: false,
          reason: null,
        },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach]);

      expect(result.failed[0].reason).toBe('Stale data');
    });
  });

  describe('allowStale option', () => {
    it('should categorize all stale beaches as failed when allowStale is false', async () => {
      // All beaches return stale: true, forecasts: []
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });
      mockBatchResults.set('beach-2', {
        beachId: 'beach-2',
        forecasts: [],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });
      mockBatchResults.set('beach-3', {
        beachId: 'beach-3',
        forecasts: [],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });

      const result = await batchFetchForecasts([
        mockBeach1 as Beach,
        mockBeach2 as Beach,
        mockBeach3 as Beach,
      ]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(3);
      expect(result.staleCount).toBe(3);

      // Verify all failed entries are marked as stale
      expect(result.failed.every(f => f.stale === true)).toBe(true);
    });

    it('should categorize stale beaches with data as successful when allowStale is true', async () => {
      // All beaches return stale: true, but WITH forecasts
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });
      mockBatchResults.set('beach-2', {
        beachId: 'beach-2',
        forecasts: [{ ...mockForecast, id: 'forecast-2', beach_id: 'beach-2' } as EnhancedForecastEntity],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });
      mockBatchResults.set('beach-3', {
        beachId: 'beach-3',
        forecasts: [{ ...mockForecast, id: 'forecast-3', beach_id: 'beach-3' } as EnhancedForecastEntity],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });

      const result = await batchFetchForecasts(
        [mockBeach1 as Beach, mockBeach2 as Beach, mockBeach3 as Beach],
        { allowStale: true }
      );

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.staleCount).toBe(3);

      // Verify getBatchFreshForecastsFromCache was called with allowStale=true
      expect(getBatchFreshForecastsFromCache).toHaveBeenCalledWith(
        ['beach-1', 'beach-2', 'beach-3'],
        DEFAULT_FORECAST_WINDOW_HOURS,
        true
      );

      // Verify successful entries have forecasts
      expect(result.successful.every(s => s.forecasts.length > 0)).toBe(true);
    });

    it('should still fail stale beaches with no forecast rows even when allowStale is true', async () => {
      // Stale beach but no forecast data
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });

      const result = await batchFetchForecasts([mockBeach1 as Beach], { allowStale: true });

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].stale).toBe(true);
      expect(result.staleCount).toBe(1);
    });

    it('should handle mixed results with allowStale: some stale with data, some without, some missing', async () => {
      // Beach 1: stale with data
      mockBatchResults.set('beach-1', {
        beachId: 'beach-1',
        forecasts: [mockForecast as EnhancedForecastEntity],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });

      // Beach 2: stale without data
      mockBatchResults.set('beach-2', {
        beachId: 'beach-2',
        forecasts: [],
        metadata: { cached: true, stale: true, missing: false, reason: 'Data is 3 hours old' },
      });

      // Beach 3: missing (not stale)
      mockBatchResults.set('beach-3', {
        beachId: 'beach-3',
        forecasts: [],
        metadata: { cached: false, stale: false, missing: true, reason: 'No data found' },
      });

      const result = await batchFetchForecasts(
        [mockBeach1 as Beach, mockBeach2 as Beach, mockBeach3 as Beach],
        { allowStale: true }
      );

      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].beach.id).toBe('beach-1');

      expect(result.failed).toHaveLength(2);
      expect(result.staleCount).toBe(2); // Beach 1 and 2 are stale

      // Verify the stale counts are correct
      const staleFailures = result.failed.filter(f => f.stale);
      expect(staleFailures).toHaveLength(1); // Only beach-2 (stale without data)
      expect(staleFailures[0].beach.id).toBe('beach-2');

      const missingFailures = result.failed.filter(f => !f.stale);
      expect(missingFailures).toHaveLength(1); // Beach-3 (missing)
      expect(missingFailures[0].beach.id).toBe('beach-3');
    });
  });
});
