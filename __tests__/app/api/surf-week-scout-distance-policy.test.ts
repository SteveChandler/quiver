/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  ...jest.requireActual('@/lib/middleware/api-wrappers'),
  withRateLimit: (handler: unknown) => handler,
}));

let mockRequestSupabase: unknown;
let mockLastHttpRequest: unknown;
let mockLastHttpResponse: unknown;
jest.mock('@/lib/supabase/bearer-client', () => ({
  createBearerTokenClient: () => mockRequestSupabase,
}));

let mockDependencies: WeekScoutServiceDependencies;
let mockPoolDependencies: WeekendScoutCandidatePoolDependencies;
const mockServiceRequests = jest.fn();
jest.mock('@/lib/services/discovery/week-scout', () => {
  const actual = jest.requireActual('@/lib/services/discovery/week-scout');
  return {
    ...actual,
    generateWeekScoutForecast: (userId: string, request: WeekScoutRequest) => {
      mockServiceRequests(request);
      return actual.generateWeekScoutForecast(userId, request, mockDependencies);
    },
  };
});
jest.mock('@/lib/services/discovery/weekend-scout-candidate-pool', () => {
  const actual = jest.requireActual('@/lib/services/discovery/weekend-scout-candidate-pool');
  return {
    ...actual,
    buildWeekendScoutCandidatePool: (userId: string, options: unknown) =>
      actual.buildWeekendScoutCandidatePool(userId, options, mockPoolDependencies),
  };
});
const mockDistances = new Map<number, number>();
jest.mock('@/lib/utils/distance-utils', () => {
  const actual = jest.requireActual('@/lib/utils/distance-utils');
  return {
    ...actual,
    calculateDistanceInMiles: (origin: unknown, beach: { lon: number }) =>
      mockDistances.has(beach.lon)
        ? mockDistances.get(beach.lon)
        : actual.calculateDistanceInMiles(origin, beach),
  };
});
const mockHeldIds = new Set<string>();
jest.mock('@/lib/recommendations/major-event-hold/repository', () => ({
  resolveMajorEventHolds: jest.fn(async () => ({ state: 'resolved', holds: [] })),
}));
jest.mock('@/lib/recommendations/major-event-hold/water-quality', () => ({
  ...jest.requireActual('@/lib/recommendations/major-event-hold/water-quality'),
  resolveWaterQualityHolds: jest.fn(async () => ({
    state: 'resolved', heldBeachIds: [...mockHeldIds],
    waterQualityStatusByBeachId: {}, epoch: 'clear',
  })),
}));

import { NextRequest, type NextResponse } from 'next/server';
import { writeFileSync } from 'node:fs';
import { rerankHero } from '@/lib/services/discovery/hero-ranking';
import { beachToSpotProfile } from '@/lib/domains/scoring';
import contractFixtures from '@/__tests__/fixtures/complete-radius-ranking-policy.json';
import { POST } from '@/app/api/surf/week-scout/route';
import {
  generateWeekScoutForecastForDays, generateWeekScoutRankingForDays,
  type CanonicalWeekScoutResponse, type WeekScoutRequest, type WeekScoutServiceDependencies,
} from '@/lib/services/discovery/week-scout';
import type { WeekendScoutCandidatePoolDependencies } from '@/lib/services/discovery/weekend-scout-candidate-pool';
import { createMockBeach } from '@/__tests__/setup/typed-mocks';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';

const NOW = new Date('2026-09-03T16:00:00Z');
const DATE = '2026-09-03';
const ORIGIN = { lat: 32.75, lon: -117.1 };
const LEGACY_SCORER = 'week-scout-v2:day-window-authority-v1';
const id = (index: number): string => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
type RouteData = Omit<CanonicalWeekScoutResponse, 'coverage'> & {
  candidateBeaches: Array<{ beachId: string; distanceMiles: number | null }>;
  coverage: {
    scope: { candidates: { enumerated: number; hydrated: number; filteredOut: number } };
    days: Array<{ eligible: number; evaluated: number; missing: number }>;
  };
};
let beaches: Beach[];
let scores: Map<string, number>;
let forecasts: Map<string, EnhancedForecastEntity[]>;

