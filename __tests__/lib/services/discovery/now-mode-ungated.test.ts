/** @jest-environment node */
jest.mock('@/lib/middleware/api-wrappers', () => {
  const actual = jest.requireActual('@/lib/middleware/api-wrappers');
  return { ...actual, withAuth: (handler: (request: Request, context: unknown) => unknown) => (request: Request) => handler(request, {
    user: { id: 'test-user' }, params: {}, supabase: require('@/lib/supabase/server').createSupabaseServiceRoleClient(),
  }), withRateLimit: (handler: unknown) => handler };
});
jest.mock('@/lib/services/forecast/v5-display-gate', () => ({ applyV51DisplayOverrideToForecasts: async (rows: unknown[]) => rows }));
jest.mock('@/lib/recommendations/major-event-hold/config', () => ({ MAJOR_EVENT_HOLD_MODE: 'off' }));
/** NOW and scoped current-row calls score independently of usable light. */

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
  matchEnabled: false,
  favorites: [] as Beach[],
  customSpots: [] as Array<Record<string, unknown>>,
  userSkillLevel: 'intermediate' as 'intermediate' | null,
  sunTimeRows: SUN_TIME_ROWS as Array<Record<string, unknown>>,
};

/**
 * Chainable thenable that ignores filters and resolves to the rows configured
 * for its table. Discovery only reads from these tables, so per-table fixtures
 * are enough — the assertions here are about window selection, not queries.
 */
function makeQuery(rows: unknown[]): unknown {
  let single = false;
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'single' || prop === 'maybeSingle') return () => { single = true; return chain; };
        if (prop === 'then') {
          return (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data: (single ? rows[0] ?? null : rows) as unknown[], error: null }));
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
      if (table === 'beaches') return makeQuery([mockBeach]);
      if (table === 'profiles') return makeQuery([{ experience_level: 'intermediate' }]);
      if (table === 'user_entitlements') return makeQuery([{ is_pro: true }]);
      if (table === 'enhanced_forecasts') return makeQuery(mockState.forecasts);
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
    rpc: jest.fn(async (name: string, args: { p_slots?: Array<{ beach_id: string; forecast_at: string }> }) => {
      const personalization = { entitlement: { is_pro: true }, matches: (args.p_slots ?? []).map((slot) => ({
        ...slot, result: { state: 'ready', score: 6.4, label: 'FAIR', confidence: 'high', sessions_in_profile: 39, reason_bullets: ['Similar conditions'] },
      })) };
      if (name === 'get_week_scout_personalization') return { data: mockState.matchEnabled ? personalization : { matches: [] }, error: null };
      if (name === 'get_bulk_forecast_decision_context') return { data: { beaches: [mockBeach], profile: { experience_level: 'intermediate' }, boards: [], sun_times: mockState.sunTimeRows, personalization, water_quality: { county_beach_advisory_runs: [{ id: 'run', fetched_at: new Date().toISOString(), status: 'completed', source_identifier: 'county-san-diego-dehq-sdbeachinfo' }] } }, error: null };
      return { data: [], error: null };
    }),
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
  batchFetchForecasts: jest.fn(async (beaches: Beach[]) => ({
    successful: beaches.map((beach) => ({ beach, forecasts: mockState.forecasts.map((row) => ({ ...row, beach_id: beach.id })) })),
    failed: [],
    staleCount: 0,
  })),
}));

