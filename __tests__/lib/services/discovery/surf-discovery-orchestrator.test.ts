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
  includedBeachRows: [] as Partial<Beach>[],
  customSpots: [] as any[],
  favoritesError: null as Error | null,
  boards: [] as Array<{
    id: string;
    name: string;
    board_type: string;
    volume?: number | null;
    session_count?: number | null;
    updated_at?: string | null;
    created_at?: string | null;
  }>,
  boardsError: null as { message: string } | null,
  userPrefs: null as any,
  affinityMap: new Map(),
  sessionRows: [] as any[],
  sunTimesCache: new Map(),
  scoringResults: [] as { beach: Partial<Beach>; score: number; window: any; forecast: any }[],
  waterQualityProbeError: null as { code?: string; message: string } | null,
};

const mockSupabaseRpc = jest.fn(async () => ({
  data: [
    {
      slot_idx: 0,
      forecast_at: mockForecast.forecast_at,
      result: { state: 'onboarding', session_count: 0, sessions_needed: 5 },
    },
  ],
  error: null,
}));

function makeCustomSpotsQuery() {
  const filters: Array<{ op: 'eq' | 'is' | 'neq' | 'gte' | 'lte'; column: string; value: unknown }> = [];
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn((column: string, value: unknown) => {
      filters.push({ op: 'eq', column, value });
      return query;
    }),
    is: jest.fn((column: string, value: unknown) => {
      filters.push({ op: 'is', column, value });
      return query;
    }),
    neq: jest.fn((column: string, value: unknown) => {
      filters.push({ op: 'neq', column, value });
      return query;
    }),
    gte: jest.fn((column: string, value: unknown) => {
      filters.push({ op: 'gte', column, value });
      return query;
    }),
    lte: jest.fn((column: string, value: unknown) => {
      filters.push({ op: 'lte', column, value });
      return query;
    }),
    then: (resolve: (value: { data: any[]; error: null }) => void) => {
      const rows = mockState.customSpots.filter((row) =>
        filters.every((filter) => {
          const value = row[filter.column];
          switch (filter.op) {
            case 'eq':
              return value === filter.value;
            case 'is':
              return value === filter.value;
            case 'neq':
              return value !== filter.value;
            case 'gte':
              return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;
            case 'lte':
              return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;
            default:
              return true;
          }
        }),
      );
      return Promise.resolve(resolve({ data: rows, error: null }));
    },
  };
  return query;
}

const mockSupabaseFrom = jest.fn((table: string) => {
  if (table === 'beaches') {
    return {
      select: jest.fn(() => ({
        in: jest.fn(async (_column: string, ids: string[]) => ({
          data: mockState.includedBeachRows.filter((beach) => ids.includes(beach.id!)),
          error: null,
        })),
      })),
    };
  }

  if (table === 'boards') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(async () => ({
          data: mockState.boards,
          error: mockState.boardsError,
        })),
      })),
    };
  }

  if (table === 'custom_spots') {
    return makeCustomSpotsQuery();
  }

  if (table === 'water_quality_held_beaches') {
    return {
      select: jest.fn(() => ({
        in: jest.fn(async () => ({
          data: mockState.waterQualityProbeError ? null : [],
          error: mockState.waterQualityProbeError,
        })),
      })),
    };
  }

  if (table === 'sessions') {
    const filters: Array<{ op: 'in' | 'is' | 'gte'; column: string; value: unknown }> = [];
    const query: any = {
      select: jest.fn(() => query),
      in: jest.fn((column: string, value: unknown) => {
        filters.push({ op: 'in', column, value });
        return query;
      }),
      is: jest.fn((column: string, value: unknown) => {
        filters.push({ op: 'is', column, value });
        return query;
      }),
      gte: jest.fn((column: string, value: unknown) => {
        filters.push({ op: 'gte', column, value });
        return query;
      }),
      order: jest.fn(() => query),
      limit: jest.fn(async () => {
        const rows = mockState.sessionRows.filter((row) =>
          filters.every((filter) => {
            const value = row[filter.column];
            if (filter.op === 'in' && Array.isArray(filter.value)) {
              return filter.value.includes(value);
            }
            if (filter.op === 'is') {
              return value === filter.value;
            }
            if (filter.op === 'gte') {
              return String(value) >= String(filter.value);
            }
            return true;
          })
        );
        return { data: rows, error: null };
      }),
    };
    return query;
  }

  if (table === 'sun_times') {
    return {
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          in: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    };
  }

  return {
    select: jest.fn(() => ({
      in: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  };
});

// Setup mocks
jest.mock('@/lib/services/discovery/candidate-pool-builder', () => ({
  CANDIDATE_POOL_LIMIT: 60,
  MAX_CANDIDATE_RADIUS_MILES: 100,
  buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
}));

jest.mock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
  batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
}));

jest.mock('@/lib/services/discovery/window-selector', () => {
  const selectBestWindow = jest.fn((forecasts: any[]) => {
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
  });

  return {
    selectBestWindow,
    selectBestWindows: jest.fn((...args: any[]) => {
      const window = selectBestWindow(args[0]);
      return window ? [window] : [];
    }),
    scoreWindowConditionScore: jest.fn(() => 70),
    getLocalDateStr: jest.fn((date: Date, _tz: string) => {
      return date.toISOString().split('T')[0];
    }),
    getLocalHour: jest.fn((date: Date, _tz: string) => {
      return date.getUTCHours();
    }),
  };
});

jest.mock('@/lib/services/discovery/response-formatter', () => ({
  enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
  generateDiscoverySummary: jest.fn(() => 'Good conditions'),
  getRecommendationLabel: jest.fn(() => 'Worth it'),
  getRecommendationLabelGated: jest.fn(() => 'Worth it'),
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
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
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
  // Engine stub: score() returns a CompositeScore-like with .total used by
  // computeWindowSlotScores. .skip = false so the helper doesn't short-circuit.
  createDiscoveryScoringEngine: jest.fn(() => ({
    score: jest.fn(() => ({
      total: 70,
      subscores: new Map(),
      reasons: [],
      warnings: [],
      skip: false,
      skipReason: null,
    })),
  })),
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
  // Stubs for the helpers the orchestrator now invokes pre-rerank to populate
  // rec.spotProfile and rec.windowSlotScores. Returns minimal objects shaped
  // like the real domain types.
  beachToSpotProfile: jest.fn((beach) => ({
    beachId: beach?.id ?? 'mock-beach',
    swellWindow: { minDeg: 200, maxDeg: 320, centerDeg: 260, halfWidthDeg: 60 },
    windThresholds: { offshoreDeg: 90, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
    tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: 'either' },
    skillLevel: 'intermediate',
    breakType: 'beach',
  })),
  forecastToSnapshot: jest.fn(() => ({
    timestamp: new Date(),
    waveHeight: 3,
    wavePeriod: 10,
    waveDirection: 270,
    primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
    secondarySwell: null,
    windWave: null,
    wind: { speedMph: 5, directionDeg: 90 },
    tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
    confidence: 80,
    dataSource: 'NOAA_NWS',
  })),
  getConditionCharacter: jest.fn(() => ({ label: 'Clean', category: 'good-clean' })),
}));

jest.mock('@/lib/scoring/native-condition-score', () => {
  const actual = jest.requireActual('@/lib/scoring/native-condition-score');

  return {
    ...actual,
    scoreNativeForecastSlot: jest.fn((forecast: any) => {
      const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
      const beach = { id: forecast?.beach_id ?? 'beach-1' };
      const detailed = scoreBeachWithEngine(null, beach, forecast);
      const subscores = detailed.subscores ?? {};
      return (
        detailed.total -
        (subscores.affinityBonus ?? 0) -
        (subscores.distancePenalty ?? 0)
      );
    }),
    getNativeConditionMatchQuality: jest.fn(() => 'excellent'),
  };
});

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
import { WORTH_THE_DRIVE_REASON } from '@/lib/services/discovery/distance-friction';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';

function resetDefaultDiscoveryMocks(): void {
  const { scoreBeachWithEngine, forecastToSnapshot } = require('@/lib/domains/scoring');
  const {
    fetchPersonalizationContext,
    calculatePersonalizationBonus,
  } = require('@/lib/services/discovery/personalization-layer');

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
  forecastToSnapshot.mockReturnValue({
    timestamp: new Date(),
    waveHeight: 3,
    wavePeriod: 10,
    waveDirection: 270,
    primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
    secondarySwell: null,
    windWave: null,
    wind: { speedMph: 5, directionDeg: 90 },
    tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
    confidence: 80,
    dataSource: 'NOAA_NWS',
  });
  fetchPersonalizationContext.mockResolvedValue({
    implicitPrefs: null,
    learnedPrefs: null,
    affinityMap: new Map(),
    preferredBreakType: null,
    implicitWeight: 0,
  });
  calculatePersonalizationBonus.mockReturnValue({
    total: 0,
    affinityBonus: 0,
    personalizationBonus: 0,
    reasons: [],
  });
}

function customSpotRow(input: {
  id: string;
  userId: string;
  name: string;
  visibility: 'private' | 'public';
  nearestBeachId?: string | null;
  lat?: number;
  lon?: number;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    name: input.name,
    lat: input.lat ?? 32.795,
    lon: input.lon ?? -117.254,
    visibility: input.visibility,
    nearest_beach_id: input.nearestBeachId === undefined ? 'beach-4' : input.nearestBeachId,
    nearest_beach_distance_mi: 0.2,
    break_type: 'reef',
    facing_direction_deg: 245,
    swell_window_min_deg: 210,
    swell_window_max_deg: 285,
    offshore_direction_deg: 65,
    exposure_level: 'sheltered',
    fingerprint_confidence: 'medium',
    fingerprint_updated_at: '2024-01-01T00:00:00.000Z',
    deleted_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };
}

function makeForecastForBeach(beachId: string): Partial<EnhancedForecastEntity> {
  return {
    ...mockForecast,
    beach_id: beachId,
  };
}

afterEach(() => {
  mockState.includedBeachRows = [];
  mockState.customSpots = [];
  mockState.sessionRows = [];
  resetDefaultDiscoveryMocks();
});

