/** Regression: Now and scoped calls share the daylight session gate. */

import * as windowScorer from '@/lib/services/discovery/window-selector/window-scorer';
import pontoSnapshot from '@/__tests__/fixtures/ponto-now-window-20260911.json';
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
  userSkillLevel: 'intermediate' as 'intermediate' | null,
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

jest.mock('@/lib/services/discovery/window-selector/window-scorer', () => {
  const actual = jest.requireActual('@/lib/services/discovery/window-selector/window-scorer');
  return { ...actual, scoreWindowConditionScore: jest.fn(actual.scoreWindowConditionScore) };
});

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
    userSkillLevel: mockState.userSkillLevel,
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

function forecastAtLocal(
  id: string,
  forecastAtUtc: string,
  forecastDate: string,
  forecastTime: string,
): Partial<EnhancedForecastEntity> {
  return {
    ...forecastAt(id, forecastAtUtc),
    forecast_date: forecastDate,
    forecast_time: `${forecastTime}:00`,
  };
}

async function discoverNow() {
  return discoverSurfSpots(USER_ID, {
    userLocation: USER_LOCATION,
    discoveryMode: 'now',
    maxResults: 5,
  });
}

async function discoverScoped(forecastAt: string) {
  return discoverSurfSpots(USER_ID, {
    userLocation: USER_LOCATION,
    forecastAt,
    maxResults: 5,
  });
}