jest.mock('@/lib/services/discovery/response-formatter', () => ({
  enrichWithPhotos: jest.fn(async (recs: unknown[]) => recs),
  generateDiscoverySummary: jest.fn(() => 'Good conditions'),
  getRecommendationLabel: jest.fn((score: number) => score >= 70 ? 'Worth it' : score >= 40 ? 'Maybe' : 'Skip'),
  getRecommendationLabelGated: jest.fn((score: number) => score >= 70 ? 'Worth it' : score >= 40 ? 'Maybe' : 'Skip'),
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
  getFavoriteBeachesFromDb: jest.fn(async () => ({ success: true, data: mockState.favorites, customSpots: mockState.customSpots })),
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

describe('discoverSurfSpots - now mode attaches light without gating scores', () => {
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
    expect(result.recommendations).toHaveLength(1);
    expect(result.isDark).toBe(true);
    expect(result.daylightAvailability).toMatchObject({ reasonCode: 'after_dark' });
    expect(result.daylightAvailability?.nextWindowStart).toBe('2026-04-16T13:00:00.000Z');
  });
  it('scores the dark current row when later good rows extend through dawn', async () => {
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

    expect(result.recommendations).toHaveLength(1);
    expect(result.isDark).toBe(true);
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

    expect(result.recommendations).toHaveLength(1);
    expect(result.isDark).toBe(true);
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
    expect(result.recommendations[0]?.window.end).toEqual(new Date('2026-04-16T04:00:00Z'));
  });
  it('preserves current forecast context beyond sunset', async () => {
    // 18:30 PDT on 2026-04-15, one hour before the 19:31 sunset.
    jest.setSystemTime(new Date('2026-04-16T01:30:00.000Z'));
    mockState.forecasts = [
      forecastAt('evening-bucket', '2026-04-16T01:00:00.000Z'), // 18:00 PDT
      forecastAt('post-sunset-bucket', '2026-04-16T04:00:00.000Z'), // 21:00 PDT
    ];

    const result = await discoverNow();

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].forecast.id).toBe('evening-bucket');
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T04:00:00.000Z'));
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
  it('preserves an extended run beyond last light', async () => {
    jest.setSystemTime(new Date('2026-04-16T00:30:00Z'));
    mockState.forecasts = [0, 1, 2, 3, 4].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 16, hour)).toISOString()));
    const result = await discoverNow();
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T04:00:00Z'));
  });
  it('does not extend a night reading into the next beach-local day', async () => {
    jest.setSystemTime(new Date('2026-04-16T04:30:00Z'));
    mockState.forecasts = [3, 6, 9, 12].map((hour) =>
      forecastAt(`hour-${hour}`, new Date(Date.UTC(2026, 3, 16, hour)).toISOString()));
    const result = await discoverNow();
    expect(result.recommendations[0].window.end).toEqual(new Date('2026-04-16T06:00:00Z'));
    expect(result.isDark).toBe(true);
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

describe('September 23 Ponto NOW regression', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockState.sunTimeRows = [{ beach_id: 'beach-1', sunrise_utc: '2026-09-23T13:39:00Z', sunset_utc: '2026-09-24T01:45:00Z' }];
    mockState.forecasts = require('@/__tests__/fixtures/ponto-now-20260923.json');
    jest.mocked(windowScorer.scoreWindowConditionScore).mockReturnValue(94);
  });
  afterEach(() => {
    jest.mocked(windowScorer.scoreWindowConditionScore).mockImplementation(jest.requireActual('@/lib/services/discovery/window-selector/window-scorer').scoreWindowConditionScore);
    jest.useRealTimers();
  });
  it.each([
    ['06:00', '13:00', '12:00', true], ['06:30', '13:30', '12:00', false],
    ['09:00', '16:00', '15:00', false], ['02:00', '09:00', '09:00', true],
  ])('scores NOW at %s PT with context covering the supporting row', async (_local, utc, support, dark) => {
    jest.setSystemTime(new Date(`2026-09-23T${utc}:00Z`));
    const supportAt = `2026-09-23T${support}:00.000Z`;
    for (const response of [await discoverNow(), await discoverScoped(supportAt)]) {
      const rec = response.recommendations[0];
      expect(response.recommendations).toHaveLength(1);
      expect(rec.score).toBe(94);
      expect(rec.verdict).toBe('go');
      expect(rec.conditionLabel).toBe('EPIC');
      expect(rec.window.start.getTime()).toBeLessThanOrEqual(Date.parse(supportAt));
      expect(rec.window.end.getTime()).toBeGreaterThan(Date.now());
      expect(response).toMatchObject({ firstLight: '2026-09-23T13:09:00.000Z', lastLight: '2026-09-24T02:05:00.000Z', isDark: dark });
      expect(response.nextWindowStart).toBe(dark ? '2026-09-23T13:09:00.000Z' : undefined);
    }
  });
});


