/**
 * Unit tests for surf-discovery-orchestrator similarity evidence ordering.
 *
 * Pin invariants:
 *   1. applySimilarityLayer runs over the FULL allRecs pool, not the post-slice
 *      maxResults subset so every candidate window can receive match evidence.
 *   2. Similarity never mutates the physical score or cross-beach ranking.
 *   3. The final maxResults slice still happens after window candidates collapse.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

const candidateBeaches: Partial<Beach>[] = [
  { id: 'beach-1', name: 'Alpha', slug: 'alpha', lat: 32.7, lon: -117.1, skill_level: 'intermediate', is_private: false },
  { id: 'beach-2', name: 'Bravo', slug: 'bravo', lat: 32.71, lon: -117.11, skill_level: 'intermediate', is_private: false },
  { id: 'beach-3', name: 'Charlie', slug: 'charlie', lat: 32.72, lon: -117.12, skill_level: 'intermediate', is_private: false },
  { id: 'beach-4', name: 'Delta', slug: 'delta', lat: 32.73, lon: -117.13, skill_level: 'intermediate', is_private: false },
  { id: 'beach-5', name: 'Echo', slug: 'echo', lat: 32.74, lon: -117.14, skill_level: 'intermediate', is_private: false },
  { id: 'beach-6', name: 'Foxtrot', slug: 'foxtrot', lat: 32.75, lon: -117.15, skill_level: 'intermediate', is_private: false },
];

// Per-beach base score table the scoring engine mock will return.
// beach-6 is rank #6 by physical score and the only learned personal match.
const mockBaseScores: Record<string, number> = {
  'beach-1': 75,
  'beach-2': 74,
  'beach-3': 73,
  'beach-4': 72,
  'beach-5': 71,
  'beach-6': 60,
};

// Per-beach similarity config the mocked applySimilarityLayer will attach.
type SimConfig = { score: number } | null;
const simByBeach: Record<string, SimConfig> = {
  'beach-1': null,
  'beach-2': null,
  'beach-3': null,
  'beach-4': null,
  'beach-5': null,
  'beach-6': { score: 10 },
};

const mockForecast: Partial<EnhancedForecastEntity> = {
  beach_id: 'beach-1',
  forecast_at: '2026-07-08T15:00:00Z',
  forecast_date: '2026-07-08',
  forecast_time: '15:00:00',
  wave_height: '3.5',
  wave_period: '12s',
  wind_speed: '8',
  wind_direction_deg: 270,
  tide_status: 'Rising',
  data_source: 'CDIP',
};

// ============================================================================
// Mocks (shape-compatible with the main orchestrator test)
// ============================================================================

jest.mock('@/lib/services/discovery/candidate-pool-builder', () => ({
  CANDIDATE_POOL_LIMIT: 20,
  MAX_CANDIDATE_RADIUS_MILES: 100,
  buildCandidatePool: jest.fn(async () => ({
    candidates: candidateBeaches as Beach[],
    preferredWaveSize: null,
    userSkillLevel: null,
    preferredBreakType: null,
  })),
}));

jest.mock('@/lib/recommendations/selection', () => ({
  rankBeaches: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
}));

jest.mock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
  batchFetchForecasts: jest.fn(async () => ({
    successful: candidateBeaches.map((b) => ({
      beach: b,
      forecasts: [{ ...mockForecast, beach_id: b.id }],
    })),
    failed: [],
    staleCount: 0,
  })),
}));

jest.mock('@/lib/services/discovery/window-selector', () => {
  const selectBestWindow = jest.fn(() => ({
    start: new Date('2026-07-08T15:00:00Z'),
    end: new Date('2026-07-08T18:00:00Z'),
    tide: 'Rising',
    wind: '8 mph W',
    waveHeight: '3-4 ft',
    wavePeriod: '12s',
    dataSource: 'CDIP',
    confidence: 85,
    timezone: 'America/Los_Angeles',
  }));

  return {
    selectBestWindow,
    selectBestWindows: jest.fn(() => {
      const window = selectBestWindow();
      return window ? [window] : [];
    }),
    getLocalDateStr: jest.fn((date: Date) => date.toISOString().split('T')[0]),
    getLocalHour: jest.fn((date: Date) => date.getUTCHours()),
    MIN_SESSION_HOURS: 1,
    FORECAST_WINDOW_DURATION_MINUTES: 180,
    PAST_WINDOW_TOLERANCE_MINUTES: 60,
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
  getUserSurfPreferences: jest.fn(async () => null),
}));

jest.mock('@/lib/services/beach-query-service', () => ({
  getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: jest.fn(() => ({
          in: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
    rpc: jest.fn(),
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

jest.mock('@/lib/domains/scoring', () => ({
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
  scoreBeachWithEngine: jest.fn((_engine: any, beach: Beach) => ({
    total: mockBaseScores[beach.id] ?? 70,
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 12,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    matchQuality: 'good',
    reasons: ['Good conditions'],
    warnings: [],
    conditionBadges: [],
  })),
  beachToSpotProfile: jest.fn((beach: any) => ({
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

jest.mock('@/lib/scoring/native-condition-score', () => ({
  scoreNativeForecastSlot: jest.fn((forecast: EnhancedForecastEntity) => (
    mockBaseScores[forecast.beach_id] ?? 70
  )),
  getNativeConditionMatchQuality: jest.fn(() => 'good'),
}));

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
    avoidancePenalty: 0,
    reasons: [],
  })),
}));

// Inline mock for the similarity layer captures the input array length and
// attaches learned evidence without mutating recommendation.score.
const applySimilarityLayerMock = jest.fn();
jest.mock('@/lib/services/discovery/similarity-layer', () => ({
  applySimilarityLayer: (args: { recommendations: SurfDiscoveryRecommendation[]; isPro: boolean }) =>
    applySimilarityLayerMock(args),
}));

// Import after mocks
import { discoverSurfSpots } from '@/lib/services/discovery/surf-discovery-orchestrator';
import { calculatePersonalizationBonus } from '@/lib/services/discovery/personalization-layer';

const calculatePersonalizationBonusMock =
  calculatePersonalizationBonus as jest.MockedFunction<typeof calculatePersonalizationBonus>;

describe('discoverSurfSpots — personal match evidence stays separate from physical score', () => {
  const userLocation = { lat: 32.7, lon: -117.1 };

  beforeEach(() => {
    jest.clearAllMocks();
    calculatePersonalizationBonusMock.mockImplementation(() => ({
      total: 0,
      affinityBonus: 0,
      personalizationBonus: 0,
      avoidancePenalty: 0,
      reasons: [],
    }));
    applySimilarityLayerMock.mockImplementation(
      async ({ recommendations }: { recommendations: SurfDiscoveryRecommendation[] }) => ({
        recommendations: recommendations.map((rec) => {
          const sim = simByBeach[rec.beach.id];
          if (!sim) return { ...rec, similarity: null };
          return {
            ...rec,
            similarity: {
              state: 'ready' as const,
              score: sim.score,
              label: 'EPIC',
              bonusApplied: 0,
              confidence: 'high' as const,
              reason: 'Matches your style',
              reasons: ['Matches your style'],
              sessionCount: 20,
            },
          };
        }),
      }),
    );
  });

  it('similarity layer receives the FULL candidate pool, not just maxResults', async () => {
    await discoverSurfSpots('user-pro', { userLocation, maxResults: 5, isPro: true });

    expect(applySimilarityLayerMock).toHaveBeenCalledTimes(1);
    const args = applySimilarityLayerMock.mock.calls[0][0];
    // 6 candidates went in, all 6 must reach the layer.
    expect(args.recommendations).toHaveLength(6);
    expect(args.isPro).toBe(true);
  });

  it('does not let a learned match mutate physical score or cross-beach ranking', async () => {
    const result = await discoverSurfSpots('user-pro', {
      userLocation,
      maxResults: 5,
      isPro: true,
    });

    const ids = result.recommendations.map((r) => r.beach.id);
    expect(ids).not.toContain('beach-6');
    expect(ids).toEqual([
      'beach-1',
      'beach-2',
      'beach-3',
      'beach-4',
      'beach-5',
    ]);
    const scoredBeach6 = applySimilarityLayerMock.mock.results[0].value;
    await expect(scoredBeach6).resolves.toEqual(expect.objectContaining({
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          beach: expect.objectContaining({ id: 'beach-6' }),
          score: 60,
          similarity: expect.objectContaining({
            state: 'ready',
            score: 10,
            bonusApplied: 0,
          }),
        }),
      ]),
    }));
  });

  it('returns exactly maxResults entries after evidence attachment and collapse', async () => {
    const result = await discoverSurfSpots('user-pro', {
      userLocation,
      maxResults: 5,
      isPro: true,
    });

    expect(result.recommendations).toHaveLength(5);
  });

  it('unmatched beaches keep similarity:null and their physical score unchanged', async () => {
    const result = await discoverSurfSpots('user-pro', {
      userLocation,
      maxResults: 5,
      isPro: true,
    });

    const beach1 = result.recommendations.find((r) => r.beach.id === 'beach-1');
    expect(beach1?.score).toBe(75);
    expect(beach1?.similarity).toBeNull();
  });

  it('free user (isPro:false) keeps physical fallback ranking', async () => {
    // Re-implement the layer mock to mirror real free-path behavior.
    applySimilarityLayerMock.mockImplementation(
      async ({ recommendations }: { recommendations: SurfDiscoveryRecommendation[] }) => ({
        recommendations: recommendations.map((rec) => ({ ...rec, similarity: null })),
      }),
    );

    const result = await discoverSurfSpots('user-free', {
      userLocation,
      maxResults: 5,
      isPro: false,
    });

    expect(applySimilarityLayerMock.mock.calls[0][0].isPro).toBe(false);
    // Base-rank top 5 only — beach-6 (base 60) is correctly outside top 5.
    const ids = result.recommendations.map((r) => r.beach.id);
    expect(ids).not.toContain('beach-6');
    expect(result.recommendations).toHaveLength(5);
  });

  it('applies negative personalization as a demotion without removing the beach', async () => {
    applySimilarityLayerMock.mockImplementation(
      async ({ recommendations }: { recommendations: SurfDiscoveryRecommendation[] }) => ({
        recommendations: recommendations.map((rec) => ({ ...rec, similarity: null })),
      }),
    );
    calculatePersonalizationBonusMock.mockImplementation((beach) =>
      beach.id === 'beach-1'
        ? {
            total: -6,
            affinityBonus: 0,
            personalizationBonus: -6,
            avoidancePenalty: 6,
            reasons: [],
          }
        : {
            total: 0,
            affinityBonus: 0,
            personalizationBonus: 0,
            avoidancePenalty: 0,
            reasons: [],
          }
    );

    const result = await discoverSurfSpots('user-free', {
      userLocation,
      maxResults: 5,
      isPro: false,
    });

    const ids = result.recommendations.map((r) => r.beach.id);
    const beach1 = result.recommendations.find((r) => r.beach.id === 'beach-1');

    expect(ids).toContain('beach-1');
    expect(ids.indexOf('beach-2')).toBeLessThan(ids.indexOf('beach-1'));
    // The demotion is a ranking effect. The displayed condition score is
    // unchanged at 75 — which is what this suite's title has always claimed:
    // personal-match evidence stays separate from the physical score.
    expect(beach1?.score).toBe(75);
    expect(beach1!.rankingScore!).toBeLessThan(beach1!.score);
    expect(beach1?.subscores.personalizationBonus).toBe(-6);
  });
});