describe('discoverSurfSpots - Hotfix Candidate Boundaries', () => {
  const userLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockState.candidatePoolResponse = {
      candidates: Array.from({ length: 12 }, (_, index) => ({
        ...mockBeach1,
        id: `beach-${index + 1}`,
        name: `Beach ${index + 1}`,
      })) as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [],
      failed: [],
      staleCount: 0,
    };
  });

  it('fetches forecasts for only the first eight distance-ordered candidates', async () => {
    await discoverSurfSpots('candidate-limit-user', {
      userLocation,
      candidatePoolLimit: 8,
    });

    const { batchFetchForecasts } = require(
      '@/lib/services/discovery/forecast-batch-fetcher',
    );
    expect(batchFetchForecasts).toHaveBeenCalledTimes(1);
    const fetchedCandidates = batchFetchForecasts.mock.calls[0][0] as Beach[];
    expect(fetchedCandidates.map((beach) => beach.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `beach-${index + 1}`),
    );
  });

  it('marks a successful empty candidate lookup as no_candidates', async () => {
    mockState.candidatePoolResponse.candidates = [];

    const result = await discoverSurfSpots('empty-candidate-user', {
      userLocation,
      candidatePoolLimit: 8,
      throwOnFailure: true,
    });

    expect(result.metadata.outcome).toBe('no_candidates');
  });

  it('throws a retryable operational error when forecasts are unavailable', async () => {
    await expect(discoverSurfSpots('forecast-outage-user', {
      userLocation,
      candidatePoolLimit: 8,
      throwOnFailure: true,
    })).rejects.toMatchObject({
      code: 'forecast_unavailable',
      retryable: true,
    });
  });

  it('classifies an overall timeout as retryable', async () => {
    const { buildCandidatePool } = require(
      '@/lib/services/discovery/candidate-pool-builder',
    );
    buildCandidatePool.mockImplementationOnce(() => new Promise(() => {}));

    await expect(discoverSurfSpots('timeout-user', {
      userLocation,
      overallTimeout: 1,
      throwOnFailure: true,
    })).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    });
  });

  it('classifies an unexpected internal failure as retryable', async () => {
    const { buildCandidatePool } = require(
      '@/lib/services/discovery/candidate-pool-builder',
    );
    buildCandidatePool.mockRejectedValueOnce(new Error('candidate query failed'));

    await expect(discoverSurfSpots('internal-error-user', {
      userLocation,
      throwOnFailure: true,
    })).rejects.toMatchObject({
      code: 'internal_error',
      retryable: true,
    });
  });
});