describe('scoped light describes the scoped hour, not the request time', () => {
  // Wed 2026-09-23 first light 06:09 PDT, last light 19:05 PDT; Thu 06:10 / 19:03.
  const SEPTEMBER_SUN = [
    { beach_id: 'beach-1', sunrise_utc: '2026-09-23T13:39:00Z', sunset_utc: '2026-09-24T01:45:00Z' },
    { beach_id: 'beach-1', sunrise_utc: '2026-09-24T13:40:00Z', sunset_utc: '2026-09-25T01:43:00Z' },
  ];
  beforeEach(() => {
    jest.useFakeTimers();
    mockState.sunTimeRows = SEPTEMBER_SUN;
    mockState.userSkillLevel = 'intermediate';
  });
  afterEach(() => {
    mockState.sunTimeRows = SUN_TIME_ROWS;
    jest.useRealTimers();
  });

  it('reports a future daylight hour as light when asked after dark', async () => {
    jest.setSystemTime(new Date('2026-09-24T03:40:00Z')); // Wed 20:40 PDT
    mockState.forecasts = [
      forecastAtLocal('thu-09', '2026-09-24T16:00:00Z', '2026-09-24', '09:00'),
      forecastAtLocal('thu-12', '2026-09-24T19:00:00Z', '2026-09-24', '12:00'),
      forecastAtLocal('thu-15', '2026-09-24T22:00:00Z', '2026-09-24', '15:00'),
    ];

    const result = await discoverScoped('2026-09-24T19:00:00.000Z'); // Thu 12:00 PDT

    const light = { isDark: false, firstLight: '2026-09-24T13:10:00.000Z', lastLight: '2026-09-25T02:03:00.000Z' };
    expect(result).toMatchObject(light);
    expect(result.recommendations[0]).toMatchObject(light);
    expect(result.nextWindowStart).toBeUndefined();
    expect(result.daylightAvailability).toBeUndefined();
  });

  it('reports a future night hour as dark when asked in daylight', async () => {
    jest.setSystemTime(new Date('2026-09-23T19:00:00Z')); // Wed 12:00 PDT
    mockState.forecasts = [
      forecastAtLocal('wed-17', '2026-09-24T00:00:00Z', '2026-09-23', '17:00'),
      forecastAtLocal('wed-20', '2026-09-24T03:00:00Z', '2026-09-23', '20:00'),
      forecastAtLocal('wed-23', '2026-09-24T06:00:00Z', '2026-09-23', '23:00'),
    ];

    const result = await discoverScoped('2026-09-24T03:00:00.000Z'); // Wed 20:00 PDT

    const light = {
      isDark: true,
      firstLight: '2026-09-23T13:09:00.000Z',
      lastLight: '2026-09-24T02:05:00.000Z',
      nextWindowStart: '2026-09-24T13:10:00.000Z',
    };
    expect(result).toMatchObject(light);
    expect(result.recommendations[0]).toMatchObject(light);
    expect(result.daylightAvailability).toEqual({
      reasonCode: 'after_dark',
      nextWindowStart: '2026-09-24T13:10:00.000Z',
      timezone: BEACH_TZ,
      beachId: 'beach-1',
    });
  });

  it('describes a future dawn row by its interval, not its dark start instant', async () => {
    jest.setSystemTime(new Date('2026-09-24T03:40:00Z')); // Wed 20:40 PDT
    mockState.forecasts = [
      forecastAtLocal('thu-02', '2026-09-24T09:00:00Z', '2026-09-24', '02:00'),
      forecastAtLocal('thu-05', '2026-09-24T12:00:00Z', '2026-09-24', '05:00'),
      forecastAtLocal('thu-08', '2026-09-24T15:00:00Z', '2026-09-24', '08:00'),
    ];

    const result = await discoverScoped('2026-09-24T12:00:00.000Z'); // 05:00–08:00 overlaps 06:10 first light

    expect(result).toMatchObject({ isDark: false, firstLight: '2026-09-24T13:10:00.000Z' });
    expect(result.nextWindowStart).toBeUndefined();
    expect(result.daylightAvailability).toBeUndefined();
  });

  // Home NOW asks with the row its current hour interpolates from, which is the
  // next row in the last hour of a 3-hour step; its light must stay request-time.
  it.each([
    ['dusk, still light at 19:02 with the 20:00 row', '2026-09-24T02:02:00Z', [
      forecastAtLocal('wed-17', '2026-09-24T00:00:00Z', '2026-09-23', '17:00'),
      forecastAtLocal('wed-20', '2026-09-24T03:00:00Z', '2026-09-23', '20:00'),
      forecastAtLocal('wed-23', '2026-09-24T06:00:00Z', '2026-09-23', '23:00'),
    ], '2026-09-24T03:00:00.000Z', false, undefined],
    ['dawn, still dark at 04:30 with the 05:00 row', '2026-09-24T11:30:00Z', [
      forecastAtLocal('thu-02', '2026-09-24T09:00:00Z', '2026-09-24', '02:00'),
      forecastAtLocal('thu-05', '2026-09-24T12:00:00Z', '2026-09-24', '05:00'),
      forecastAtLocal('thu-08', '2026-09-24T15:00:00Z', '2026-09-24', '08:00'),
    ], '2026-09-24T12:00:00.000Z', true, '2026-09-24T13:10:00.000Z'],
  ] as const)('keeps Home NOW on request-time light: %s', async (_label, now, rows, forecastAt, dark, nextWindowStart) => {
    jest.setSystemTime(new Date(now));
    mockState.forecasts = [...rows];

    const result = await discoverScoped(forecastAt);

    expect(result.isDark).toBe(dark);
    expect(result.nextWindowStart).toBe(nextWindowStart);
    expect(result.daylightAvailability?.reasonCode).toBe(dark ? 'after_dark' : undefined);
    expect(result.daylightAvailability?.nextWindowStart).toBe(nextWindowStart);
  });
});


