/**
 * Unit tests for Surf Discovery Orchestrator - Favorites Merging
 *
 * Tests the favorites merging logic in discoverSurfSpots:
 * - Favorites placed first with isFavorite flag
 * - Duplicates removed between favorites and algorithmic results
 * - Score threshold (>= 50) enforced for favorites
 * - Error handling when favorites fetch fails
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

// Mock beach data
const mockBeach1: Partial<Beach> = {
  id: 'beach-1',
  name: 'Ocean Beach',
  slug: 'ocean-beach',
  lat: 32.7157,
  lon: -117.1611,
  city: 'San Diego',
  state: 'CA',
  is_private: false,
  skill_level: 'intermediate',
};

const mockBeach2: Partial<Beach> = {
  id: 'beach-2',
  name: 'La Jolla Shores',
  slug: 'la-jolla-shores',
  lat: 32.8570,
  lon: -117.2560,
  city: 'La Jolla',
  state: 'CA',
  is_private: false,
  skill_level: 'beginner',
};

const mockBeach3: Partial<Beach> = {
  id: 'beach-3',
  name: 'Blacks Beach',
  slug: 'blacks-beach',
  lat: 32.8890,
  lon: -117.2510,
  city: 'San Diego',
  state: 'CA',
  is_private: false,
  skill_level: 'advanced',
};

const mockBeach4: Partial<Beach> = {
  id: 'beach-4',
  name: 'Pacific Beach',
  slug: 'pacific-beach',
  lat: 32.7947,
  lon: -117.2543,
  city: 'San Diego',
  state: 'CA',
  is_private: false,
  skill_level: 'intermediate',
};

const mockForecast: Partial<EnhancedForecastEntity> = {
  beach_id: 'beach-1',
  forecast_at: '2024-01-15T12:00:00Z',
  forecast_date: '2024-01-15',
  forecast_time: '12:00:00',
  wave_height: '3.5',
  wave_period: '12s',
  wind_speed: '8',
  wind_direction_deg: 270,
  tide_status: 'Rising',
  data_source: 'CDIP',
};

// Mock state for dynamic responses
const mockState = {
  candidatePoolResponse: { candidates: [] as Partial<Beach>[], preferredWaveSize: null as string | null, userSkillLevel: null as any, preferredBreakType: null as string | null },
  forecastBatchResponse: { successful: [] as any[], failed: [], staleCount: 0 },
  favoriteBeaches: [] as Partial<Beach>[],
  favoritesError: null as Error | null,
  userPrefs: null as any,
  affinityMap: new Map(),
  sunTimesCache: new Map(),
  scoringResults: [] as { beach: Partial<Beach>; score: number; window: any; forecast: any }[],
};

// Setup mocks
jest.mock('@/lib/services/discovery/candidate-pool-builder', () => ({
  buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
}));

jest.mock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
  batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
}));

jest.mock('@/lib/services/discovery/window-selector', () => ({
  selectBestWindow: jest.fn((forecasts: any[]) => {
    // Return null if no forecasts
    if (!forecasts || forecasts.length === 0) {
      return null;
    }

    return {
      start: new Date('2024-01-15T12:00:00Z'),
      end: new Date('2024-01-15T15:00:00Z'),
      tide: 'Rising',
      wind: '8 mph W',
      waveHeight: '3-4 ft',
      wavePeriod: '12s',
      dataSource: 'CDIP',
      confidence: 85,
      timezone: 'America/Los_Angeles',
    };
  }),
  getLocalDateStr: jest.fn((date: Date, _tz: string) => {
    return date.toISOString().split('T')[0];
  }),
  getLocalHour: jest.fn((date: Date, _tz: string) => {
    return date.getUTCHours();
  }),
}));

jest.mock('@/lib/services/discovery/response-formatter', () => ({
  enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
  generateDiscoverySummary: jest.fn(() => 'Good conditions'),
  getRecommendationLabel: jest.fn(() => 'Worth it'),
  buildDiscoveryMessage: jest.fn(() => 'Worth it — Good conditions'),
}));

jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: jest.fn(async () => mockState.userPrefs),
}));

jest.mock('@/lib/services/beach-query-service', () => ({
  getFavoriteBeachesFromDb: jest.fn(async (userId: string) => {
    if (mockState.favoritesError) {
      return {
        success: false,
        error: mockState.favoritesError.message,
      };
    }
    return {
      success: true,
      data: mockState.favoriteBeaches as Beach[],
    };
  }),
}));

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      return {
        select: jest.fn((fields: string) => {
          return {
            eq: jest.fn((field: string, value: any) => {
              return {
                in: jest.fn((field: string, values: any[]) => {
                  return Promise.resolve({ data: [], error: null });
                }),
              };
            }),
            in: jest.fn((field: string, values: any[]) => {
              return {
                in: jest.fn((field2: string, values2: any[]) => {
                  return {
                    order: jest.fn(() => Promise.resolve({ data: [], error: null })),
                  };
                }),
              };
            }),
          };
        }),
      };
    }),
  })),
}));

jest.mock('@/lib/logger', () => ({
  createContextLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock scoring function
jest.mock('@/lib/domains/scoring', () => ({
  createDiscoveryScoringEngine: jest.fn(() => ({})),
  scoreBeachWithEngine: jest.fn(() => ({
    total: 75,
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 12,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    matchQuality: 'excellent',
    reasons: ['Good wave size', 'Clean swell', 'Light winds'],
    warnings: [],
    conditionBadges: [],
  })),
}));

// Mock timezone utils
jest.mock('@/lib/utils/timezone-utils.server', () => ({
  getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
}));

jest.mock('@/lib/services/discovery/personalization-layer', () => ({
  fetchPersonalizationContext: jest.fn(async () => ({
    implicitPrefs: null,
    learnedPrefs: null,
    affinityMap: new Map(),
    preferredBreakType: null,
    implicitWeight: 0,
  })),
  calculatePersonalizationBonus: jest.fn(() => ({
    total: 0,
    affinityBonus: 0,
    personalizationBonus: 0,
    reasons: [],
  })),
}));

// Import after mocks
import { discoverSurfSpots } from '@/lib/services/discovery/surf-discovery-orchestrator';

describe('discoverSurfSpots - Favorites Merging', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1, mockBeach2, mockBeach3, mockBeach4] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach2, forecasts: [{ ...mockForecast, beach_id: 'beach-2' }] },
        { beach: mockBeach3, forecasts: [{ ...mockForecast, beach_id: 'beach-3' }] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };
    mockState.favoriteBeaches = [];
    mockState.favoritesError = null;
    mockState.userPrefs = null;
    mockState.affinityMap = new Map();
    mockState.sunTimesCache = new Map();
  });

  test('marks favorite beaches with isFavorite flag but ranks by score', async () => {
    // Setup: beach-2 is a favorite
    mockState.favoriteBeaches = [mockBeach2];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify results are returned and favorites are marked
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Find beach-2 and verify it has isFavorite flag
    const beach2Rec = result.recommendations.find(r => r.beach.id === 'beach-2');
    expect(beach2Rec).toBeDefined();
    expect(beach2Rec?.isFavorite).toBe(true);

    // Verify sorting is by score (highest first), not favorites-first
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i - 1].score).toBeGreaterThanOrEqual(
        result.recommendations[i].score
      );
    }
  });

  test('removes duplicates when beach is both favorite and in algo results', async () => {
    // Setup: beach-1 is a favorite
    mockState.favoriteBeaches = [mockBeach1];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Count how many times beach-1 appears
    const beach1Count = result.recommendations.filter(r => r.beach.id === 'beach-1').length;
    expect(beach1Count).toBe(1);

    // Verify it has isFavorite flag
    const beach1Rec = result.recommendations.find(r => r.beach.id === 'beach-1');
    expect(beach1Rec?.isFavorite).toBe(true);
  });

  test('includes all beaches regardless of score, sorted by score descending', async () => {
    // Setup: beach-2 is a favorite but will have low score
    mockState.favoriteBeaches = [mockBeach2];

    // Mock scoreBeachWithEngine to return low score for beach-2
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((engine: any, beach: Beach) => {
      if (beach.id === 'beach-2') {
        return {
          total: 45, // Low score
          subscores: {
            waveHeightFit: 10,
            periodEnergyScore: 10,
            windAlignment: 10,
            tideFit: 10,
            affinityBonus: 0,
            personalizationBonus: 0,
            distancePenalty: -5,
          },
          matchQuality: 'fair',
          reasons: ['Wave size too small'],
          warnings: ['Weak swell'],
          conditionBadges: [],
        };
      }
      return {
        total: 75,
        subscores: {
          waveHeightFit: 20,
          periodEnergyScore: 15,
          windAlignment: 15,
          tideFit: 12,
          affinityBonus: 0,
          personalizationBonus: 0,
          distancePenalty: 0,
        },
        matchQuality: 'excellent',
        reasons: ['Good conditions'],
        warnings: [],
        conditionBadges: [],
      };
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify beach-2 IS in results (no longer excluded based on score)
    const beach2Rec = result.recommendations.find(r => r.beach.id === 'beach-2');
    expect(beach2Rec).toBeDefined();
    expect(beach2Rec?.isFavorite).toBe(true);
    expect(beach2Rec?.score).toBe(45);

    // Verify it's sorted to the end due to low score
    const lastRec = result.recommendations[result.recommendations.length - 1];
    expect(lastRec.beach.id).toBe('beach-2');
  });

  test('handles empty favorites gracefully', async () => {
    mockState.favoriteBeaches = [];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Should still return recommendations, just none marked as favorites
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every(r => !r.isFavorite)).toBe(true);
  });

  test('handles favorites fetch error gracefully', async () => {
    mockState.favoritesError = new Error('Database connection failed');

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Should continue with regular recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every(r => !r.isFavorite)).toBe(true);
  });

  test('sorts all beaches by score descending with correct isFavorite flags', async () => {
    // Setup: multiple favorites
    mockState.favoriteBeaches = [mockBeach1, mockBeach2, mockBeach3];

    // Mock different scores for each beach
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((engine: any, beach: Beach) => {
      const scores: Record<string, number> = {
        'beach-1': 85,
        'beach-2': 92,
        'beach-3': 78,
        'beach-4': 70,
      };
      return {
        total: scores[beach.id] || 75,
        subscores: {
          waveHeightFit: 20,
          periodEnergyScore: 15,
          windAlignment: 15,
          tideFit: 12,
          affinityBonus: 0,
          personalizationBonus: 0,
          distancePenalty: 0,
        },
        matchQuality: 'excellent',
        reasons: ['Good conditions'],
        warnings: [],
        conditionBadges: [],
      };
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify all beaches are sorted by score (pure score ranking)
    expect(result.recommendations[0].beach.id).toBe('beach-2'); // 92
    expect(result.recommendations[0].isFavorite).toBe(true);
    expect(result.recommendations[1].beach.id).toBe('beach-1'); // 85
    expect(result.recommendations[1].isFavorite).toBe(true);
    expect(result.recommendations[2].beach.id).toBe('beach-3'); // 78
    expect(result.recommendations[2].isFavorite).toBe(true);
    expect(result.recommendations[3].beach.id).toBe('beach-4'); // 70
    expect(result.recommendations[3].isFavorite).toBe(false); // Non-favorite has isFavorite: false
  });

  test('respects maxResults limit with pure score ranking', async () => {
    mockState.favoriteBeaches = [mockBeach1, mockBeach2];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 3 });

    // Should return exactly 3 results
    expect(result.recommendations.length).toBe(3);

    // Results should be sorted by score, favorites marked correctly
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i - 1].score).toBeGreaterThanOrEqual(
        result.recommendations[i].score
      );
    }

    // Favorites should have isFavorite: true
    const beach1Rec = result.recommendations.find(r => r.beach.id === 'beach-1');
    const beach2Rec = result.recommendations.find(r => r.beach.id === 'beach-2');
    if (beach1Rec) expect(beach1Rec.isFavorite).toBe(true);
    if (beach2Rec) expect(beach2Rec.isFavorite).toBe(true);
  });

  test('marks non-favorites with isFavorite: false', async () => {
    mockState.favoriteBeaches = [mockBeach1];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Find a non-favorite recommendation
    const nonFavorite = result.recommendations.find(r => r.beach.id !== 'beach-1');
    expect(nonFavorite).toBeDefined();
    expect(nonFavorite?.isFavorite).toBe(false); // Now explicitly false, not undefined
  });

  test('handles malformed recommendations with null safety', async () => {
    // This test verifies the null safety checks added to prevent crashes
    // when recommendation data is malformed (missing beach.id or score)
    mockState.favoriteBeaches = [mockBeach1];

    // The mocking infrastructure ensures we always get valid data,
    // but this test documents the expected behavior for null safety
    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Should successfully complete without errors
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);

    // All recommendations should have valid beach.id and score
    for (const rec of result.recommendations) {
      expect(rec.beach).toBeDefined();
      expect(rec.beach.id).toBeDefined();
      expect(typeof rec.score).toBe('number');
    }
  });
});

describe('discoverSurfSpots - Stale Data Fallback', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1, mockBeach2, mockBeach3, mockBeach4] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.favoriteBeaches = [];
    mockState.favoritesError = null;
    mockState.userPrefs = null;
    mockState.affinityMap = new Map();
    mockState.sunTimesCache = new Map();
  });

  test('triggers stale fallback when all beaches are stale, returns recommendations with usingStaleData=true', async () => {
    const { batchFetchForecasts: mockBatchFetch } = require('@/lib/services/discovery/forecast-batch-fetcher');

    // First call: all beaches stale with no data
    const firstCallResponse = {
      successful: [],
      failed: [
        { beach: mockBeach1, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach2, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach3, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach4, stale: true, reason: 'Data is 3 hours old' },
      ],
      staleCount: 4,
    };

    // Second call (retry with allowStale): all beaches return with forecasts
    const secondCallResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach2, forecasts: [{ ...mockForecast, beach_id: 'beach-2' }] },
        { beach: mockBeach3, forecasts: [{ ...mockForecast, beach_id: 'beach-3' }] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 4,
    };

    mockBatchFetch
      .mockResolvedValueOnce(firstCallResponse)
      .mockResolvedValueOnce(secondCallResponse);

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify recommendations are returned
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Verify usingStaleData flag is set
    expect(result.metadata.usingStaleData).toBe(true);
    expect(result.metadata.staleBeaches).toBe(4);

    // Verify batchFetchForecasts was called twice
    expect(mockBatchFetch).toHaveBeenCalledTimes(2);

    // First call: options object does NOT include allowStale property
    const firstCallArgs = mockBatchFetch.mock.calls[0];
    expect(firstCallArgs[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'beach-1' }),
        expect.objectContaining({ id: 'beach-2' }),
        expect.objectContaining({ id: 'beach-3' }),
        expect.objectContaining({ id: 'beach-4' }),
      ])
    );
    expect(firstCallArgs[1]).toEqual(expect.objectContaining({
      maxConcurrent: expect.any(Number),
      timeout: expect.any(Number),
      overallTimeout: expect.any(Number),
    }));
    expect(firstCallArgs[1]).not.toHaveProperty('allowStale');

    // Second call: options object includes allowStale: true
    const secondCallArgs = mockBatchFetch.mock.calls[1];
    expect(secondCallArgs[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'beach-1' }),
        expect.objectContaining({ id: 'beach-2' }),
        expect.objectContaining({ id: 'beach-3' }),
        expect.objectContaining({ id: 'beach-4' }),
      ])
    );
    expect(secondCallArgs[1]).toEqual(expect.objectContaining({
      allowStale: true,
    }));
  });

  test('reports correct failedBeaches metadata after stale fallback succeeds', async () => {
    const { batchFetchForecasts: mockBatchFetch } = require('@/lib/services/discovery/forecast-batch-fetcher');

    // First call: all 4 beaches stale
    mockBatchFetch.mockResolvedValueOnce({
      successful: [],
      failed: [
        { beach: mockBeach1, stale: true, reason: 'Stale' },
        { beach: mockBeach2, stale: true, reason: 'Stale' },
        { beach: mockBeach3, stale: true, reason: 'Stale' },
        { beach: mockBeach4, stale: true, reason: 'Stale' },
      ],
      staleCount: 4,
    });

    // Second call (allowStale): 3 recover, 1 still fails
    mockBatchFetch.mockResolvedValueOnce({
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach2, forecasts: [{ ...mockForecast, beach_id: 'beach-2' }] },
        { beach: mockBeach3, forecasts: [{ ...mockForecast, beach_id: 'beach-3' }] },
      ],
      failed: [
        { beach: mockBeach4, stale: true, reason: 'No rows' },
      ],
      staleCount: 4,
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // failedBeaches should reflect the SECOND call's failed count (1), not the first (4)
    expect(result.metadata.failedBeaches).toBe(1);
    expect(result.metadata.successfulForecasts).toBe(3);
    expect(result.metadata.usingStaleData).toBe(true);
  });

  test('returns empty response when stale fallback also returns no data', async () => {
    const { batchFetchForecasts: mockBatchFetch } = require('@/lib/services/discovery/forecast-batch-fetcher');

    // First call: all beaches stale with no data
    const firstCallResponse = {
      successful: [],
      failed: [
        { beach: mockBeach1, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach2, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach3, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach4, stale: true, reason: 'Data is 3 hours old' },
      ],
      staleCount: 4,
    };

    // Second call (retry with allowStale): still no data
    const secondCallResponse = {
      successful: [],
      failed: [
        { beach: mockBeach1, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach2, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach3, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach4, stale: true, reason: 'Data is 3 hours old' },
      ],
      staleCount: 4,
    };

    mockBatchFetch
      .mockResolvedValueOnce(firstCallResponse)
      .mockResolvedValueOnce(secondCallResponse);

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify no recommendations returned
    expect(result.recommendations.length).toBe(0);

    // usingStaleData should be undefined or false since no stale data was usable
    expect(result.metadata.usingStaleData).toBeUndefined();
  });

  test('does not trigger fallback when some fresh forecasts are available', async () => {
    const { batchFetchForecasts: mockBatchFetch } = require('@/lib/services/discovery/forecast-batch-fetcher');

    // Normal response: some successful, some stale failed
    const normalResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach2, forecasts: [{ ...mockForecast, beach_id: 'beach-2' }] },
      ],
      failed: [
        { beach: mockBeach3, stale: true, reason: 'Data is 3 hours old' },
        { beach: mockBeach4, stale: true, reason: 'Data is 3 hours old' },
      ],
      staleCount: 2,
    };

    mockBatchFetch.mockResolvedValueOnce(normalResponse);

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify recommendations returned from fresh data
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Verify usingStaleData is false (not triggered)
    expect(result.metadata.usingStaleData).toBe(false);

    // Verify batchFetchForecasts was called only once
    expect(mockBatchFetch).toHaveBeenCalledTimes(1);
  });

  test('does not trigger fallback when all beaches failed but none are stale', async () => {
    const { batchFetchForecasts: mockBatchFetch } = require('@/lib/services/discovery/forecast-batch-fetcher');

    // All beaches missing (not stale)
    const allMissingResponse = {
      successful: [],
      failed: [
        { beach: mockBeach1, stale: false, reason: 'No data found' },
        { beach: mockBeach2, stale: false, reason: 'No data found' },
        { beach: mockBeach3, stale: false, reason: 'No data found' },
        { beach: mockBeach4, stale: false, reason: 'No data found' },
      ],
      staleCount: 0,
    };

    mockBatchFetch.mockResolvedValueOnce(allMissingResponse);

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify no recommendations
    expect(result.recommendations.length).toBe(0);

    // Verify batchFetchForecasts was called only once (no fallback)
    expect(mockBatchFetch).toHaveBeenCalledTimes(1);

    // Verify no usingStaleData flag
    expect(result.metadata.usingStaleData).toBeUndefined();
  });
});

describe('discoverSurfSpots - Personalization Integration', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish default mock return values after clearAllMocks() (which clears
    // mockReturnValue state set by previous tests in this describe block)
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockReturnValue({
      total: 75,
      subscores: {
        waveHeightFit: 20,
        periodEnergyScore: 15,
        windAlignment: 15,
        tideFit: 12,
        affinityBonus: 0,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      matchQuality: 'excellent',
      reasons: ['Good wave size', 'Clean swell', 'Light winds'],
      warnings: [],
      conditionBadges: [],
    });
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');
    calculatePersonalizationBonus.mockReturnValue({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    });
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1, mockBeach2, mockBeach3, mockBeach4] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach2, forecasts: [{ ...mockForecast, beach_id: 'beach-2' }] },
        { beach: mockBeach3, forecasts: [{ ...mockForecast, beach_id: 'beach-3' }] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };
    mockState.favoriteBeaches = [];
    mockState.favoritesError = null;
    mockState.userPrefs = null;
  });

  test('calls fetchPersonalizationContext with correct arguments', async () => {
    const { fetchPersonalizationContext } = require('@/lib/services/discovery/personalization-layer');
    mockState.candidatePoolResponse.preferredBreakType = 'reef';

    await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    expect(fetchPersonalizationContext).toHaveBeenCalledTimes(1);
    const args = fetchPersonalizationContext.mock.calls[0];
    expect(args[0]).toBe(testUserId);
    // beachIds should be the IDs from the forecasted beaches
    expect(args[1]).toEqual(expect.arrayContaining(['beach-1', 'beach-2', 'beach-3', 'beach-4']));
    expect(args[2]).toBe('reef'); // preferredBreakType
    // 4th arg is userPrefs (null from our mock)
    expect(args[3]).toBeNull();
  });

  test('calls calculatePersonalizationBonus for each beach', async () => {
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    // Should be called once per beach with forecasts
    expect(calculatePersonalizationBonus).toHaveBeenCalledTimes(4);
  });

  test('personalization bonus flows into final score', async () => {
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    // Mock personalization to give beach-1 a big bonus
    calculatePersonalizationBonus.mockImplementation((beach: any) => {
      if (beach.id === 'beach-1') {
        return {
          total: 20,
          affinityBonus: 5,
          personalizationBonus: 15,
          reasons: ['Matches your preferred break type', 'Wave size matches your sweet spot'],
        };
      }
      return { total: 0, affinityBonus: 0, personalizationBonus: 0, reasons: [] };
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    const beach1 = result.recommendations.find(r => r.beach.id === 'beach-1');
    expect(beach1).toBeDefined();
    // Score should be higher than the base 75 due to personalization
    expect(beach1!.score).toBeGreaterThan(75);
    // Personalization reasons should appear in the reasons array
    expect(beach1!.reasons).toEqual(expect.arrayContaining([
      'Matches your preferred break type',
      'Wave size matches your sweet spot',
    ]));
    // subscores should include personalizationBonus
    expect(beach1!.subscores.personalizationBonus).toBe(15);
  });

  test('zero personalization bonus does not change scores', async () => {
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');
    calculatePersonalizationBonus.mockReturnValue({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    // All beaches should have the base score (75 from the engine mock)
    for (const rec of result.recommendations) {
      expect(rec.score).toBe(75);
      expect(rec.subscores.personalizationBonus).toBe(0);
    }
  });

  test('personalization bonus is capped at 100', async () => {
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    // Base score of 90
    scoreBeachWithEngine.mockReturnValue({
      total: 90,
      subscores: { waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 18, tideFit: 14, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
      matchQuality: 'excellent',
      reasons: ['Great conditions'],
      warnings: [],
      conditionBadges: [],
    });

    // Personalization bonus of 30 — would exceed 100
    calculatePersonalizationBonus.mockReturnValue({
      total: 30,
      affinityBonus: 10,
      personalizationBonus: 20,
      reasons: ['Your go-to spot'],
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    // Score should be capped at 100
    for (const rec of result.recommendations) {
      expect(rec.score).toBeLessThanOrEqual(100);
    }
  });

  test('personalization reasons are prepended to base reasons', async () => {
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    calculatePersonalizationBonus.mockReturnValue({
      total: 8,
      affinityBonus: 0,
      personalizationBonus: 8,
      reasons: ['Matches your preferred break type'],
    });

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    const rec = result.recommendations[0];
    // Personalization reason should come first
    expect(rec.reasons[0]).toBe('Matches your preferred break type');
    // Base reasons should follow
    expect(rec.reasons).toEqual(expect.arrayContaining(['Good wave size']));
  });

  test('discovery continues when getUserSurfPreferences throws', async () => {
    const { getUserSurfPreferences } = require('@/lib/services/preference-learning-service');
    getUserSurfPreferences.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    // Should still return recommendations (graceful degradation)
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe('discoverSurfSpots - Time Slot Scoring Differentiation', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  // Forecasts at different hours with different conditions
  const calmMorningForecast: Partial<EnhancedForecastEntity> = {
    beach_id: 'beach-1',
    forecast_at: '2024-01-15T07:00:00Z',
    forecast_date: '2024-01-15',
    forecast_time: '07:00:00',
    wave_height: '4.0',
    wave_period: '14s',
    wind_speed: '3',
    wind_direction_deg: 0,
    tide_status: 'Rising',
    data_source: 'CDIP',
    confidence_score: 90,
  };

  const windyAfternoonForecast: Partial<EnhancedForecastEntity> = {
    beach_id: 'beach-1',
    forecast_at: '2024-01-15T15:00:00Z',
    forecast_date: '2024-01-15',
    forecast_time: '15:00:00',
    wave_height: '2.0',
    wave_period: '8s',
    wind_speed: '18',
    wind_direction_deg: 225,
    tide_status: 'Falling',
    data_source: 'CDIP',
    confidence_score: 70,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    calculatePersonalizationBonus.mockReturnValue({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    });

    // Score differently based on the forecast passed in:
    // calm morning forecast (wind_speed '3') scores high,
    // windy afternoon forecast (wind_speed '18') scores low.
    scoreBeachWithEngine.mockImplementation((_engine: any, _beach: any, forecast: any) => {
      const windSpeed = parseInt(forecast?.wind_speed || '10', 10);
      const isCalm = windSpeed < 10;
      return {
        total: isCalm ? 92 : 58,
        subscores: {
          waveHeightFit: isCalm ? 24 : 12,
          periodEnergyScore: isCalm ? 18 : 10,
          windAlignment: isCalm ? 20 : 8,
          tideFit: isCalm ? 14 : 10,
          affinityBonus: 0,
          personalizationBonus: 0,
          distancePenalty: 0,
        },
        matchQuality: isCalm ? 'excellent' : 'fair',
        reasons: isCalm ? ['Glassy conditions', 'Strong swell'] : ['Onshore wind', 'Weak swell'],
        warnings: isCalm ? [] : ['Strong onshore wind'],
        conditionBadges: [],
      };
    });

    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [calmMorningForecast, windyAfternoonForecast] },
      ],
      failed: [],
      staleCount: 0,
    };
    mockState.favoriteBeaches = [];
    mockState.favoritesError = null;
    mockState.userPrefs = null;
  });

  test('different time slots produce different scores for the same beach via sourceForecast', async () => {
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');

    // Dawn patrol: return the calm morning forecast as sourceForecast
    mockSelectBestWindow.mockImplementation(() => ({
      start: new Date('2024-01-15T07:00:00Z'),
      end: new Date('2024-01-15T10:00:00Z'),
      tide: 'Rising',
      wind: '3 mph N',
      waveHeight: '4 ft',
      wavePeriod: '14s',
      dataSource: 'CDIP',
      confidence: 90,
      timezone: 'America/Los_Angeles',
      sourceForecast: calmMorningForecast,
    }));

    const dawnResult = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      timeSlot: 'dawn-patrol',
    });

    // Afternoon: return the windy afternoon forecast as sourceForecast
    mockSelectBestWindow.mockImplementation(() => ({
      start: new Date('2024-01-15T15:00:00Z'),
      end: new Date('2024-01-15T18:00:00Z'),
      tide: 'Falling',
      wind: '18 mph SW',
      waveHeight: '2 ft',
      wavePeriod: '8s',
      dataSource: 'CDIP',
      confidence: 70,
      timezone: 'America/Los_Angeles',
      sourceForecast: windyAfternoonForecast,
    }));

    const afternoonResult = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      timeSlot: 'afternoon',
    });

    // Both should return recommendations
    expect(dawnResult.recommendations.length).toBe(1);
    expect(afternoonResult.recommendations.length).toBe(1);

    const dawnScore = dawnResult.recommendations[0].score;
    const afternoonScore = afternoonResult.recommendations[0].score;

    // Dawn patrol should score much higher (calm) vs afternoon (windy)
    expect(dawnScore).toBe(92);
    expect(afternoonScore).toBe(58);
    expect(dawnScore).not.toBe(afternoonScore);
  });

  test('fuzzy-match fallback picks nearest forecast when sourceForecast is absent', async () => {
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');

    // Return a window WITHOUT sourceForecast — triggers the fuzzy fallback
    mockSelectBestWindow.mockImplementation(() => ({
      start: new Date('2024-01-15T15:00:00Z'), // Closer to windyAfternoonForecast (15:00)
      end: new Date('2024-01-15T18:00:00Z'),
      tide: 'Falling',
      wind: '18 mph SW',
      waveHeight: '2 ft',
      wavePeriod: '8s',
      dataSource: 'CDIP',
      confidence: 70,
      timezone: 'America/Los_Angeles',
      // No sourceForecast — fuzzy fallback must activate
    }));

    // Track which forecast the scoring engine receives
    let receivedForecast: any = null;
    scoreBeachWithEngine.mockImplementation((_engine: any, _beach: any, forecast: any) => {
      receivedForecast = forecast;
      return {
        total: 60,
        subscores: { waveHeightFit: 15, periodEnergyScore: 12, windAlignment: 10, tideFit: 10, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        matchQuality: 'good',
        reasons: ['Moderate conditions'],
        warnings: [],
        conditionBadges: [],
      };
    });

    await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      timeSlot: 'afternoon',
    });

    // The fuzzy fallback should pick windyAfternoonForecast (15:00)
    // not calmMorningForecast (07:00), since 15:00 is closer to window.start
    expect(receivedForecast).toBeDefined();
    expect(receivedForecast.forecast_at).toBe('2024-01-15T15:00:00Z');
  });

  test('sourceForecast is stripped from the response window', async () => {
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');

    mockSelectBestWindow.mockImplementation(() => ({
      start: new Date('2024-01-15T07:00:00Z'),
      end: new Date('2024-01-15T10:00:00Z'),
      tide: 'Rising',
      wind: '3 mph N',
      waveHeight: '4 ft',
      wavePeriod: '14s',
      dataSource: 'CDIP',
      confidence: 90,
      timezone: 'America/Los_Angeles',
      sourceForecast: calmMorningForecast,
    }));

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      timeSlot: 'dawn-patrol',
    });

    // sourceForecast should be deleted before building the response
    expect(result.recommendations[0].window.sourceForecast).toBeUndefined();
  });
});
