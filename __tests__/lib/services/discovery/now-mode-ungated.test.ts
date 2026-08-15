/**
 * Regression tests for the "NOW" discovery mode daylight gate.
 *
 * NOW means now: a surfer checking at 5:55 AM or at 10 PM still needs the
 * current reading. Two gates used to suppress it outside a 6am-9pm band:
 *   1. an explicit local-hour/daylight check in selectImmediateWindow
 *   2. an unconditional sunset trim that collapsed the window to <= now
 *      after dark, which the caller reads as "no window"
 *
 * Unlike the main orchestrator suite, this file uses the REAL window-selector
 * time helpers so "05:55 local" means 05:55 in the beach timezone rather than
 * in UTC.
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const BEACH_TZ = 'America/Los_Angeles';

// San Diego, 2026-04-15 (PDT = UTC-7): sunrise 06:21, sunset 19:31.
const SUN_TIME_ROWS = [
  {
    beach_id: 'beach-1',
    sunrise_utc: '2026-04-14T13:23:00.000Z', // 06:23 PDT Apr 14
    sunset_utc: '2026-04-15T02:30:00.000Z', // 19:30 PDT Apr 14
  },
  {
    beach_id: 'beach-1',
    sunrise_utc: '2026-04-15T13:21:00.000Z', // 06:21 PDT Apr 15
    sunset_utc: '2026-04-16T02:31:00.000Z', // 19:31 PDT Apr 15
  },
];

const mockBeach: Partial<Beach> = {
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

const mockState = {
  forecasts: [] as Partial<EnhancedForecastEntity>[],
  sunTimeRows: SUN_TIME_ROWS as Array<Record<string, unknown>>,
};

/**
 * Chainable thenable that ignores filters and resolves to the rows configured
 * for its table. Discovery only reads from these tables, so per-table fixtures
 * are enough — the assertions here are about window selection, not queries.
 */
function makeQuery(rows: unknown[]): unknown {
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'then') {
          return (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data: rows, error: null }));
        }
        return () => chain;
      },
    }
  );
  return chain;
}

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'sun_times') return makeQuery(mockState.sunTimeRows);
      if (table === 'county_beach_advisory_runs') {
        return makeQuery([
          {
            id: 'county-run-now-mode',
            fetched_at: new Date().toISOString(),
            status: 'completed',
            source_identifier: 'county-san-diego-dehq-sdbeachinfo',
          },
        ]);
      }
      return makeQuery([]);
    }),
    rpc: jest.fn(async () => ({ data: [], error: null })),
  })),
}));

jest.mock('@/lib/services/discovery/candidate-pool-builder', () => ({
  CANDIDATE_POOL_LIMIT: 60,
  MAX_CANDIDATE_RADIUS_MILES: 100,
  buildCandidatePool: jest.fn(async () => ({
    candidates: [mockBeach],
    preferredWaveSize: null,
    userSkillLevel: null,
    preferredBreakType: null,
  })),
}));

jest.mock('@/lib/services/discovery/forecast-batch-fetcher', () => ({
  batchFetchForecasts: jest.fn(async () => ({
    successful: [{ beach: mockBeach, forecasts: mockState.forecasts }],
    failed: [],
    staleCount: 0,
  })),
}));

jest.mock('@/lib/services/discovery/response-formatter', () => ({
  enrichWithPhotos: jest.fn(async (recs: unknown[]) => recs),
  generateDiscoverySummary: jest.fn(() => 'Good conditions'),
  getRecommendationLabel: jest.fn(() => 'Worth it'),
  getRecommendationLabelGated: jest.fn(() => 'Worth it'),
  buildDiscoveryMessage: jest.fn(() => 'Worth it — Good conditions'),
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

jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: jest.fn(async () => null),
}));

jest.mock('@/lib/services/beach-query-service', () => ({
  getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/lib/utils/timezone-utils.server', () => ({
  getTimezoneFromCoords: jest.fn(() => BEACH_TZ),
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
      total: 75,
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
    reasons: ['Good wave size'],
    warnings: [],
    conditionBadges: [],
  })),
  beachToSpotProfile: jest.fn((beach: { id?: string } | null) => ({
    beachId: beach?.id ?? 'beach-1',
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

// Import after mocks
import { discoverSurfSpots } from '@/lib/services/discovery/surf-discovery-orchestrator';

const USER_ID = 'test-user-now';
const USER_LOCATION = { lat: 32.7157, lon: -117.1611 };

function forecastAt(id: string, iso: string): Partial<EnhancedForecastEntity> {
  return {
    id,
    beach_id: 'beach-1',
    forecast_at: iso,
    forecast_date: iso.split('T')[0],
    forecast_time: iso.split('T')[1].slice(0, 8),
    wave_height: '3.5',
    wave_period: '12s',
    wind_speed: '8',
    wind_direction: 'W',
    wind_direction_deg: 270,
    tide_status: 'Rising',
    data_source: 'CDIP',
    confidence_score: 85,
  } as Partial<EnhancedForecastEntity>;
}

async function discoverNow() {
  return discoverSurfSpots(USER_ID, {
    userLocation: USER_LOCATION,
    discoveryMode: 'now',
    maxResults: 5,
  });
}

describe('discoverSurfSpots - now mode is not daylight-gated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockState.sunTimeRows = SUN_TIME_ROWS;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current bucket before 6am local (dawn patrol)', async () => {
    // 05:55 PDT on 2026-04-15, ~26 min before sunrise.
    jest.setSystemTime(new Date('2026-04-15T12:55:00.000Z'));
    mockState.forecasts = [
      forecastAt('dawn-bucket', '2026-04-15T12:00:00.000Z'), // 05:00 PDT
      forecastAt('morning-bucket', '2026-04-15T15:00:00.000Z'), // 08:00 PDT
    ];

    const result = await discoverNow();

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].forecast.id).toBe('dawn-bucket');
    expect(result.recommendations[0].window.start).toEqual(new Date('2026-04-15T12:00:00.000Z'));
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-15T15:00:00.000Z'));
  });

  it('returns the current bucket after sunset (10pm local)', async () => {
    // 22:00 PDT on 2026-04-15, ~2.5h after the 19:31 sunset.
    jest.setSystemTime(new Date('2026-04-16T05:00:00.000Z'));
    mockState.forecasts = [
      forecastAt('night-bucket', '2026-04-16T03:00:00.000Z'), // 20:00 PDT
      forecastAt('late-bucket', '2026-04-16T06:00:00.000Z'), // 23:00 PDT
    ];

    const result = await discoverNow();

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].forecast.id).toBe('night-bucket');
    // The sunset trim must not fire once sunset is in the past; trimming here
    // would push end (06:00Z) back to 02:31Z, i.e. before now.
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T06:00:00.000Z'));
  });

  it('still trims the window end at sunset while sunset is ahead', async () => {
    // 18:30 PDT on 2026-04-15, one hour before the 19:31 sunset.
    jest.setSystemTime(new Date('2026-04-16T01:30:00.000Z'));
    mockState.forecasts = [
      forecastAt('evening-bucket', '2026-04-16T01:00:00.000Z'), // 18:00 PDT
      forecastAt('post-sunset-bucket', '2026-04-16T04:00:00.000Z'), // 21:00 PDT
    ];

    const result = await discoverNow();

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].forecast.id).toBe('evening-bucket');
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T02:31:00.000Z'));
  });
});