describe('My Spots 72-hour daylight selection', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-04-15T16:00:00Z') });
    mockState.sunTimeRows = SUN_TIME_ROWS;
    mockState.favorites = [mockBeach as Beach];
    mockState.customSpots = [];
    mockState.forecasts = [
      { ...forecastAt('today', '2026-04-15T18:00:00Z'), wave_height: '0.5 ft', wave_period: '5s' },
      { ...forecastAt('tomorrow', '2026-04-16T16:00:00Z'), wave_height: '3 ft', wave_period: '15s', wind_speed: '3 mph' },
      { ...forecastAt('too-late', '2026-04-19T16:00:00Z'), wave_height: '3 ft', wave_period: '18s', wind_speed: '0 mph' },
    ];
  });
  afterEach(() => { mockState.favorites = []; mockState.customSpots = []; jest.useRealTimers(); });
  const saved = () => discoverSurfSpots(USER_ID, { userLocation: USER_LOCATION, savedSpotsOnly: true, horizonHours: 72 });
  it('scans the full 72h daylight horizon and finds tomorrow instead of preferring today', async () => {
    const response = await saved();
    expect(response.recommendations).toHaveLength(1);
    expect(response.recommendations[0].forecast.id).toBe('tomorrow');
    // Best next 72h keeps main's today-first selection; only My Spots scans all 72h.
    expect(response.recommendations[0].window.start.getTime()).toBeGreaterThan(Date.now());
    expect(response.recommendations[0].window.end.getTime()).toBeLessThanOrEqual(Date.now() + 72 * 3600000);
  });
  it('returns an explicit empty reason when no saved spots are worth recommending', async () => {
    mockState.forecasts = [{ ...forecastAt('flat', '2026-04-15T18:00:00Z'), wave_height: '0.1 ft', wave_period: '3s', wind_speed: '35 mph' }];
    const response = await saved();
    expect(response.recommendations).toEqual([]);
    expect(response.emptyReason).toBe('no_recommendable_saved_window_72h');
  });
  it('excludes unsaved nearby spots', async () => {
    mockState.favorites = [];
    const response = await saved();
    expect(response.recommendations).toEqual([]);
    expect(response.emptyReason).toBe('no_recommendable_saved_window_72h');
  });
  it('includes saved custom spots beyond the nearby radius', async () => {
    mockState.favorites = [];
    mockState.customSpots = [{ id: 'custom-saved', name: 'Saved custom', user_id: USER_ID, visibility: 'private',
      lat: 34, lon: -118, nearest_beach_id: 'beach-1', nearest_beach_distance_mi: 1, deleted_at: null,
      break_type: 'beach', facing_direction_deg: 270, swell_window_min_deg: 180, swell_window_max_deg: 300,
      offshore_direction_deg: 90, exposure_level: 'open',
    }];
    const response = await saved();
    expect(response.recommendations).toHaveLength(1);
    expect(response.recommendations[0]).toMatchObject({ kind: 'custom_spot', customSpotId: 'custom-saved' });
  });
});