describe('discoverSurfSpots - Favorites Merging', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    const { scoreBeachWithEngine, forecastToSnapshot } = require('@/lib/domains/scoring');
    const {
      fetchPersonalizationContext,
      calculatePersonalizationBonus,
    } = require('@/lib/services/discovery/personalization-layer');

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
    forecastToSnapshot.mockReturnValue({
      timestamp: new Date(),
      waveHeight: 3,
      wavePeriod: 10,
      waveDirection: 270,
      primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
      secondarySwell: null,
      windWave: null,
      wind: { speedMph: 5, directionDeg: 90 },
      tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
      confidence: 80,
      dataSource: 'NOAA_NWS',
    });
    fetchPersonalizationContext.mockResolvedValue({
      implicitPrefs: null,
      learnedPrefs: null,
      affinityMap: new Map(),
      preferredBreakType: null,
      implicitWeight: 0,
    });
    calculatePersonalizationBonus.mockReturnValue({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    });

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
    mockState.includedBeachRows = [];
    mockState.customSpots = [];
    mockState.favoritesError = null;
    mockState.boards = [];
    mockState.boardsError = null;
    mockState.userPrefs = null;
    mockState.affinityMap = new Map();
    mockState.sunTimesCache = new Map();
    mockState.waterQualityProbeError = null;
  });

  test('still returns a full pool when the water-quality probe is unreachable', async () => {
    // A probe we cannot reach means "no holds known", not "hold everything".
    // Fail-closed here suppressed every recommendation for every user.
    mockState.waterQualityProbeError = {
      code: 'PGRST500',
      message: 'database unavailable',
    };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendationAvailability).toMatchObject({
      state: 'available',
    });
    expectConsoleErrors([/\[water-quality-hold:query-error\]/]);
  });

  test('marks favorite beaches with isFavorite flag but ranks by score', async () => {
    // Setup: beach-2 is a favorite
    mockState.favoriteBeaches = [mockBeach2];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Verify results are returned and favorites are marked
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Find beach-2 and verify it has isFavorite flag
    const beach2Rec = result.recommendations.find(r => r.beach.id === 'beach-2');
    expect(beach2Rec).toMatchObject({ isFavorite: true });

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
    expect(beach2Rec?.isFavorite).toBe(true);
    // Displayed score is the condition score; the distance penalty is a ranking
    // input now, so it no longer silently lowers the number on the card.
    expect(beach2Rec?.score).toBe(50);
    // Distance friction still demotes it, but in ranking only.
    expect(beach2Rec!.rankingScore!).toBeLessThan(beach2Rec!.score);

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

  test('scores only the forecast row nearest a requested forecastAt', async () => {
    const requestedForecastAt = '2024-01-15T14:20:00.000Z';
    const matchedForecastAt = '2024-01-15T15:00:00.000Z';
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        {
          beach: mockBeach1,
          forecasts: [
            {
              ...mockForecast,
              id: 'unrelated-row',
              forecast_at: '2024-01-15T12:00:00.000Z',
            },
            {
              ...mockForecast,
              id: 'matched-row',
              forecast_at: matchedForecastAt,
            },
          ],
        },
      ],
      failed: [],
      staleCount: 0,
    };
    const { selectBestWindows } = require(
      '@/lib/services/discovery/window-selector',
    );

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      forecastAt: requestedForecastAt,
      maxResults: 5,
    });

    expect(selectBestWindows).toHaveBeenCalledWith(
      expect.objectContaining({
        forecasts: [
          expect.objectContaining({
            id: 'matched-row',
            forecast_at: matchedForecastAt,
          }),
        ],
        now: new Date(requestedForecastAt),
        maxWindows: 1,
      }),
    );
    expect(result.recommendations[0]?.forecast).toMatchObject({
      id: 'matched-row',
      forecast_at: matchedForecastAt,
    });
  });

  test('does not fall through to another row when forecastAt has no nearby match', async () => {
    const requestedForecastAt = '2024-01-15T18:00:00.000Z';
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        {
          beach: mockBeach1,
          forecasts: [
            {
              ...mockForecast,
              id: 'unrelated-row',
              forecast_at: '2024-01-15T12:00:00.000Z',
            },
          ],
        },
      ],
      failed: [],
      staleCount: 0,
    };
    const { selectBestWindows } = require(
      '@/lib/services/discovery/window-selector',
    );

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      forecastAt: requestedForecastAt,
      maxResults: 5,
    });

    expect(selectBestWindows).not.toHaveBeenCalled();
    expect(result.recommendations).toEqual([]);
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

  test('ranks firing Oceanside above a weak close spot and marks it worth the drive', async () => {
    const closeBeach: Partial<Beach> = {
      ...mockBeach1,
      id: 'close-weak-spot',
      name: 'Close Weak Spot',
      lat: 32.7589,
      lon: -117.1611,
    };
    const oceansideBeach: Partial<Beach> = {
      ...mockBeach2,
      id: 'oceanside-firing',
      name: 'Oceanside',
      slug: 'oceanside',
      city: 'Oceanside',
      lat: 33.1959,
      lon: -117.3795,
    };

    mockState.candidatePoolResponse = {
      candidates: [closeBeach, oceansideBeach] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: closeBeach, forecasts: [makeForecastForBeach('close-weak-spot')] },
        { beach: oceansideBeach, forecasts: [makeForecastForBeach('oceanside-firing')] },
      ],
      failed: [],
      staleCount: 0,
    };

    const rawConditionScores: Record<string, number> = {
      'close-weak-spot': 55,
      'oceanside-firing': 80,
    };
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((_engine: any, beach: Beach, forecast: EnhancedForecastEntity) => {
      const beachId = forecast?.beach_id ?? beach.id;
      const total = rawConditionScores[beachId] ?? 70;
      return {
        total,
        subscores: {
          waveHeightFit: total,
          periodEnergyScore: 0,
          windAlignment: 0,
          tideFit: 0,
          affinityBonus: 0,
          personalizationBonus: 0,
          distancePenalty: 0,
        },
        matchQuality: 'excellent',
        reasons: [`${beach.name} condition score ${total}`],
        warnings: [],
        conditionBadges: [],
      };
    });

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });

    expect(result.recommendations.map((rec) => rec.beach.id)).toEqual([
      'oceanside-firing',
      'close-weak-spot',
    ]);
    expect(result.recommendations[0].score).toBeGreaterThanOrEqual(70);
    expect(result.recommendations[0].reasons[0]).toBe(WORTH_THE_DRIVE_REASON);
  });

  test('uses nearer distance as the final tie-breaker within 3 score points', async () => {
    const closeBeach: Partial<Beach> = {
      ...mockBeach1,
      id: 'close-tiebreaker',
      name: 'Close Tie Breaker',
      lat: 32.7589,
      lon: -117.1611,
    };
    const farBeach: Partial<Beach> = {
      ...mockBeach2,
      id: 'far-tiebreaker',
      name: 'Far Tie Breaker',
      lat: 33.1959,
      lon: -117.3795,
    };

    mockState.candidatePoolResponse = {
      candidates: [farBeach, closeBeach] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: farBeach, forecasts: [makeForecastForBeach('far-tiebreaker')] },
        { beach: closeBeach, forecasts: [makeForecastForBeach('close-tiebreaker')] },
      ],
      failed: [],
      staleCount: 0,
    };

    const rawConditionScores: Record<string, number> = {
      'close-tiebreaker': 73,
      'far-tiebreaker': 80,
    };
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((_engine: any, beach: Beach, forecast: EnhancedForecastEntity) => {
      const beachId = forecast?.beach_id ?? beach.id;
      const total = rawConditionScores[beachId] ?? 70;
      return {
        total,
        subscores: {
          waveHeightFit: total,
          periodEnergyScore: 0,
          windAlignment: 0,
          tideFit: 0,
          affinityBonus: 0,
          personalizationBonus: 0,
          distancePenalty: 0,
        },
        matchQuality: 'excellent',
        reasons: [`${beach.name} condition score ${total}`],
        warnings: [],
        conditionBadges: [],
      };
    });

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });

    expect(result.recommendations.map((rec) => rec.beach.id)).toEqual([
      'close-tiebreaker',
      'far-tiebreaker',
    ]);
    expect(result.recommendations[0].score).toBeLessThan(
      result.recommendations[1].score
    );
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
    expect(beach1Rec).toMatchObject({ isFavorite: true });
    expect(beach2Rec).toMatchObject({ isFavorite: true });
  });

  test('marks non-favorites with isFavorite: false', async () => {
    mockState.favoriteBeaches = [mockBeach1];

    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Find a non-favorite recommendation
    const nonFavorite = result.recommendations.find(r => r.beach.id !== 'beach-1');
    expect(nonFavorite).toMatchObject({ isFavorite: false }); // Now explicitly false, not undefined
  });

  test('handles malformed recommendations with null safety', async () => {
    // This test verifies the null safety checks added to prevent crashes
    // when recommendation data is malformed (missing beach.id or score)
    mockState.favoriteBeaches = [mockBeach1];

    // The mocking infrastructure ensures we always get valid data,
    // but this test documents the expected behavior for null safety
    const result = await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation, maxResults: 5 });

    // Should successfully complete without errors
    expect(result.recommendations).toEqual(expect.any(Array));
    expect(result.recommendations.length).toBeGreaterThan(0);

    // All recommendations should have valid beach.id and score
    for (const rec of result.recommendations) {
      expect(rec).toMatchObject({
        beach: { id: expect.any(String) },
        score: expect.any(Number),
      });
    }
  });

  test('attaches condition-based board picks for Pro users with saved boards', async () => {
    mockState.boards = [
      { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
      { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
    ];

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
      isPro: true,
    });

    const beach1Rec = result.recommendations.find(r => r.beach.id === 'beach-1');
    // 3.5ft is the `medium` tier, whose priority list leads with shortboard, and
    // this quiver has one. The previous expectation asserted the 9'0 longboard
    // while carrying the medium-tier reason string — it contradicted the table it
    // was exercising. Board-aware scoring now returns the surf-correct pick.
    expect(beach1Rec?.boardPick).toEqual({
      boardName: "5'10 Lost Driver",
      boardType: 'shortboard',
      reason: "5'10 Lost Driver conditions — enjoy the fun waves",
    });
    expect(mockSupabaseFrom).toHaveBeenCalledWith('boards');
  });

  test('keeps a Pro board pick when no saved board class can be scored', async () => {
    mockState.boards = [
      { id: 'custom-1', name: 'Custom Shape', board_type: 'custom-shape', volume: 40 },
      { id: 'custom-2', name: 'Another Shape', board_type: 'another-shape', volume: 35 },
    ];

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
      isPro: true,
    });

    const beach1Rec = result.recommendations.find(r => r.beach.id === 'beach-1');
    expect(beach1Rec?.boardPick).toEqual({
      boardName: 'Custom Shape',
      boardType: 'custom-shape',
      reason: 'Custom Shape conditions — enjoy the fun waves',
    });
  });

  test('fetches board context for free users without leaking Pro board picks', async () => {
    mockState.boards = [
      { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28, session_count: 3 },
    ];

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
      isPro: false,
    });

    expect(mockSupabaseFrom).toHaveBeenCalledWith('boards');
    expect(result.recommendations.every(r => r.boardPick == null)).toBe(true);
  });

  test('degrades to null board picks when Pro board lookup fails', async () => {
    mockState.boardsError = { message: 'Database connection failed' };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
      isPro: true,
    });

    expect(mockSupabaseFrom).toHaveBeenCalledWith('boards');
    expect(result.recommendations.every(r => r.boardPick == null)).toBe(true);
  });

  test("uses one dominant board class to rank Old Man's above Blacks for logs and Blacks above Old Man's for shortboards", async () => {
    const oldMans = {
      ...mockBeach1,
      id: 'old-mans',
      name: "Old Man's (SanO)",
      slug: 'old-mans-sano',
      lat: 32.7157,
      lon: -117.1611,
      skill_level: 'expert',
      wave_punchiness: -0.8,
    } as Beach & { wave_punchiness: number };
    const blacks = {
      ...mockBeach3,
      id: 'blacks',
      name: 'Blacks',
      slug: 'blacks',
      lat: 32.7157,
      lon: -117.1611,
      skill_level: 'expert',
      wave_punchiness: 0.9,
    } as Beach & { wave_punchiness: number };

    mockState.candidatePoolResponse = {
      candidates: [oldMans, blacks],
      preferredWaveSize: null,
      userSkillLevel: 'expert',
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: oldMans, forecasts: [{ ...mockForecast, beach_id: oldMans.id }] },
        { beach: blacks, forecasts: [{ ...mockForecast, beach_id: blacks.id }] },
      ],
      failed: [],
      staleCount: 0,
    };

    mockState.boards = [
      {
        id: 'log-1',
        name: "9'6 Log",
        board_type: 'longboard',
        session_count: 12,
      },
    ];
    const longboardResult = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });

    expect(longboardResult.recommendations.map((rec) => rec.beach.id)).toEqual([
      'old-mans',
      'blacks',
    ]);
    expect(longboardResult.recommendations[0].reasons).toContain(
      'Classic longboard wave'
    );
    expect(longboardResult.recommendations[1].warnings).toContain(
      'Punchy, steep wave - rough on a log'
    );

    mockState.boards = [
      {
        id: 'shortboard-1',
        name: "5'10 Driver",
        board_type: 'shortboard',
        session_count: 12,
      },
    ];
    const shortboardResult = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });

    expect(shortboardResult.recommendations.map((rec) => rec.beach.id)).toEqual([
      'blacks',
      'old-mans',
    ]);
    expect(shortboardResult.recommendations[0].reasons).toContain(
      'Classic shortboard wave'
    );
    expect(shortboardResult.recommendations[1].warnings).toContain(
      'Soft, rolling wave - not much push for a shortboard'
    );
  });

  test('derives board-style fit from beach attributes when no wave punchiness override exists', async () => {
    const punchyReef = {
      ...mockBeach3,
      id: 'derived-reef',
      name: 'Derived Reef',
      slug: 'derived-reef',
      lat: 32.7157,
      lon: -117.1611,
      break_type: 'reef',
      skill_level: 'expert',
      wave_punchiness: null,
    } as Beach & { wave_punchiness: null };
    const softBeachBreak = {
      ...mockBeach1,
      id: 'derived-soft-beach',
      name: 'Derived Soft Beach',
      slug: 'derived-soft-beach',
      lat: 32.7157,
      lon: -117.1611,
      break_type: 'beach',
      skill_level: 'beginner',
      wave_punchiness: null,
    } as Beach & { wave_punchiness: null };

    mockState.candidatePoolResponse = {
      candidates: [punchyReef, softBeachBreak],
      preferredWaveSize: null,
      userSkillLevel: 'expert',
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        {
          beach: punchyReef,
          forecasts: [{ ...mockForecast, beach_id: punchyReef.id }],
        },
        {
          beach: softBeachBreak,
          forecasts: [{ ...mockForecast, beach_id: softBeachBreak.id }],
        },
      ],
      failed: [],
      staleCount: 0,
    };

    mockState.boards = [
      {
        id: 'shortboard-1',
        name: "5'10 Driver",
        board_type: 'shortboard',
        session_count: 12,
      },
    ];

    const shortboardResult = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });
    const reefForShortboard = shortboardResult.recommendations.find(
      (rec) => rec.beach.id === 'derived-reef'
    );
    // Board-style fit depends on the user's quiver, so it is a ranking input:
    // the displayed score stays the condition score, ranking carries the +5.
    expect(reefForShortboard?.score).toBe(70);
    expect(reefForShortboard?.rankingScore).toBe(75);
    expect(reefForShortboard?.reasons).toContain('Classic shortboard wave');

    mockState.boards = [
      {
        id: 'gun-1',
        name: "7'2 Gun",
        board_type: 'gun',
        session_count: 12,
      },
    ];

    const gunResult = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });
    const softBeachForGun = gunResult.recommendations.find(
      (rec) => rec.beach.id === 'derived-soft-beach'
    );
    // Same split on the penalty side: conditions are 70, the gun mismatch (-10)
    // demotes it in ranking without rewriting the measured condition score.
    expect(softBeachForGun?.score).toBe(70);
    expect(softBeachForGun?.rankingScore).toBe(60);
    expect(softBeachForGun?.warnings).toContain(
      'Soft, rolling wave - not much push for a gun'
    );
  });

  test('scores includeBeachIds outside the nearby candidate pool and returns low-ranked included recs separately', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((engine: any, beach: Beach) => ({
      total: beach.id === 'beach-1' ? 91 : 42,
      subscores: {
        waveHeightFit: 20,
        periodEnergyScore: 15,
        windAlignment: 15,
        tideFit: 12,
        affinityBonus: 0,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      matchQuality: beach.id === 'beach-1' ? 'excellent' : 'fair',
      reasons: ['Scored in batch'],
      warnings: [],
      conditionBadges: [],
    }));

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 1,
      includeBeachIds: ['beach-4'],
    });

    const { batchFetchForecasts } = require('@/lib/services/discovery/forecast-batch-fetcher');
    expect(batchFetchForecasts.mock.calls[0][0].map((beach: Beach) => beach.id)).toEqual([
      'beach-1',
      'beach-4',
    ]);
    expect(result.recommendations.map((rec) => rec.beach.id)).toEqual(['beach-1']);
    expect(result.includedRecommendations?.map((rec) => rec.beach.id)).toEqual(['beach-4']);
  });

  test('keeps a high-scoring far includeBeachId out of primary recommendations', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((engine: any, beach: Beach) => ({
      total: beach.id === 'beach-4' ? 95 : 70,
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
      reasons: ['Scored in batch'],
      warnings: [],
      conditionBadges: [],
    }));

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 1,
      includeBeachIds: ['beach-4'],
    });

    const { batchFetchForecasts } = require('@/lib/services/discovery/forecast-batch-fetcher');
    expect(batchFetchForecasts).toHaveBeenCalledTimes(1);
    expect(batchFetchForecasts.mock.calls[0][0].map((beach: Beach) => beach.id)).toEqual([
      'beach-1',
      'beach-4',
    ]);
    expect(result.recommendations.map((rec) => rec.beach.id)).toEqual(['beach-1']);
    expect(result.includedRecommendations?.map((rec) => rec.beach.id)).toEqual(['beach-4']);
  });

  test('does not duplicate an included beach that is also nearby and already ranks into recommendations', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1, mockBeach4] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    scoreBeachWithEngine.mockImplementation((engine: any, beach: Beach) => ({
      total: beach.id === 'beach-4' ? 95 : 70,
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
      reasons: ['Scored in batch'],
      warnings: [],
      conditionBadges: [],
    }));

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
      includeBeachIds: ['beach-4'],
    });

    const { batchFetchForecasts } = require('@/lib/services/discovery/forecast-batch-fetcher');
    expect(batchFetchForecasts).toHaveBeenCalledTimes(1);
    expect(batchFetchForecasts.mock.calls[0][0].map((beach: Beach) => beach.id)).toEqual([
      'beach-1',
      'beach-4',
    ]);
    expect(result.recommendations.map((rec) => rec.beach.id)).toEqual(['beach-4', 'beach-1']);
    expect(result.includedRecommendations).toEqual([]);
  });

  test('includes own and nearby public custom spots without leaking other users private spots', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.customSpots = [
      customSpotRow({
        id: 'own-private-spot',
        userId: testUserId,
        name: 'Own Private Peak',
        visibility: 'private',
      }),
      customSpotRow({
        id: 'other-public-spot',
        userId: 'other-user',
        name: 'Community Reef',
        visibility: 'public',
      }),
      customSpotRow({
        id: 'other-private-spot',
        userId: 'other-user',
        name: 'Leaky Private Reef',
        visibility: 'private',
      }),
      customSpotRow({
        id: 'far-public-spot',
        userId: 'other-user',
        name: 'Far Public Reef',
        visibility: 'public',
        lat: 40,
        lon: -125,
      }),
      customSpotRow({
        id: 'unresolved-own-spot',
        userId: testUserId,
        name: 'Unresolved Own Spot',
        visibility: 'private',
        nearestBeachId: null,
      }),
    ];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const { batchFetchForecasts } = require('@/lib/services/discovery/forecast-batch-fetcher');

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
    });

    expect(batchFetchForecasts.mock.calls[0][0].map((beach: Beach) => beach.id)).toEqual([
      'beach-1',
      'beach-4',
    ]);
    const customRecs = [
      ...result.recommendations,
      ...(result.includedRecommendations ?? []),
    ].filter((rec) => rec.kind === 'custom_spot');
    expect(customRecs.map((rec) => rec.customSpotId).sort()).toEqual([
      'other-public-spot',
      'own-private-spot',
    ]);
    expect(customRecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'custom_spot',
          customSpotId: 'own-private-spot',
          visibility: 'private',
          isOwn: true,
          beach: expect.objectContaining({
            id: 'beach-4',
            name: 'Own Private Peak',
            lat: 32.795,
            lon: -117.254,
          }),
        }),
        expect.objectContaining({
          kind: 'custom_spot',
          customSpotId: 'other-public-spot',
          visibility: 'public',
          isOwn: false,
          beach: expect.objectContaining({
            id: 'beach-4',
            name: 'Community Reef',
          }),
        }),
      ]),
    );
    expect(customRecs.find((rec) => rec.customSpotId === 'other-private-spot')).toBeUndefined();
    expect(customRecs.find((rec) => rec.customSpotId === 'far-public-spot')).toBeUndefined();
    expect(customRecs.find((rec) => rec.customSpotId === 'unresolved-own-spot')).toBeUndefined();
  });

  test('excludes own custom spots outside the discovery radius', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.customSpots = [
      customSpotRow({
        id: 'near-own-spot',
        userId: testUserId,
        name: 'Near Own Peak',
        visibility: 'private',
      }),
      customSpotRow({
        id: 'far-own-spot',
        userId: testUserId,
        name: 'Far Own Peak',
        visibility: 'private',
        lat: 40,
        lon: -125,
      }),
    ];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
    });

    const customIds = [
      ...result.recommendations,
      ...(result.includedRecommendations ?? []),
    ]
      .filter((rec) => rec.kind === 'custom_spot')
      .map((rec) => rec.customSpotId)
      .sort();

    expect(customIds).toEqual(['near-own-spot']);
  });

  test('keeps an in-radius own custom spot out of Now/Best but in My spots when beyond the nearby-beach cut', async () => {
    // 21 candidate beaches clustered on the user trips the 20-spot cap, so the
    // nearby boundary collapses to ~1.3mi. The custom spot sits ~7.7mi out:
    // within the 25mi radius (so it is fetched) but beyond the nearby cut.
    const clusterCandidates: Beach[] = [
      mockBeach1 as Beach,
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `cluster-${i}`,
        name: `Cluster ${i}`,
        slug: `cluster-${i}`,
        lat: 32.7157 + (i + 1) * 0.001,
        lon: -117.1611,
        city: 'San Diego',
        state: 'CA',
        is_private: false,
        skill_level: 'intermediate',
      }) as Beach),
    ];
    mockState.candidatePoolResponse = {
      candidates: clusterCandidates,
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.customSpots = [
      customSpotRow({
        id: 'beyond-cut-own-spot',
        userId: testUserId,
        name: 'Beyond Cut Peak',
        visibility: 'private',
      }),
    ];
    mockState.forecastBatchResponse = {
      successful: [
        ...clusterCandidates.map((beach) => ({
          beach,
          forecasts: [{ ...mockForecast, beach_id: beach.id }],
        })),
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
    });

    // Gated out of the primary (Now/Best) feed...
    expect(
      result.recommendations.find((rec) => rec.customSpotId === 'beyond-cut-own-spot'),
    ).toBeUndefined();
    // ...but still reachable in My spots via includedRecommendations.
    expect(
      (result.includedRecommendations ?? []).find(
        (rec) => rec.customSpotId === 'beyond-cut-own-spot',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'custom_spot',
        customSpotId: 'beyond-cut-own-spot',
        isOwn: true,
      }),
    );
  });

  test('treats custom spot 0 to 360 swell windows as full-circle exposure', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.customSpots = [
      {
        ...customSpotRow({
          id: 'all-direction-own-spot',
          userId: testUserId,
          name: 'All Direction Peak',
          visibility: 'private',
        }),
        swell_window_min_deg: 0,
        swell_window_max_deg: 360,
      },
    ];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 5,
    });

    const customRec = [
      ...result.recommendations,
      ...(result.includedRecommendations ?? []),
    ].find((rec) => rec.kind === 'custom_spot' && rec.customSpotId === 'all-direction-own-spot');

    expect(customRec).toMatchObject({
      kind: 'custom_spot',
      beach: expect.objectContaining({
        swell_window_min_deg: 0,
        swell_window_max_deg: 360,
        swell_window_center_deg: 180,
        swell_window_halfwidth_deg: 180,
      }),
    });
  });

  test('keeps omitted own custom spots in includedRecommendations without consuming includeBeachIds cap', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.customSpots = [
      customSpotRow({
        id: 'own-private-spot',
        userId: testUserId,
        name: 'Own Private Peak',
        visibility: 'private',
      }),
    ];
    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [mockForecast] },
        { beach: mockBeach4, forecasts: [{ ...mockForecast, beach_id: 'beach-4' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 1,
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.includedRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'custom_spot',
          customSpotId: 'own-private-spot',
          isOwn: true,
        }),
      ]),
    );
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
    mockState.boards = [];
    mockState.boardsError = null;
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
    mockState.boards = [];
    mockState.boardsError = null;
    mockState.userPrefs = null;
  });

  test('calls fetchPersonalizationContext with correct arguments', async () => {
    const { fetchPersonalizationContext } = require('@/lib/services/discovery/personalization-layer');

    await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    expect(fetchPersonalizationContext).toHaveBeenCalledTimes(1);
    const args = fetchPersonalizationContext.mock.calls[0];
    expect(args[0]).toBe(testUserId);
    // beachIds should be the IDs from the forecasted beaches
    expect(args[1]).toEqual(expect.arrayContaining(['beach-1', 'beach-2', 'beach-3', 'beach-4']));
    // 3rd arg is userPrefs (null from our mock)
    expect(args[2]).toBeNull();
  });

  test('calls calculatePersonalizationBonus for each beach', async () => {
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    await discoverSurfSpots(testUserId, { userLocation: defaultUserLocation });

    // Should be called once per beach with forecasts
    expect(calculatePersonalizationBonus).toHaveBeenCalledTimes(4);
  });

  test('personalization bonus flows into the ranking score, not the displayed score', async () => {
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
    expect(beach1).toMatchObject({ score: expect.any(Number) });
    // The displayed score is conditions only, so personalization must NOT move
    // it — folding bonuses in here is what pinned every decent spot to 100.
    expect(beach1!.score).toBe(75);
    // It moves the ranking value instead: +5 affinity +15 personalization.
    expect(beach1!.rankingScore).toBe(95);
    expect(beach1!.rankingScore!).toBeGreaterThan(beach1!.score);
    // Personalization reasons should appear in the reasons array
    expect(beach1!.reasons).toEqual(expect.arrayContaining([
      'Matches your preferred break type',
      'Wave size matches your sweet spot',
    ]));
    // subscores should include personalizationBonus
    expect(beach1!.subscores.personalizationBonus).toBe(15);
  });

  test('post-personalization bonuses apply to ranking while the displayed score stays the native base', async () => {
    const { scoreBeachWithEngine, forecastToSnapshot } = require('@/lib/domains/scoring');
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    mockState.forecastBatchResponse = {
      successful: [
        { beach: mockBeach1, forecasts: [{ ...mockForecast, wave_height: '1.7' }] },
      ],
      failed: [],
      staleCount: 0,
    };

    forecastToSnapshot.mockReturnValue({
      timestamp: new Date(),
      waveHeight: 1.7,
      wavePeriod: 10,
      waveDirection: 270,
      primarySwell: { heightFt: 1.7, periodS: 10, directionDeg: 270 },
      secondarySwell: null,
      windWave: null,
      wind: { speedMph: 5, directionDeg: 90 },
      tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
      confidence: 80,
      dataSource: 'NOAA_NWS',
    });
    scoreBeachWithEngine.mockReturnValue({
      total: 55,
      subscores: {
        waveHeightFit: 13,
        periodEnergyScore: 12,
        windAlignment: 12,
        tideFit: 10,
        affinityBonus: 4,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      matchQuality: 'fair',
      reasons: ['Small wave (1.7ft) caps score at 55'],
      warnings: ['Small wave (1.7ft) caps score at 55'],
      conditionBadges: [],
    });
    calculatePersonalizationBonus.mockReturnValue({
      total: 16,
      affinityBonus: 4,
      personalizationBonus: 12,
      reasons: ['Matches your surfing patterns', "One of your go-to spots"],
    });

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 1,
    });

    // Displayed: the native condition score alone (51), not 51+4+12.
    expect(result.recommendations[0].score).toBe(51);
    // Ranking: bonuses still applied on top, unclamped.
    expect(result.recommendations[0].rankingScore).toBe(67);
    expect(result.recommendations[0].subscores.affinityBonus).toBe(4);
    expect(result.recommendations[0].subscores.personalizationBonus).toBe(12);
  });

  test('aggregate break behavior can lift a repeat-completed break without replacing forecast quality', async () => {
    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');

    mockState.candidatePoolResponse = {
      candidates: [
        { ...mockBeach1, lat: 32.7157, lon: -117.1611 },
        { ...mockBeach2, lat: 32.7158, lon: -117.1612 },
      ] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        { beach: { ...mockBeach1, lat: 32.7157, lon: -117.1611 }, forecasts: [mockForecast] },
        {
          beach: { ...mockBeach2, lat: 32.7158, lon: -117.1612 },
          forecasts: [{ ...mockForecast, beach_id: 'beach-2' }],
        },
      ],
      failed: [],
      staleCount: 0,
    };
    scoreBeachWithEngine.mockImplementation((_engine: unknown, beach: Beach) => {
      const baseScore = beach.id === 'beach-2' ? 74 : 70;
      return {
        total: baseScore,
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
      };
    });
    mockState.sessionRows = Array.from({ length: 12 }, (_, index) => ({
      beach_id: 'beach-1',
      user_id: `user-${index % 4}`,
      status: 'completed',
      arrival_time: `2026-06-${String((index % 9) + 1).padStart(2, '0')}T14:00:00Z`,
      created_at: '2026-06-01T12:00:00Z',
      wave_height_ft: 3,
      wind_speed_mph: 7,
      wind_direction: 'W',
      tide_status: 'Rising',
      deleted_at: null,
    }));

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      maxResults: 2,
    });

    expect(result.recommendations[0].beach.id).toBe('beach-1');
    // The behaviour boost describes the surfer's history, not the surf, so it
    // lifts ranking without inflating the condition score on the card. The
    // test name's promise — lift without replacing forecast quality — is now
    // literally true of the displayed number.
    expect(result.recommendations[0].score).toBe(70);
    expect(result.recommendations[0].rankingScore!).toBeGreaterThan(
      result.recommendations[0].score,
    );
    expect(result.recommendations[0].subscores.behaviorBonus).toBeGreaterThan(0);
    expect(result.recommendations[0].reasons).toEqual(
      expect.arrayContaining(['Recent completed sessions back this break'])
    );
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

    // Scores should reflect the native base score plus any distance adjustment,
    // but not personalization.
    for (const rec of result.recommendations) {
      expect(rec.score).toBeLessThanOrEqual(75);
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

describe('discoverSurfSpots - Now Discovery Mode', () => {
  const testUserId = 'test-user-now';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T17:30:00.000Z'));

    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

    calculatePersonalizationBonus.mockReturnValue({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    });

    scoreBeachWithEngine.mockImplementation((_engine: any, _beach: any, forecast: any) => {
      const scoreByForecastId: Record<string, number> = {
        'beach-1-now': 60,
        'beach-1-future': 99,
        'beach-2-now': 84,
        'beach-2-future': 90,
        'beach-3-future': 100,
      };
      const total = scoreByForecastId[forecast?.id] ?? 50;
      return {
        total,
        subscores: {
          waveHeightFit: total,
          periodEnergyScore: 0,
          windAlignment: 0,
          tideFit: 0,
          affinityBonus: 0,
          personalizationBonus: 0,
          distancePenalty: 0,
        },
        matchQuality: total >= 80 ? 'excellent' : 'fair',
        reasons: [`score ${total}`],
        warnings: [],
        conditionBadges: [],
      };
    });

    mockState.candidatePoolResponse = {
      candidates: [mockBeach1, mockBeach2, mockBeach3] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.forecastBatchResponse = {
      successful: [
        {
          beach: mockBeach1,
          forecasts: [
            {
              ...mockForecast,
              id: 'beach-1-now',
              beach_id: 'beach-1',
              forecast_at: '2024-01-15T17:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '09:00:00',
            },
            {
              ...mockForecast,
              id: 'beach-1-future',
              beach_id: 'beach-1',
              forecast_at: '2024-01-15T20:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '12:00:00',
            },
          ],
        },
        {
          beach: mockBeach2,
          forecasts: [
            {
              ...mockForecast,
              id: 'beach-2-now',
              beach_id: 'beach-2',
              forecast_at: '2024-01-15T17:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '09:00:00',
            },
            {
              ...mockForecast,
              id: 'beach-2-future',
              beach_id: 'beach-2',
              forecast_at: '2024-01-15T20:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '12:00:00',
            },
          ],
        },
        {
          beach: mockBeach3,
          forecasts: [
            {
              ...mockForecast,
              id: 'beach-3-future',
              beach_id: 'beach-3',
              forecast_at: '2024-01-15T20:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '12:00:00',
            },
          ],
        },
      ],
      failed: [],
      staleCount: 0,
    };
    mockState.favoriteBeaches = [];
    mockState.favoritesError = null;
    mockState.boards = [];
    mockState.boardsError = null;
    mockState.userPrefs = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('scores active forecast buckets and ignores future-only beaches', async () => {
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      discoveryMode: 'now',
      maxResults: 5,
    });

    expect(mockSelectBestWindow).not.toHaveBeenCalled();
    expect(result.recommendations.map((rec) => rec.beach.id)).toEqual(['beach-2', 'beach-1']);
    expect(result.recommendations.map((rec) => rec.forecast.id)).toEqual([
      'beach-2-now',
      'beach-1-now',
    ]);
  });

  test('scores custom spots from active nearest-beach forecast buckets in now mode', async () => {
    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.includedBeachRows = [mockBeach4];
    mockState.customSpots = [
      customSpotRow({
        id: 'own-now-spot',
        userId: testUserId,
        name: 'Own Now Peak',
        visibility: 'private',
      }),
    ];
    mockState.forecastBatchResponse = {
      successful: [
        {
          beach: mockBeach1,
          forecasts: [
            {
              ...mockForecast,
              id: 'beach-1-now',
              beach_id: 'beach-1',
              forecast_at: '2024-01-15T17:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '09:00:00',
            },
          ],
        },
        {
          beach: mockBeach4,
          forecasts: [
            {
              ...mockForecast,
              id: 'beach-4-now',
              beach_id: 'beach-4',
              forecast_at: '2024-01-15T17:00:00.000Z',
              forecast_date: '2024-01-15',
              forecast_time: '09:00:00',
            },
          ],
        },
      ],
      failed: [],
      staleCount: 0,
    };

    const result = await discoverSurfSpots(testUserId, {
      userLocation: defaultUserLocation,
      discoveryMode: 'now',
      maxResults: 5,
    });

    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'custom_spot',
          customSpotId: 'own-now-spot',
          visibility: 'private',
          isOwn: true,
          forecast: expect.objectContaining({ id: 'beach-4-now' }),
          window: expect.objectContaining({ peakTime: new Date('2024-01-15T17:30:00.000Z') }),
        }),
      ]),
    );
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
    mockState.boards = [];
    mockState.boardsError = null;
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
    expect(receivedForecast).toMatchObject({
      forecast_at: '2024-01-15T15:00:00Z',
    });
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