function setup(count = 2): void {
  beaches = Array.from({ length: count }, (_, index) => createMockBeach({
    id: id(index), name: `Fixture ${index}`, slug: `fixture-${index}`,
    lat: ORIGIN.lat, lon: ORIGIN.lon + index / 10000,
    timezone: 'America/Los_Angeles', skill_level: 'beginner', hazards: [],
  }));
  scores = new Map(beaches.map((beach, index) => [beach.id, index === count - 1 ? 74 : 73]));
  forecasts = new Map(beaches.map((beach) => [beach.id, [{
    id: `${beach.id}:forecast`, beach_id: beach.id,
    forecast_at: `${DATE}T18:00:00Z`, wave_height: '3 ft', wave_period: '12s',
    wave_direction: 'SW', wind_speed: '5 mph', wind_direction: 'E',
    tide_height: '3 ft', tide_status: 'Rising', confidence_score: 85,
    data_source: 'NOAA_NWS', created_at: NOW.toISOString(), updated_at: NOW.toISOString(),
  } as EnhancedForecastEntity]]));
  mockDistances.clear();
  beaches.forEach((beach) => mockDistances.set(beach.lon, 3));
  mockPoolDependencies = {
    // Eligibility distance is independently verified by the collector. Only the
    // downstream travel metadata varies in the ranking regression below.
    fetchNearbyRows: jest.fn(async ({ offsetCount, limitCount }) => beaches
      .slice(offsetCount, offsetCount + limitCount)
      .map((beach) => ({ id: beach.id, distance_meters: 1609.344, total_count: count }))),
    fetchBeaches: jest.fn(async (ids) => beaches.filter((beach) => ids.includes(beach.id))),
  };
  mockDependencies = {
    now: NOW,
    fetchBeaches: jest.fn(async (ids) => beaches.filter((beach) => ids.includes(beach.id))),
    fetchForecasts: jest.fn(async () => forecasts),
    fetchSunTimes: jest.fn(async () => new Map()),
    fetchPreferences: jest.fn(async () => null),
    fetchSkill: jest.fn(async () => 'intermediate'),
    fetchBoardClasses: jest.fn(async () => []),
    fetchPersonalizationContext: jest.fn(async () => null),
    calculatePersonalizationBonus: jest.fn(() => ({ affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    selectBestWindows: jest.fn(({ forecasts: rows }: WindowSelectorOptions) => rows.map((sourceForecast) => ({
      start: new Date(`${DATE}T18:00:00Z`), end: new Date(`${DATE}T20:00:00Z`),
      peakTime: new Date(`${DATE}T19:00:00Z`), timezone: 'America/Los_Angeles',
      tide: 'Rising', wind: '5 mph E', waveHeight: '3 ft', wavePeriod: '12s',
      dataSource: 'NOAA_NWS', confidence: 85, sourceForecast,
    }))) as unknown as WeekScoutServiceDependencies['selectBestWindows'],
    scoreWindowCondition: jest.fn((_row, beach) => scores.get(beach.id) ?? 73),
    scoreBeach: jest.fn(() => ({
      total: 73, matchQuality: 'good',
      subscores: { waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 19,
        tideFit: 14, affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0 },
      reasons: ['Clean wind'], warnings: [],
    })),
    beachToSpotProfile: jest.fn(() => ({ kind: 'beach' } as never)),
    // Freeze non-distance merit, exercising the real service's composition,
    // comparators, day nomination, canonical engine and response compaction.
    rankWindows: jest.fn((recommendations) => ({
      reranked: recommendations,
      diagnostics: recommendations.map((recommendation, index) => ({
        beachSlug: recommendation.beach.id, representativeSlotScore: recommendation.score,
        setupSuitability: 80, windAlignment: 19, tideFit: 14, waveHeightFit: 22,
        periodEnergyScore: 18, affinityBonus: 0, windowDurationHours: 2,
        windowPersistence: 100, heroWindowScore: scores.get(recommendation.beach.id) ?? 73,
        finalRank: index, isHero: index === 0,
        sharedSetupSignal: { directionDeg: 225, periodS: 12, source: 'cluster-majority' },
      })),
    })),
  };
}

async function call(completeRadius = true, location: typeof ORIGIN | null = ORIGIN): Promise<NextResponse> {
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'distance-policy-fixture' } }, error: null }) },
    from: (table: string) => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: table === 'profiles'
        ? { max_drive_minutes: 120 }
        : location && { ...location, captured_at: NOW.toISOString() }, error: null }),
    }) }) }),
  };
  mockRequestSupabase = supabase;
  mockLastHttpRequest = {
    ...(completeRadius ? { candidateScope: { kind: 'complete-radius' } } : { candidateBeachIds: beaches.map((beach) => beach.id) }),
    localTimezone: 'America/Los_Angeles', startLocalDate: DATE, dayCount: 7,
  };
  return POST(new NextRequest('http://localhost/api/surf/week-scout', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-contract-only' },
    body: JSON.stringify(mockLastHttpRequest),
  }), { user: { id: 'distance-policy-fixture' }, supabase, params: {} } as never);
}