describe('Ponto public response parity', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-23T16:00:00Z') });
    mockBeach.id = id;
    mockState.matchEnabled = true;
    mockState.forecasts = require('@/__tests__/fixtures/ponto-now-20260923.json').map((row: EnhancedForecastEntity) => ({ ...row, beach_id: id }));
    mockState.sunTimeRows = [{ beach_id: id, sunrise_utc: '2026-09-23T13:39:00Z', sunset_utc: '2026-09-24T01:45:00Z' }];
    jest.mocked(windowScorer.scoreWindowConditionScore).mockReturnValue(94);
  });
  afterEach(() => {
    mockBeach.id = 'beach-1'; mockState.matchEnabled = false;
    jest.mocked(windowScorer.scoreWindowConditionScore).mockImplementation(jest.requireActual('@/lib/services/discovery/window-selector/window-scorer').scoreWindowConditionScore);
    jest.useRealTimers();
  });
  it('returns go / EPIC / 94 with the same FAIR match on surf/call, bulk and discover now', async () => {
    const { GET: call } = require('@/app/api/surf/call/route');
    const { GET: discover } = require('@/app/api/surf/discover/route');
    const { GET: bulk } = require('@/app/api/forecasts/bulk/route');
    const { NextRequest } = require('next/server');
    const callResponse = await call(new Request(`http://localhost/api/surf/call?beachId=${id}&forecastAt=2026-09-23T15:00:00Z`));
    const discoverResponse = await discover(new Request('http://localhost/api/surf/discover?lat=32.7&lon=-117.1&mode=now'));
    const bulkResponse = await bulk(new NextRequest(`http://localhost/api/forecasts/bulk?beachIds=${id}&forecastAt=2026-09-23T15:00:00Z`));
    expect([callResponse.status, discoverResponse.status, bulkResponse.status]).toEqual([200, 200, 200]);
    const c = (await callResponse.json()).data;
    const d = (await discoverResponse.json()).data;
    const b = (await bulkResponse.json()).data;
    expect(c.sessionDecision.selection.evidence.personalMatch).toMatchObject({ label: 'FAIR', score: 6.4, sessionCount: 39 });
    expect(d.recommendations[0].similarity).toMatchObject({ label: 'FAIR', score: 6.4, sessionCount: 39 });
    expect([c.sessionDecision.verdict, d.recommendations[0].verdict, b.verdicts[id]]).toEqual(['go', 'go', 'go']);
    expect([c.conditionLabel, d.recommendations[0].conditionLabel, b.conditionLabels[id]]).toEqual(['EPIC', 'EPIC', 'EPIC']);
    expect([c.report.score, d.recommendations[0].score, b.conditionScores[id]]).toEqual([94, 94, 94]);
    expect(Date.parse(c.forecastContext.selectedWindowStart)).toBeLessThanOrEqual(Date.parse('2026-09-23T15:00:00Z'));
  });
});