describe('discoverSurfSpots - Today-First No-Fallback Guard', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();

    const { scoreBeachWithEngine } = require('@/lib/domains/scoring');
    const { calculatePersonalizationBonus } = require('@/lib/services/discovery/personalization-layer');

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

    calculatePersonalizationBonus.mockReturnValue({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    });

    mockState.candidatePoolResponse = {
      candidates: [mockBeach1] as Beach[],
      preferredWaveSize: null,
      userSkillLevel: null,
      preferredBreakType: null,
    };
    mockState.favoriteBeaches = [];
    mockState.favoritesError = null;
    mockState.boards = [];
    mockState.boardsError = null;
    mockState.userPrefs = null;
  });

  test('logs warning (no today forecasts) and uses tomorrow-fallback only when today is empty', async () => {
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');
    const { createContextLogger } = require('@/lib/logger');

    // Provide a fresh warn spy we can inspect
    const warnSpy = jest.fn();
    createContextLogger.mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: warnSpy,
      error: jest.fn(),
    });

    const todayForecast: Partial<EnhancedForecastEntity> = {
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
    const tomorrowForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: '2024-01-16T12:00:00Z',
      forecast_date: '2024-01-16',
      forecast_time: '12:00:00',
      wave_height: '4.0',
      wave_period: '13s',
      wind_speed: '5',
      wind_direction_deg: 270,
      tide_status: 'Rising',
      data_source: 'CDIP',
    };

    mockState.forecastBatchResponse = {
      successful: [{ beach: mockBeach1, forecasts: [todayForecast, tomorrowForecast] }],
      failed: [],
      staleCount: 0,
    };

    const validWindow = {
      start: new Date('2024-01-16T12:00:00Z'),
      end: new Date('2024-01-16T15:00:00Z'),
      tide: 'Rising',
      wind: '5 mph W',
      waveHeight: '4 ft',
      wavePeriod: '13s',
      dataSource: 'CDIP',
      confidence: 85,
      timezone: 'America/Los_Angeles',
      sourceForecast: tomorrowForecast,
    };
    mockSelectBestWindow
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(validWindow);

    // Re-import the module so createContextLogger is called again with our spy
    jest.resetModules();
    jest.doMock('@/lib/recommendations/selection', () => ({
      rankBeaches: jest.fn(async (items: unknown[]) => items),
    }));
    // Re-apply all mocks after resetModules
    jest.doMock('@/lib/logger', () => ({
      createContextLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: warnSpy,
        error: jest.fn(),
      })),
    }));
    jest.doMock('@/lib/services/discovery/window-selector', () => ({
      selectBestWindow: mockSelectBestWindow,
      selectBestWindows: (...args: any[]) => {
        const window = mockSelectBestWindow(...args);
        return window ? [window] : [];
      },
      getLocalDateStr: jest.fn((date: Date, _tz: string) => date.toISOString().split('T')[0]),
      getLocalHour: jest.fn((date: Date, _tz: string) => date.getUTCHours()),
    }));
    jest.doMock('@/lib/services/discovery/candidate-pool-builder', () => ({
      CANDIDATE_POOL_LIMIT: 60,
      MAX_CANDIDATE_RADIUS_MILES: 100,
      buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
    }));
    jest.doMock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
      batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
    }));
    jest.doMock('@/lib/services/discovery/response-formatter', () => ({
      enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
      generateDiscoverySummary: jest.fn(() => 'Good conditions'),
      getRecommendationLabel: jest.fn(() => 'Worth it'),
      getRecommendationLabelGated: jest.fn(() => 'Worth it'),
      buildDiscoveryMessage: jest.fn(() => 'Worth it — Good conditions'),
    }));
    jest.doMock('@/lib/services/preference-learning-service', () => ({
      getUserSurfPreferences: jest.fn(async () => null),
    }));
    jest.doMock('@/lib/services/beach-query-service', () => ({
      getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
    }));
    jest.doMock('@/lib/supabase/server', () => ({
      createSupabaseServiceRoleClient: jest.fn(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              in: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
            eq: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }));
    jest.doMock('@/lib/domains/scoring', () => ({
      createDiscoveryScoringEngine: jest.fn(() => ({
        score: jest.fn(() => ({
          total: 70,
          subscores: new Map(),
          reasons: [],
          warnings: [],
          skip: false,
          skipReason: null,
        })),
      })),
      beachToSpotProfile: jest.fn((beach) => ({
        beachId: beach?.id ?? 'mock-beach',
        swellWindow: { minDeg: 200, maxDeg: 320, centerDeg: 260, halfWidthDeg: 60 },
        windThresholds: { offshoreDeg: 90, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
        tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: 'either' },
        skillLevel: 'intermediate',
        breakType: 'beach',
      })),
      forecastToSnapshot: jest.fn(() => ({
        timestamp: new Date(),
        waveHeight: 3,
        wavePeriod: 10,
        waveDirection: 270,
        primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
        secondarySwell: null,
        windWave: null,
        wind: { speedMph: 5, directionDeg: 90 },
        tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
        confidence: 80,
        dataSource: 'NOAA_NWS',
      })),
      getConditionCharacter: jest.fn(() => ({ label: 'Clean', category: 'good-clean' })),
      scoreBeachWithEngine: jest.fn(() => ({
        total: 75,
        subscores: { waveHeightFit: 20, periodEnergyScore: 15, windAlignment: 15, tideFit: 12, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        matchQuality: 'excellent',
        reasons: ['Good wave size'],
        warnings: [],
        conditionBadges: [],
      })),
    }));
    jest.doMock('@/lib/utils/timezone-utils.server', () => ({
      getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
    }));
    jest.doMock('@/lib/services/discovery/personalization-layer', () => ({
      fetchPersonalizationContext: jest.fn(async () => ({
        implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), preferredBreakType: null, implicitWeight: 0,
      })),
      calculatePersonalizationBonus: jest.fn(() => ({ total: 0, affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    }));

    const { discoverSurfSpots: freshDiscover } = require('@/lib/services/discovery/surf-discovery-orchestrator');

    await freshDiscover(testUserId, { userLocation: defaultUserLocation });

    // When todayForecasts is empty (test uses 2024-dated rows that don't match
    // the runtime "today"), the orchestrator must: (a) still call selectBestWindow
    // once — directly against the full forecast set — and (b) warn only when that
    // tomorrow-fallback itself returns null.
    expect(mockSelectBestWindow).toHaveBeenCalledTimes(1);

    const warnCalls = warnSpy.mock.calls.map((args: any[]) => args[0]);
    const noTodayWarn = warnCalls.find((msg: string) =>
      typeof msg === 'string'
      && msg.includes('no today forecasts')
      && msg.includes('tomorrow fallback returned null')
    );
    expect(noTodayWarn).toEqual(expect.any(String));

    const staleFallbackWarn = warnCalls.find((msg: string) =>
      typeof msg === 'string' && msg.includes('falling back to all-day forecasts')
    );
    expect(staleFallbackWarn).toBeUndefined();
  });

  test('does NOT fall back to tomorrow when today has forecasts that fail window selection', async () => {
    // Regression for the 6:23 AM "Tomorrow's dawn patrol" bug: when today's
    // forecasts are present but selectBestWindow returns null (e.g. scores
    // below threshold), the orchestrator must drop the beach rather than
    // silently re-running selectBestWindow against the full forecast set,
    // which would let tomorrow's window win and flip the hero to "Tomorrow's".
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');
    const { createContextLogger } = require('@/lib/logger');

    const warnSpy = jest.fn();
    createContextLogger.mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: warnSpy,
      error: jest.fn(),
    });

    // Runtime "today" in the mocked getLocalDateStr is the UTC date of
    // new Date(). Build forecasts that land on today and tomorrow relative
    // to the test run so todayForecasts.length > 0.
    const now = new Date();
    const todayIso = now.toISOString();
    const tomorrowIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const todayForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: todayIso,
      forecast_date: todayIso.split('T')[0],
      forecast_time: '06:00:00',
      wave_height: '2.0',
      wave_period: '13s',
      wind_speed: '6',
      wind_direction_deg: 135,
      tide_status: 'Rising',
      data_source: 'CDIP',
    };
    const tomorrowForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: tomorrowIso,
      forecast_date: tomorrowIso.split('T')[0],
      forecast_time: '06:00:00',
      wave_height: '4.0',
      wave_period: '13s',
      wind_speed: '5',
      wind_direction_deg: 270,
      tide_status: 'Rising',
      data_source: 'CDIP',
    };

    mockState.forecastBatchResponse = {
      successful: [{ beach: mockBeach1, forecasts: [todayForecast, tomorrowForecast] }],
      failed: [],
      staleCount: 0,
    };

    // First call (today-only) returns null; a second call (full set) WOULD
    // return a tomorrow-dated window if the orchestrator incorrectly fell
    // back. The assertions below prove the second call never happens.
    // Reset first — the prior test in this suite left a queued return on
    // the shared mock that would otherwise leak into call #1 here.
    mockSelectBestWindow.mockReset();
    const tomorrowWindow = {
      start: new Date(tomorrowIso),
      end: new Date(new Date(tomorrowIso).getTime() + 3 * 60 * 60 * 1000),
      tide: 'Rising',
      wind: '5 mph W',
      waveHeight: '4 ft',
      wavePeriod: '13s',
      dataSource: 'CDIP',
      confidence: 85,
      timezone: 'America/Los_Angeles',
      sourceForecast: tomorrowForecast,
    };
    mockSelectBestWindow
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(tomorrowWindow);

    jest.resetModules();
    jest.doMock('@/lib/recommendations/selection', () => ({
      rankBeaches: jest.fn(async (items: unknown[]) => items),
    }));
    jest.doMock('@/lib/logger', () => ({
      createContextLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: warnSpy,
        error: jest.fn(),
      })),
    }));
    jest.doMock('@/lib/services/discovery/window-selector', () => ({
      selectBestWindow: mockSelectBestWindow,
      selectBestWindows: (...args: any[]) => {
        const window = mockSelectBestWindow(...args);
        return window ? [window] : [];
      },
      getLocalDateStr: jest.fn((date: Date, _tz: string) => date.toISOString().split('T')[0]),
      getLocalHour: jest.fn((date: Date, _tz: string) => date.getUTCHours()),
    }));
    jest.doMock('@/lib/services/discovery/candidate-pool-builder', () => ({
      CANDIDATE_POOL_LIMIT: 60,
      MAX_CANDIDATE_RADIUS_MILES: 100,
      buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
    }));
    jest.doMock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
      batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
    }));
    jest.doMock('@/lib/services/discovery/response-formatter', () => ({
      enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
      generateDiscoverySummary: jest.fn(() => 'Good conditions'),
      getRecommendationLabel: jest.fn(() => 'Worth it'),
      getRecommendationLabelGated: jest.fn(() => 'Worth it'),
      buildDiscoveryMessage: jest.fn(() => 'Worth it — Good conditions'),
    }));
    jest.doMock('@/lib/services/preference-learning-service', () => ({
      getUserSurfPreferences: jest.fn(async () => null),
    }));
    jest.doMock('@/lib/services/beach-query-service', () => ({
      getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
    }));
    jest.doMock('@/lib/supabase/server', () => ({
      createSupabaseServiceRoleClient: jest.fn(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              in: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
            eq: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }));
    jest.doMock('@/lib/domains/scoring', () => ({
      createDiscoveryScoringEngine: jest.fn(() => ({
        score: jest.fn(() => ({
          total: 70,
          subscores: new Map(),
          reasons: [],
          warnings: [],
          skip: false,
          skipReason: null,
        })),
      })),
      beachToSpotProfile: jest.fn((beach) => ({
        beachId: beach?.id ?? 'mock-beach',
        swellWindow: { minDeg: 200, maxDeg: 320, centerDeg: 260, halfWidthDeg: 60 },
        windThresholds: { offshoreDeg: 90, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
        tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: 'either' },
        skillLevel: 'intermediate',
        breakType: 'beach',
      })),
      forecastToSnapshot: jest.fn(() => ({
        timestamp: new Date(),
        waveHeight: 3,
        wavePeriod: 10,
        waveDirection: 270,
        primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
        secondarySwell: null,
        windWave: null,
        wind: { speedMph: 5, directionDeg: 90 },
        tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
        confidence: 80,
        dataSource: 'NOAA_NWS',
      })),
      getConditionCharacter: jest.fn(() => ({ label: 'Clean', category: 'good-clean' })),
      scoreBeachWithEngine: jest.fn(() => ({
        total: 75,
        subscores: { waveHeightFit: 20, periodEnergyScore: 15, windAlignment: 15, tideFit: 12, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        matchQuality: 'excellent',
        reasons: ['Good wave size'],
        warnings: [],
        conditionBadges: [],
      })),
    }));
    jest.doMock('@/lib/utils/timezone-utils.server', () => ({
      getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
    }));
    jest.doMock('@/lib/services/discovery/personalization-layer', () => ({
      fetchPersonalizationContext: jest.fn(async () => ({
        implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), preferredBreakType: null, implicitWeight: 0,
      })),
      calculatePersonalizationBonus: jest.fn(() => ({ total: 0, affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    }));

    const { discoverSurfSpots: freshDiscover } = require('@/lib/services/discovery/surf-discovery-orchestrator');
    const result = await freshDiscover(testUserId, { userLocation: defaultUserLocation });

    // selectBestWindow must have been called exactly ONCE (today-only).
    // A second call would mean the orchestrator reached for tomorrow's data.
    expect(mockSelectBestWindow).toHaveBeenCalledTimes(1);
    expect(mockSelectBestWindow.mock.calls[0][0]).toMatchObject({
      forecasts: [todayForecast],
      userSkillLevel: null,
    });

    // No recommendation should have leaked through from the tomorrow fallback.
    expect(result.recommendations).toEqual([]);

    // The obsolete "falling back to all-day forecasts" warning must not fire.
    const warnCalls = warnSpy.mock.calls.map((args: any[]) => args[0]);
    const staleFallbackWarn = warnCalls.find((msg: string) =>
      typeof msg === 'string' && msg.includes('falling back to all-day forecasts')
    );
    expect(staleFallbackWarn).toBeUndefined();
  });

  test('pre-sunset dead zone: falls through to tomorrow when today-only fails within MIN_SESSION_HOURS of sunset', async () => {
    // Reproduces the 19:21 PDT / sunset 19:31 dead zone on 2026-04-23:
    // today has forecasts (pre-sunset), but selectBestWindow rejects them all
    // because hoursUntilSunset < MIN_SESSION_HOURS (1.0h). The strict
    // `isPostSunsetForBeach` gate (now > sunset) didn't fire at 19:21, so
    // the orchestrator never reached for tomorrow and returned 0 recs.
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');

    // Fake "now" = 10 minutes before sunset. 19:21 PDT on 2026-04-23 == 02:21Z on 2026-04-24.
    const now = new Date('2026-04-24T02:21:00Z');
    const sunset = new Date('2026-04-24T02:31:00Z'); // 19:31 PDT, same local day
    jest.useFakeTimers().setSystemTime(now);

    const todayIso = now.toISOString();
    const tomorrowDawnIso = '2026-04-24T14:00:00.000Z'; // ~07:00 PDT next morning

    const todayForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: todayIso,
      forecast_date: todayIso.split('T')[0],
      forecast_time: '19:21:00',
      wave_height: '2.5',
      wave_period: '12s',
      wind_speed: '6',
      wind_direction_deg: 270,
      tide_status: 'Rising',
      data_source: 'CDIP',
    };
    const tomorrowForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: tomorrowDawnIso,
      forecast_date: tomorrowDawnIso.split('T')[0],
      forecast_time: '14:00:00',
      wave_height: '3.5',
      wave_period: '13s',
      wind_speed: '4',
      wind_direction_deg: 270,
      tide_status: 'Rising',
      data_source: 'CDIP',
    };

    mockState.forecastBatchResponse = {
      successful: [{ beach: mockBeach1, forecasts: [todayForecast, tomorrowForecast] }],
      failed: [],
      staleCount: 0,
    };

    // First call (today-only) returns null — window selector rejects all remaining
    // today forecasts for being too close to sunset.
    // Second call (full set, post-fix) returns the tomorrow dawn-patrol window.
    mockSelectBestWindow.mockReset();
    const tomorrowWindow = {
      start: new Date(tomorrowDawnIso),
      end: new Date(new Date(tomorrowDawnIso).getTime() + 3 * 60 * 60 * 1000),
      tide: 'Rising',
      wind: '4 mph W',
      waveHeight: '3-4 ft',
      wavePeriod: '13s',
      dataSource: 'CDIP',
      confidence: 88,
      timezone: 'America/Los_Angeles',
      sourceForecast: tomorrowForecast,
    };
    mockSelectBestWindow
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(tomorrowWindow);

    jest.resetModules();
    jest.doMock('@/lib/recommendations/selection', () => ({
      rankBeaches: jest.fn(async (items: unknown[]) => items),
    }));
    jest.doMock('@/lib/logger', () => ({
      createContextLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    }));
    jest.doMock('@/lib/services/discovery/window-selector', () => ({
      selectBestWindow: mockSelectBestWindow,
      selectBestWindows: (...args: any[]) => {
        const window = mockSelectBestWindow(...args);
        return window ? [window] : [];
      },
      getLocalDateStr: jest.fn((date: Date, _tz: string) => date.toISOString().split('T')[0]),
      getLocalHour: jest.fn((date: Date, _tz: string) => date.getUTCHours()),
      MIN_SESSION_HOURS: 1.0,
    }));
    jest.doMock('@/lib/services/discovery/candidate-pool-builder', () => ({
      CANDIDATE_POOL_LIMIT: 60,
      MAX_CANDIDATE_RADIUS_MILES: 100,
      buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
    }));
    jest.doMock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
      batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
    }));
    jest.doMock('@/lib/services/discovery/response-formatter', () => ({
      enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
      generateDiscoverySummary: jest.fn(() => 'Tomorrow looks better'),
      getRecommendationLabel: jest.fn(() => 'Worth it tomorrow'),
      getRecommendationLabelGated: jest.fn(() => 'Worth it tomorrow'),
      buildDiscoveryMessage: jest.fn(() => 'Worth it tomorrow — Tomorrow looks better'),
    }));
    jest.doMock('@/lib/services/preference-learning-service', () => ({
      getUserSurfPreferences: jest.fn(async () => null),
    }));
    jest.doMock('@/lib/services/beach-query-service', () => ({
      getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
    }));
    // Supabase mock: return a sun_times row for beach-1 so sunTimesCache.get(beach.id)
    // resolves to a sunset that matches `todayStr`, which is what drives the
    // "effectively over" gate.
    jest.doMock('@/lib/supabase/server', () => ({
      createSupabaseServiceRoleClient: jest.fn(() => ({
        from: jest.fn((table: string) => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              in: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: table === 'sun_times'
                    ? [{ beach_id: 'beach-1', sunrise_utc: '2026-04-23T13:07:00Z', sunset_utc: sunset.toISOString() }]
                    : [],
                  error: null,
                })),
              })),
            })),
            eq: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }));
    jest.doMock('@/lib/domains/scoring', () => ({
      createDiscoveryScoringEngine: jest.fn(() => ({
        score: jest.fn(() => ({
          total: 70,
          subscores: new Map(),
          reasons: [],
          warnings: [],
          skip: false,
          skipReason: null,
        })),
      })),
      beachToSpotProfile: jest.fn((beach) => ({
        beachId: beach?.id ?? 'mock-beach',
        swellWindow: { minDeg: 200, maxDeg: 320, centerDeg: 260, halfWidthDeg: 60 },
        windThresholds: { offshoreDeg: 90, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
        tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: 'either' },
        skillLevel: 'intermediate',
        breakType: 'beach',
      })),
      forecastToSnapshot: jest.fn(() => ({
        timestamp: new Date(),
        waveHeight: 3,
        wavePeriod: 10,
        waveDirection: 270,
        primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
        secondarySwell: null,
        windWave: null,
        wind: { speedMph: 5, directionDeg: 90 },
        tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
        confidence: 80,
        dataSource: 'NOAA_NWS',
      })),
      getConditionCharacter: jest.fn(() => ({ label: 'Clean', category: 'good-clean' })),
      scoreBeachWithEngine: jest.fn(() => ({
        total: 80,
        subscores: { waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 16, tideFit: 12, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        matchQuality: 'excellent',
        reasons: ['Dawn patrol'],
        warnings: [],
        conditionBadges: [],
      })),
    }));
    jest.doMock('@/lib/utils/timezone-utils.server', () => ({
      getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
    }));
    jest.doMock('@/lib/services/discovery/personalization-layer', () => ({
      fetchPersonalizationContext: jest.fn(async () => ({
        implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), preferredBreakType: null, implicitWeight: 0,
      })),
      calculatePersonalizationBonus: jest.fn(() => ({ total: 0, affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    }));

    try {
      const { discoverSurfSpots: freshDiscover } = require('@/lib/services/discovery/surf-discovery-orchestrator');
      const result = await freshDiscover(testUserId, { userLocation: defaultUserLocation });

      // Post-fix: selectBestWindow must have been called TWICE — first today-only
      // (null), then full set (tomorrow window) — because `todayIsEffectivelyOver`
      // fires when hoursUntilSunset < MIN_SESSION_HOURS.
      expect(mockSelectBestWindow).toHaveBeenCalledTimes(2);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].window.start.toISOString()).toBe(tomorrowDawnIso);
    } finally {
      jest.useRealTimers();
    }
  });

  test('wider dead zone: falls through when remaining today forecasts are all post-sunset (3hr cadence gap)', async () => {
    // The 17:52 PDT / sunset 19:30 case: hoursUntilSunset=1.6h (gate stays
    // closed under MIN_SESSION_HOURS=1.0h), but the only cached today slots
    // are 20:00 and 23:00 — both past sunset. Without the
    // `hasUsableTodayForecast` check, today returns null and tomorrow
    // fall-through never fires, leaving the home screen empty.
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');

    // Fake "now" = 17:52 PDT (1.6h before sunset).
    const now = new Date('2026-04-25T00:52:00Z'); // 17:52 PDT 2026-04-24
    const sunset = new Date('2026-04-25T02:30:00Z'); // 19:30 PDT 2026-04-24
    jest.useFakeTimers().setSystemTime(now);

    const todayPostSunset1Iso = '2026-04-25T03:00:00.000Z'; // 20:00 PDT today
    const todayPostSunset2Iso = '2026-04-25T06:00:00.000Z'; // 23:00 PDT today
    const tomorrowDawnIso = '2026-04-25T14:00:00.000Z'; // ~07:00 PDT next morning

    const todayPostSunset1: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: todayPostSunset1Iso,
      forecast_date: todayPostSunset1Iso.split('T')[0],
      forecast_time: '20:00:00',
      wave_height: '2.0', wave_period: '12s', wind_speed: '6',
      wind_direction_deg: 270, tide_status: 'Rising', data_source: 'CDIP',
    };
    const todayPostSunset2: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: todayPostSunset2Iso,
      forecast_date: todayPostSunset2Iso.split('T')[0],
      forecast_time: '23:00:00',
      wave_height: '2.0', wave_period: '12s', wind_speed: '6',
      wind_direction_deg: 270, tide_status: 'Rising', data_source: 'CDIP',
    };
    const tomorrowForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: tomorrowDawnIso,
      forecast_date: tomorrowDawnIso.split('T')[0],
      forecast_time: '07:00:00',
      wave_height: '3.5', wave_period: '13s', wind_speed: '4',
      wind_direction_deg: 270, tide_status: 'Rising', data_source: 'CDIP',
    };

    mockState.forecastBatchResponse = {
      successful: [{ beach: mockBeach1, forecasts: [todayPostSunset1, todayPostSunset2, tomorrowForecast] }],
      failed: [],
      staleCount: 0,
    };

    mockSelectBestWindow.mockReset();
    const tomorrowWindow = {
      start: new Date(tomorrowDawnIso),
      end: new Date(new Date(tomorrowDawnIso).getTime() + 3 * 60 * 60 * 1000),
      tide: 'Rising',
      wind: '4 mph W',
      waveHeight: '3-4 ft',
      wavePeriod: '13s',
      dataSource: 'CDIP',
      confidence: 88,
      timezone: 'America/Los_Angeles',
      sourceForecast: tomorrowForecast,
    };
    mockSelectBestWindow
      .mockReturnValueOnce(null) // today-only call
      .mockReturnValueOnce(tomorrowWindow); // full-set fall-through call

    jest.resetModules();
    jest.doMock('@/lib/recommendations/selection', () => ({
      rankBeaches: jest.fn(async (items: unknown[]) => items),
    }));
    jest.doMock('@/lib/logger', () => ({
      createContextLogger: jest.fn(() => ({
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
      })),
    }));
    jest.doMock('@/lib/services/discovery/window-selector', () => ({
      selectBestWindow: mockSelectBestWindow,
      selectBestWindows: (...args: any[]) => {
        const window = mockSelectBestWindow(...args);
        return window ? [window] : [];
      },
      getLocalDateStr: jest.fn((date: Date, _tz: string) => date.toISOString().split('T')[0]),
      getLocalHour: jest.fn((date: Date, _tz: string) => date.getUTCHours()),
      MIN_SESSION_HOURS: 1.0,
    }));
    jest.doMock('@/lib/services/discovery/candidate-pool-builder', () => ({
      CANDIDATE_POOL_LIMIT: 60,
      MAX_CANDIDATE_RADIUS_MILES: 100,
      buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
    }));
    jest.doMock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
      batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
    }));
    jest.doMock('@/lib/services/discovery/response-formatter', () => ({
      enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
      generateDiscoverySummary: jest.fn(() => 'Tomorrow looks better'),
      getRecommendationLabel: jest.fn(() => 'Worth it tomorrow'),
      getRecommendationLabelGated: jest.fn(() => 'Worth it tomorrow'),
      buildDiscoveryMessage: jest.fn(() => 'Worth it tomorrow — Tomorrow looks better'),
    }));
    jest.doMock('@/lib/services/preference-learning-service', () => ({
      getUserSurfPreferences: jest.fn(async () => null),
    }));
    jest.doMock('@/lib/services/beach-query-service', () => ({
      getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
    }));
    jest.doMock('@/lib/supabase/server', () => ({
      createSupabaseServiceRoleClient: jest.fn(() => ({
        from: jest.fn((table: string) => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              in: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: table === 'sun_times'
                    ? [{ beach_id: 'beach-1', sunrise_utc: '2026-04-24T13:07:00Z', sunset_utc: sunset.toISOString() }]
                    : [],
                  error: null,
                })),
              })),
            })),
            eq: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }));
    jest.doMock('@/lib/domains/scoring', () => ({
      createDiscoveryScoringEngine: jest.fn(() => ({
        score: jest.fn(() => ({
          total: 70,
          subscores: new Map(),
          reasons: [],
          warnings: [],
          skip: false,
          skipReason: null,
        })),
      })),
      beachToSpotProfile: jest.fn((beach) => ({
        beachId: beach?.id ?? 'mock-beach',
        swellWindow: { minDeg: 200, maxDeg: 320, centerDeg: 260, halfWidthDeg: 60 },
        windThresholds: { offshoreDeg: 90, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
        tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: 'either' },
        skillLevel: 'intermediate',
        breakType: 'beach',
      })),
      forecastToSnapshot: jest.fn(() => ({
        timestamp: new Date(),
        waveHeight: 3,
        wavePeriod: 10,
        waveDirection: 270,
        primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
        secondarySwell: null,
        windWave: null,
        wind: { speedMph: 5, directionDeg: 90 },
        tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
        confidence: 80,
        dataSource: 'NOAA_NWS',
      })),
      getConditionCharacter: jest.fn(() => ({ label: 'Clean', category: 'good-clean' })),
      scoreBeachWithEngine: jest.fn(() => ({
        total: 80,
        subscores: { waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 16, tideFit: 12, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        matchQuality: 'excellent',
        reasons: ['Dawn patrol'], warnings: [], conditionBadges: [],
      })),
    }));
    jest.doMock('@/lib/utils/timezone-utils.server', () => ({
      getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
    }));
    jest.doMock('@/lib/services/discovery/personalization-layer', () => ({
      fetchPersonalizationContext: jest.fn(async () => ({
        implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), preferredBreakType: null, implicitWeight: 0,
      })),
      calculatePersonalizationBonus: jest.fn(() => ({ total: 0, affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    }));

    try {
      const { discoverSurfSpots: freshDiscover } = require('@/lib/services/discovery/surf-discovery-orchestrator');
      const result = await freshDiscover(testUserId, { userLocation: defaultUserLocation });

      // Both calls must have happened: today-only (null), then full set
      // (tomorrow window) — driven by `hasUsableTodayForecast=false`.
      expect(mockSelectBestWindow).toHaveBeenCalledTimes(2);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].window.start.toISOString()).toBe(tomorrowDawnIso);
    } finally {
      jest.useRealTimers();
    }
  });

  test('wider dead zone with stale-cache: pre-sunset slot is in the past, gate must still open', async () => {
    // Defensive case: at 17:52 PDT today's cache contains an old 11:00 PDT
    // slot (still pre-sunset, but stale per window-selector's past tolerance)
    // plus the same post-sunset 20:00/23:00 slots. Without the past-tolerance
    // mirror, `hasUsableTodayForecast` would count 11:00 as usable and leave
    // the gate closed — yet `selectBestWindow` would reject 11:00 as stale,
    // returning null and producing an empty home. The fix's cutoff
    // (FORECAST_WINDOW_DURATION + PAST_WINDOW_TOLERANCE = 45min) excludes
    // 11:00 (~7h old) so the gate opens and tomorrow fall-through fires.
    const { selectBestWindow: mockSelectBestWindow } = require('@/lib/services/discovery/window-selector');

    const now = new Date('2026-04-25T00:52:00Z'); // 17:52 PDT 2026-04-24
    const sunset = new Date('2026-04-25T02:30:00Z'); // 19:30 PDT 2026-04-24
    jest.useFakeTimers().setSystemTime(now);

    const stalePreSunsetIso = '2026-04-24T18:00:00.000Z'; // 11:00 PDT today (stale)
    const todayPostSunsetIso = '2026-04-25T03:00:00.000Z'; // 20:00 PDT today
    const tomorrowDawnIso = '2026-04-25T14:00:00.000Z'; // ~07:00 PDT next morning

    const stalePreSunset: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: stalePreSunsetIso,
      forecast_date: stalePreSunsetIso.split('T')[0],
      forecast_time: '11:00:00',
      wave_height: '2.0', wave_period: '12s', wind_speed: '6',
      wind_direction_deg: 270, tide_status: 'Rising', data_source: 'CDIP',
    };
    const todayPostSunset: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: todayPostSunsetIso,
      forecast_date: todayPostSunsetIso.split('T')[0],
      forecast_time: '20:00:00',
      wave_height: '2.0', wave_period: '12s', wind_speed: '6',
      wind_direction_deg: 270, tide_status: 'Rising', data_source: 'CDIP',
    };
    const tomorrowForecast: Partial<EnhancedForecastEntity> = {
      beach_id: 'beach-1',
      forecast_at: tomorrowDawnIso,
      forecast_date: tomorrowDawnIso.split('T')[0],
      forecast_time: '07:00:00',
      wave_height: '3.5', wave_period: '13s', wind_speed: '4',
      wind_direction_deg: 270, tide_status: 'Rising', data_source: 'CDIP',
    };

    mockState.forecastBatchResponse = {
      successful: [{ beach: mockBeach1, forecasts: [stalePreSunset, todayPostSunset, tomorrowForecast] }],
      failed: [],
      staleCount: 0,
    };

    mockSelectBestWindow.mockReset();
    const tomorrowWindow = {
      start: new Date(tomorrowDawnIso),
      end: new Date(new Date(tomorrowDawnIso).getTime() + 3 * 60 * 60 * 1000),
      tide: 'Rising', wind: '4 mph W', waveHeight: '3-4 ft', wavePeriod: '13s',
      dataSource: 'CDIP', confidence: 88, timezone: 'America/Los_Angeles',
      sourceForecast: tomorrowForecast,
    };
    mockSelectBestWindow
      .mockReturnValueOnce(null) // today-only call (stale + post-sunset all rejected)
      .mockReturnValueOnce(tomorrowWindow); // full-set fall-through call

    jest.resetModules();
    jest.doMock('@/lib/recommendations/selection', () => ({
      rankBeaches: jest.fn(async (items: unknown[]) => items),
    }));
    jest.doMock('@/lib/logger', () => ({
      createContextLogger: jest.fn(() => ({
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
      })),
    }));
    jest.doMock('@/lib/services/discovery/window-selector', () => ({
      selectBestWindow: mockSelectBestWindow,
      selectBestWindows: (...args: any[]) => {
        const window = mockSelectBestWindow(...args);
        return window ? [window] : [];
      },
      getLocalDateStr: jest.fn((date: Date, _tz: string) => date.toISOString().split('T')[0]),
      getLocalHour: jest.fn((date: Date, _tz: string) => date.getUTCHours()),
      MIN_SESSION_HOURS: 1.0,
      FORECAST_WINDOW_DURATION_MINUTES: 30,
      PAST_WINDOW_TOLERANCE_MINUTES: 15,
    }));
    jest.doMock('@/lib/services/discovery/candidate-pool-builder', () => ({
      CANDIDATE_POOL_LIMIT: 60,
      MAX_CANDIDATE_RADIUS_MILES: 100,
      buildCandidatePool: jest.fn(async () => mockState.candidatePoolResponse),
    }));
    jest.doMock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
      batchFetchForecasts: jest.fn(async () => mockState.forecastBatchResponse),
    }));
    jest.doMock('@/lib/services/discovery/response-formatter', () => ({
      enrichWithPhotos: jest.fn(async (recs: any[]) => recs),
      generateDiscoverySummary: jest.fn(() => 'Tomorrow looks better'),
      getRecommendationLabel: jest.fn(() => 'Worth it tomorrow'),
      getRecommendationLabelGated: jest.fn(() => 'Worth it tomorrow'),
      buildDiscoveryMessage: jest.fn(() => 'Worth it tomorrow — Tomorrow looks better'),
    }));
    jest.doMock('@/lib/services/preference-learning-service', () => ({
      getUserSurfPreferences: jest.fn(async () => null),
    }));
    jest.doMock('@/lib/services/beach-query-service', () => ({
      getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
    }));
    jest.doMock('@/lib/supabase/server', () => ({
      createSupabaseServiceRoleClient: jest.fn(() => ({
        from: jest.fn((table: string) => ({
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              in: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: table === 'sun_times'
                    ? [{ beach_id: 'beach-1', sunrise_utc: '2026-04-24T13:07:00Z', sunset_utc: sunset.toISOString() }]
                    : [],
                  error: null,
                })),
              })),
            })),
            eq: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }));
    jest.doMock('@/lib/domains/scoring', () => ({
      createDiscoveryScoringEngine: jest.fn(() => ({
        score: jest.fn(() => ({
          total: 70,
          subscores: new Map(),
          reasons: [],
          warnings: [],
          skip: false,
          skipReason: null,
        })),
      })),
      beachToSpotProfile: jest.fn((beach) => ({
        beachId: beach?.id ?? 'mock-beach',
        swellWindow: { minDeg: 200, maxDeg: 320, centerDeg: 260, halfWidthDeg: 60 },
        windThresholds: { offshoreDeg: 90, offshoreTolDeg: 45, maxOnshoreMph: 10, maxAnyMph: 18 },
        tidePreferences: { preferredMinFt: 0, preferredMaxFt: 5, preferredDirection: 'either' },
        skillLevel: 'intermediate',
        breakType: 'beach',
      })),
      forecastToSnapshot: jest.fn(() => ({
        timestamp: new Date(),
        waveHeight: 3,
        wavePeriod: 10,
        waveDirection: 270,
        primarySwell: { heightFt: 3, periodS: 10, directionDeg: 270 },
        secondarySwell: null,
        windWave: null,
        wind: { speedMph: 5, directionDeg: 90 },
        tide: { heightFt: 2.5, status: 'rising', direction: 'rising' },
        confidence: 80,
        dataSource: 'NOAA_NWS',
      })),
      getConditionCharacter: jest.fn(() => ({ label: 'Clean', category: 'good-clean' })),
      scoreBeachWithEngine: jest.fn(() => ({
        total: 80,
        subscores: { waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 16, tideFit: 12, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
        matchQuality: 'excellent',
        reasons: ['Dawn patrol'], warnings: [], conditionBadges: [],
      })),
    }));
    jest.doMock('@/lib/utils/timezone-utils.server', () => ({
      getTimezoneFromCoords: jest.fn(() => 'America/Los_Angeles'),
    }));
    jest.doMock('@/lib/services/discovery/personalization-layer', () => ({
      fetchPersonalizationContext: jest.fn(async () => ({
        implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), preferredBreakType: null, implicitWeight: 0,
      })),
      calculatePersonalizationBonus: jest.fn(() => ({ total: 0, affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    }));

    try {
      const { discoverSurfSpots: freshDiscover } = require('@/lib/services/discovery/surf-discovery-orchestrator');
      const result = await freshDiscover(testUserId, { userLocation: defaultUserLocation });

      // Past-tolerance mirror should have excluded the 11:00 PDT slot, so
      // hasUsableTodayForecast=false → gate opens → fall-through fires.
      expect(mockSelectBestWindow).toHaveBeenCalledTimes(2);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].window.start.toISOString()).toBe(tomorrowDawnIso);
    } finally {
      jest.useRealTimers();
    }
  });
});