async function data(completeRadius = true): Promise<RouteData> {
  const response = await call(completeRadius);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  const body = await response.json();
  mockLastHttpResponse = { status: response.status, body };
  return body.data as RouteData;
}

function ranking(response: Pick<CanonicalWeekScoutResponse, 'days' | 'sessionDecision'>): unknown {
  return {
    selection: response.sessionDecision.selection,
    days: response.days.map((day) => ({
      bestWindowId: day.bestWindowId,
      windows: day.windows.map((window) => ({
        id: window.id, beachId: window.beachId, conditionScore: window.conditionScore,
        rankingScore: window.rankingScore,
        alternatives: window.rankedSpots.map((spot) => [spot.beachId, spot.conditionScore, spot.rankingScore]),
      })),
    })),
  };
}

describe('complete-radius route → collector → service distance policy', () => {
  const previousFlag = process.env.WEEK_SCOUT_ENDPOINT_ENABLED;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    mockHeldIds.clear();
    process.env.WEEK_SCOUT_ENDPOINT_ENABLED = 'true';
    setup();
  });
  afterEach(() => {
    jest.useRealTimers();
    if (previousFlag === undefined) delete process.env.WEEK_SCOUT_ENDPOINT_ENABLED;
    else process.env.WEEK_SCOUT_ENDPOINT_ENABLED = previousFlag;
  });

  it.each([
    ['73/74 old band', false, false, false],
    ['exact merit ties', true, false, false],
    ['exact ties with input permutations', true, true, false],
    ['input permutations', false, true, false],
    ['missing travel metadata after verified eligibility', false, false, true],
  ])('complete-radius ranking is independent: %s', async (_name, tied, reverse, missing) => {
    if (tied) scores.set(id(0), 74);
    const original = [...beaches];
    mockDistances.set(original[0].lon, 3);
    mockDistances.set(original[1].lon, 35);
    const before = await data();
    mockDistances.set(original[0].lon, missing ? Number.NaN : 35);
    mockDistances.set(original[1].lon, missing ? Number.NaN : 3);
    if (reverse) beaches.reverse();
    const after = await data();
    expect(ranking(after)).toEqual(ranking(before));
    for (const response of [before, after]) {
      expect(response.days[0].windows).toHaveLength(2);
      for (const window of response.days[0].windows) {
        expect(window.conditionScore).toBe(scores.get(window.beachId));
        expect(window.rankingScore).toBe(scores.get(window.beachId));
      }
      expect(response.sessionDecision.selection?.beachId).toBe(tied ? id(0) : id(1));
    }
    expect(after.candidateFingerprint).toBe(before.candidateFingerprint);
  });

  it('also preserves selection with the real shared hero merit calculation', async () => {
    mockDependencies.rankWindows = rerankHero;
    mockDependencies.beachToSpotProfile = beachToSpotProfile;
    mockDistances.set(beaches[0].lon, 3);
    mockDistances.set(beaches[1].lon, 35);
    const before = await data();
    mockDistances.set(beaches[0].lon, 35);
    mockDistances.set(beaches[1].lon, 3);
    const after = await data();
    expect(before.days[0].windows).toHaveLength(2);
    expect(before.sessionDecision.selection).not.toBeNull();
    expect(ranking(after)).toEqual(ranking(before));
  });

  it('evaluates the winner beyond 8/30/50/60/65 and a full 500-row page', async () => {
    setup(501);
    const response = await data();
    expect(mockPoolDependencies.fetchNearbyRows).toHaveBeenNthCalledWith(1, expect.objectContaining({ offsetCount: 0, limitCount: 500 }));
    expect(mockPoolDependencies.fetchNearbyRows).toHaveBeenNthCalledWith(2, expect.objectContaining({ offsetCount: 500, limitCount: 500 }));
    expect(mockDependencies.fetchBeaches).toHaveBeenCalledWith(beaches.map((beach) => beach.id));
    expect(new Set(jest.mocked(mockDependencies.scoreWindowCondition).mock.calls.map(([, beach]) => beach.id)).size).toBe(501);
    expect(response.coverage.scope.candidates).toEqual({ enumerated: 501, hydrated: 501, filteredOut: 0 });
    expect(response.sessionDecision.selection?.beachId).toBe(id(500));
    expect(response.days[0].bestDayWindow?.beachId).toBe(id(500));
  });

  it.each(['missing page', 'inconsistent total', 'duplicate page', 'hydration loss', 'later RPC failure'])('withholds a range-wide winner on %s', async (failure) => {
    setup(501);
    const fetchPage = mockPoolDependencies.fetchNearbyRows;
    mockPoolDependencies.fetchNearbyRows = jest.fn(async (args) => {
      if (args.offsetCount === 0) return fetchPage(args);
      if (failure === 'missing page') return [];
      if (failure === 'inconsistent total') return [{ id: id(500), distance_meters: 1609.344, total_count: 502 }];
      if (failure === 'duplicate page') return fetchPage({ ...args, offsetCount: 0 });
      if (failure === 'later RPC failure') throw new Error('paging failed');
      return fetchPage(args);
    });
    if (failure === 'hydration loss') mockPoolDependencies.fetchBeaches = jest.fn(async () => beaches.slice(0, 500));
    const response = await call();
    expect(response.status).toBe(503);
    expect((await response.json()).data?.sessionDecision).toBeUndefined();
    expect(mockServiceRequests).not.toHaveBeenCalled();
  });

  it('propagates an initial RPC failure without reaching ranking', async () => {
    mockPoolDependencies.fetchNearbyRows = jest.fn(async () => { throw new Error('RPC unavailable'); });
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
    expect(mockServiceRequests).not.toHaveBeenCalled();
  });

  it.each(['missing', 'duplicate', 'unexpected'])('withholds the winner when service hydration is %s after complete enumeration', async (failure) => {
    mockDependencies.fetchBeaches = jest.fn(async () => failure === 'missing'
      ? [beaches[0]]
      : failure === 'duplicate'
      ? [beaches[0], beaches[0]]
      : [beaches[0], { ...beaches[1], id: id(999) }]);
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
    expect(mockDependencies.fetchForecasts).not.toHaveBeenCalled();
    expect(mockDependencies.rankWindows).not.toHaveBeenCalled();
  });

  it('requires known location for drive eligibility and still rejects out-of-range rows', async () => {
    expect((await call(true, null)).status).toBe(400);
    expect(mockPoolDependencies.fetchNearbyRows).not.toHaveBeenCalled();
    mockDistances.set(beaches[1].lon, Number.NaN);
    mockPoolDependencies.fetchNearbyRows = jest.fn(async () => beaches.map((beach, index) => ({
      id: beach.id, distance_meters: (index === 0 ? 1 : 61) * 1609.344, total_count: 2,
    })));
    const response = await data();
    expect(response.candidateBeaches.map((beach) => beach.beachId)).toEqual([id(0)]);
    expect(response.sessionDecision.selection?.beachId).toBe(id(0));
  });

  it('reports missing forecasts independently of complete candidate enumeration', async () => {
    forecasts.delete(id(1));
    const response = await data();
    expect(response.coverage.scope.candidates.enumerated).toBe(2);
    expect(response.coverage.days[0]).toEqual(expect.objectContaining({ eligible: 2, evaluated: 1, missing: 1 }));
    expect(response.candidateBeaches).toHaveLength(2);
    expect(response.days[0].windows.some((window) => window.beachId === id(1))).toBe(false);
    forecasts.clear();
    const missing = await data();
    expect(missing.sessionDecision.selection).toBeNull();
    expect(missing.days[0].bestWindowId).toBeNull();
    expect(missing.coverage.days[0].missing).toBe(2);
  });

  it('preserves unsuitable/held states while retaining allowed raw window data', async () => {
    scores.set(id(0), 20); scores.set(id(1), 20);
    const unsuitable = await data();
    expect(unsuitable.sessionDecision.selection).toBeNull();
    expect(unsuitable.days[0].bestWindowId).toBeNull();
    expect(unsuitable.days[0].windows).toHaveLength(2);
    expect(unsuitable.days[0].windows.every((window) => window.forecast.waveHeight === '3 ft')).toBe(true);
    scores.set(id(0), 73); scores.set(id(1), 74);
    mockHeldIds.add(id(1));
    const held = await data();
    expect(held.sessionDecision.selection?.beachId).toBe(id(0));
    expect(held.days[0].windows.some((window) => window.beachId === id(1))).toBe(false);
  });

  it('isolates legacy requests and alert ranking, including their prior fingerprint', async () => {
    mockDistances.set(beaches[0].lon, 3); mockDistances.set(beaches[1].lon, 35);
    const legacy = await data(false);
    const interactive = await data();
    const request = { candidateBeachIds: beaches.map((beach) => beach.id), localTimezone: 'America/Los_Angeles', startLocalDate: DATE, dayCount: 7, userLocation: ORIGIN };
    const alert = await generateWeekScoutRankingForDays('distance-policy-fixture', request, mockDependencies);
    const days = await generateWeekScoutForecastForDays('distance-policy-fixture', request, mockDependencies);
    expect(legacy.scorerVersion).toBe(LEGACY_SCORER);
    expect(alert.scorerVersion).toBe(LEGACY_SCORER);
    expect(alert.days).toEqual(legacy.days);
    expect(ranking(days)).toEqual(ranking(legacy));
    expect(legacy.sessionDecision.selection?.beachId).toBe(id(0));
    expect(interactive.sessionDecision.selection?.beachId).toBe(id(1));
    expect(interactive.candidateFingerprint).not.toBe(legacy.candidateFingerprint);
    expect(alert.candidateFingerprint).toBe(legacy.candidateFingerprint);
    expect(interactive.scorerVersion).not.toBe(legacy.scorerVersion);
  });
  it('pins the route responses replayed by the Native cache regression', async () => {
    mockDistances.set(beaches[0].lon, 3); mockDistances.set(beaches[1].lon, 35);
    const legacy = await data(false);
    const legacyRequest = mockLastHttpRequest;
    const legacyHttp = mockLastHttpResponse;
    const completeRadius = await data();
    const completeRadiusRequest = mockLastHttpRequest;
    const completeRadiusHttp = mockLastHttpResponse;
    expect({ legacy, completeRadius }).toEqual(contractFixtures);
    // The consumer run reads this provider-verified artifact, including actual
    // wrapper error envelopes, rather than defining its own response shapes.
    mockPoolDependencies.fetchNearbyRows = jest.fn(async () => {
      throw new Error('RPC unavailable');
    });
    const failed = await call();
    const rpcFailure = { status: failed.status, body: await failed.json() };
    setup(501);
    const fetchPage = mockPoolDependencies.fetchNearbyRows;
    mockPoolDependencies.fetchNearbyRows = jest.fn(async (args) => args.offsetCount === 0 ? fetchPage(args) : []);
    const incomplete = await call();
    const incompleteRetrieval = { status: incomplete.status, body: await incomplete.json() };
    expect(rpcFailure.status).toBe(500);
    expect(incompleteRetrieval.status).toBe(503);
    if (process.env.WEEK_SCOUT_CONTRACT_OUTPUT) {
      writeFileSync(process.env.WEEK_SCOUT_CONTRACT_OUTPUT, JSON.stringify({
        legacy, completeRadius, legacyRequest, legacyHttp, completeRadiusRequest, completeRadiusHttp, rpcFailure, incompleteRetrieval,
      }, null, 2));
    }
  });

});