describe('discoverSurfSpots - now mode uses scoped-call daylight rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockState.sunTimeRows = SUN_TIME_ROWS;
    mockState.userSkillLevel = 'intermediate';
  });

  afterEach(() => {
    jest.useRealTimers();
  });
  it('accepts a pre-sunrise bucket when its interval overlaps first light', async () => {
    // 05:55 PDT on 2026-04-15; the bucket runs 05:00–08:00 and first light is 05:51.
    jest.setSystemTime(new Date('2026-04-15T12:55:00.000Z'));
    mockState.forecasts = [
      forecastAtLocal('dawn-bucket', '2026-04-15T12:00:00.000Z', '2026-04-15', '05:00'),
      forecastAtLocal('morning-bucket', '2026-04-15T15:00:00.000Z', '2026-04-15', '08:00'),
    ];

    const result = await discoverNow();

    expect(result.recommendations[0]?.forecast.id).toBe('dawn-bucket');
  });
  it('returns an after-dark reason and next first light for a dark active bucket', async () => {
    jest.setSystemTime(new Date('2026-04-16T05:00:00Z')); // 22:00 PDT
    mockState.forecasts = [
      forecastAtLocal('evening', '2026-04-16T04:00:00Z', '2026-04-15', '21:00'),
      forecastAtLocal('night', '2026-04-16T06:00:00Z', '2026-04-15', '23:00'),
    ];
    const result = await discoverNow();
    expect(result.recommendations).toEqual([]);
    expect(result.daylightAvailability).toMatchObject({ reasonCode: 'after_dark' });
    expect(result.daylightAvailability?.nextWindowStart).toBe('2026-04-16T13:00:00.000Z');
  });
  it('does not promote a dark current row when later good rows extend through dawn', async () => {
    jest.setSystemTime(new Date('2026-04-16T09:00:00Z')); // 02:00 PDT
    mockState.forecasts = ['02:00', '03:00', '04:00', '05:00', '06:00'].map((time) =>
      forecastAtLocal(
        time,
        `2026-04-16T${String(Number(time.slice(0, 2)) + 7).padStart(2, '0')}:00:00Z`,
        '2026-04-16',
        time,
      ),
    );

    const result = await discoverNow();

    expect(result.recommendations).toEqual([]);
    expect(result.daylightAvailability).toMatchObject({ reasonCode: 'after_dark' });
  });
  it('returns after-dark when no forecast bucket covers the dark current time', async () => {
    jest.setSystemTime(new Date('2026-04-16T05:00:00Z')); // 22:00 PDT
    mockState.forecasts = [];

    const result = await discoverNow();

    expect(result.recommendations).toEqual([]);
    expect(result.daylightAvailability).toMatchObject({
      reasonCode: 'after_dark',
      nextWindowStart: '2026-04-16T13:00:00.000Z',
    });
  });
  it('returns after-dark guidance for a scoped call at a dark forecast hour', async () => {
    const forecastAt = '2026-04-16T09:00:00.000Z'; // 02:00 PDT
    jest.setSystemTime(new Date(forecastAt));
    mockState.forecasts = ['02:00', '03:00', '04:00', '05:00', '06:00'].map((time) =>
      forecastAtLocal(
        `scoped-${time}`,
        `2026-04-16T${String(Number(time.slice(0, 2)) + 7).padStart(2, '0')}:00:00Z`,
        '2026-04-16',
        time,
      ),
    );

    const result = await discoverScoped(forecastAt);

    expect(result.recommendations).toEqual([]);
    expect(result.daylightAvailability).toMatchObject({
      reasonCode: 'after_dark',
      nextWindowStart: '2026-04-16T13:00:00.000Z',
    });
  });
  it('keeps a sunset-edge active bucket through the last-light allowance', async () => {
    jest.setSystemTime(new Date('2026-04-16T01:45:00Z')); // 18:45 PDT
    mockState.forecasts = [
      forecastAtLocal('evening', '2026-04-16T01:00:00Z', '2026-04-15', '18:00'),
      forecastAtLocal('night', '2026-04-16T04:00:00Z', '2026-04-15', '21:00'),
    ];
    const result = await discoverNow();
    expect(result.recommendations[0]?.forecast.id).toBe('evening');
    expect(result.recommendations[0]?.window.end).toEqual(new Date('2026-04-16T02:51:00Z'));
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
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T02:51:00.000Z'));
  });
  it('keeps equally suitable forecasts open beyond the next data timestamp', async () => {
    jest.setSystemTime(new Date('2026-04-15T16:57:00Z'));
    mockState.forecasts = [15, 18, 21, 24].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 15, hour)).toISOString()));
    const result = await discoverNow();
    const rec = result.recommendations[0];
    expect(rec.forecast.id).toBe('hour-15');
    expect(rec.window.start).toEqual(new Date('2026-04-15T15:00:00Z'));
    expect(rec.window.end).toEqual(new Date('2026-04-16T00:00:00Z'));
    expect(rec.window.peakTime).toEqual(new Date('2026-04-15T16:57:00Z'));
  });
  it.each([
    { wave_height: '0.2' },
    { wind_speed: '35' },
    { wave_height: null },
    { wind_speed: null },
    { wave_period: null },
  ])('stops at deterioration or missing conditions: %j', async (change) => {
    jest.setSystemTime(new Date('2026-04-15T16:57:00Z'));
    mockState.forecasts = [15, 18, 21, 24].map((hour) => ({
      ...forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 15, hour)).toISOString()),
      ...(hour === 21 ? change : {}),
    }));
    const result = await discoverNow();
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-15T21:00:00Z'));
    expect(result.recommendations[0].forecast.id).toBe('hour-15');
  });
  it('uses actual irregular timestamps and stops before an uncovered gap', async () => {
    jest.setSystemTime(new Date('2026-04-15T16:57:00Z'));
    mockState.forecasts = ['15:00', '16:30', '18:45', '23:30'].map((time) =>
      forecastAt(time, `2026-04-15T${time}:00Z`));
    const result = await discoverNow();
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-15T18:45:00Z'));
  });
  it('does not select a later good session when the current conditions are poor', async () => {
    jest.setSystemTime(new Date('2026-04-15T16:57:00Z'));
    mockState.forecasts = [15, 18, 21].map((hour) => ({
      ...forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 15, hour)).toISOString()),
      ...(hour === 15 ? { wave_height: '0.2' } : {}),
    }));
    const result = await discoverNow();
    expect(result.recommendations[0].forecast.id).toBe('hour-15');
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-15T18:00:00Z'));
  });
  it('caps an extended run at last light instead of the next forecast boundary', async () => {
    jest.setSystemTime(new Date('2026-04-16T00:30:00Z'));
    mockState.forecasts = [0, 1, 2, 3, 4].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 16, hour)).toISOString()));
    const result = await discoverNow();
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T02:51:00Z'));
  });
  it('does not extend a night reading into the next beach-local day', async () => {
    jest.setSystemTime(new Date('2026-04-16T04:30:00Z'));
    mockState.forecasts = [3, 6, 9, 12].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 16, hour)).toISOString()));
    const result = await discoverNow();
    expect(result.recommendations).toEqual([]);
  });
  it.each([15, 16])('lets matching consecutive-day forecasts repeat a supported end on April %s', async (day) => {
    jest.setSystemTime(new Date(Date.UTC(2026, 3, day, 16, 57)));
    mockState.forecasts = [15, 18, 21].map((hour) => ({
      ...forecastAt(`day-${day}-hour-${hour}`, new Date(Date.UTC(2026, 3, day, hour)).toISOString()),
      ...(hour === 21 ? { wave_height: '0.2' } : {}),
    }));
    const result = await discoverNow();
    expect(result.recommendations[0].window.end).toEqual(new Date(Date.UTC(2026, 3, day, 21)));
  });

  it.each(pontoSnapshot.cases)('preserves the supported Ponto window at $now', async (expected) => {
    jest.setSystemTime(new Date(expected.now));
    mockState.forecasts = pontoSnapshot.rows.map((row) => ({ ...row, beach_id: 'beach-1' }));
    mockState.sunTimeRows = [];
    const result = await discoverNow();
    const rec = result.recommendations[0];
    expect(rec.score).toBe(expected.score);
    expect(new Date(rec.forecast.forecast_at)).toEqual(new Date(expected.start));
    expect(JSON.parse(JSON.stringify(rec.window))).toMatchObject({
      start: expected.start, end: expected.end, peakTime: expected.now, timezone: BEACH_TZ,
    });
  });

  it('uses the displayed default skill score when deciding the current rating window', async () => {
    jest.setSystemTime(new Date('2026-04-15T16:57:00Z'));
    mockState.userSkillLevel = null;
    mockState.forecasts = [15, 18, 21].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 15, hour)).toISOString()));
    const result = await discoverNow();
    expect(result.recommendations[0].window.score).toBe(result.recommendations[0].score);
  });

  it('honors the shared scorer decision ceiling at the next affected forecast', async () => {
    jest.setSystemTime(new Date('2026-04-15T16:57:00Z'));
    mockState.forecasts = [15, 18, 21, 24].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 15, hour)).toISOString()));
    const originalScore = jest.requireActual<typeof windowScorer>(
      '@/lib/services/discovery/window-selector/window-scorer',
    ).scoreWindowConditionScore;
    const scorer = jest.mocked(windowScorer.scoreWindowConditionScore).mockImplementation((forecast, ...args) =>
      forecast.id === 'hour-21' ? 0 : originalScore(forecast, ...args));
    try {
      const result = await discoverNow();
      expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-15T21:00:00Z'));
    } finally {
      scorer.mockImplementation(originalScore);
    }
  });

});
