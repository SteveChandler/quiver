/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  ...jest.requireActual('@/lib/middleware/api-wrappers'),
  withAuth: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));

// The route still executes the real service; only its I/O dependencies vary.
let mockDependencies: WeekScoutServiceDependencies;
jest.mock('@/lib/services/discovery/week-scout', () => {
  const actual = jest.requireActual('@/lib/services/discovery/week-scout');
  return {
    ...actual,
    generateWeekScoutForecast: (userId: string, input: WeekScoutRequest) =>
      actual.generateWeekScoutForecast(userId, input, mockDependencies),
  };
});
jest.mock('@/lib/recommendations/major-event-hold/repository', () => ({
  resolveMajorEventHolds: jest.fn(async () => ({ state: 'resolved', holds: [] })),
}));
const mockResolveWaterQuality = jest.fn();
jest.mock('@/lib/recommendations/major-event-hold/water-quality', () => ({
  ...jest.requireActual('@/lib/recommendations/major-event-hold/water-quality'),
  resolveWaterQualityHolds: (...args: unknown[]) => mockResolveWaterQuality(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/route';
import type {
  CanonicalWeekScoutResponse, WeekScoutRequest, WeekScoutServiceDependencies,
} from '@/lib/services/discovery/week-scout';
import { createMockBeach } from '@/__tests__/setup/typed-mocks';
import { createDiscoveryScoringEngine, scoreBeachWithEngine, beachToSpotProfile } from '@/lib/domains/scoring';
import { selectBestWindow, scoreWindowConditionScore } from '@/lib/services/discovery/window-selector';
import { rerankHero } from '@/lib/services/discovery/hero-ranking';
import { calculatePersonalizationBonus } from '@/lib/services/discovery/personalization-layer';
import { BOARD_CLASSES, getRideabilityBand, normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';
import { SKILL_LEVELS, parseSkillLevel, type SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const NOW = new Date('2026-09-03T12:00:00Z');
const DATE = '2026-09-05';
const ACCOUNT_BOARDS = Array.from(new Set(
  ['fish', 'longboard-2-plus-1', 'midlength', 'thruster', 'fish']
    .map(normalizeBoardClass).filter((board): board is BoardClass => board !== null),
));
const BEACHES = Array.from({ length: 30 }, (_, index) => createMockBeach({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  name: `Contract Beach ${index}`,
  slug: `contract-beach-${index}`,
  skill_level: 'beginner',
  hazards: [],
  timezone: 'America/Los_Angeles',
  swell_window_min_deg: 180,
  swell_window_max_deg: 320,
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: 'rising',
}));

// Synthetic behavior fixtures, not a claim about measured September surf.
function rows(beach: Beach, height: number, wind = 5): EnhancedForecastEntity[] {
  return [17, 18, 19, 20].map((hour) => ({
    id: `${beach.id}:${hour}`,
    beach_id: beach.id,
    forecast_at: `${DATE}T${hour}:00:00Z`,
    wave_height: `${height} ft`, wave_period: '15s', wave_direction: 'SW',
    swell_1_height: `${height} ft`, swell_1_period: '15s', swell_1_direction: 'SW',
    swell_2_height: null, swell_2_period: null, swell_2_direction: null,
    wind_speed: `${wind} mph`, wind_direction: 'E',
    tide_height: '3.5 ft', tide_status: 'Rising', water_temp: '68°F',
    confidence_score: 82, data_source: 'NOAA_NWS',
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(),
  } as EnhancedForecastEntity));
}

function dependencies(
  skill: SkillLevel | null,
  boards: BoardClass[],
  forecasts: Map<string, EnhancedForecastEntity[]>,
): WeekScoutServiceDependencies {
  const engine = createDiscoveryScoringEngine();
  return {
    now: NOW,
    fetchBeaches: jest.fn(async (ids) => ids.map((id) => BEACHES.find((beach) => beach.id === id)!)),
    fetchForecasts: jest.fn(async () => forecasts),
    fetchSunTimes: jest.fn(async (ids) => new Map(ids.map((id) => [id, {
      sunrises: [new Date(`${DATE}T13:00:00Z`)],
      sunsets: [new Date(`${DATE}T02:00:00Z`), new Date('2026-09-06T02:00:00Z')],
    }]))),
    fetchPreferences: jest.fn(async () => null),
    fetchSkill: jest.fn(async () => skill),
    fetchBoardClasses: jest.fn(async () => boards),
    fetchPersonalizationContext: jest.fn(async () => null),
    calculatePersonalizationBonus,
    selectBestWindow,
    scoreWindowCondition: (forecast, beach, level, inventory) =>
      scoreWindowConditionScore(forecast, beach, level, null, inventory),
    scoreBeach: (beach, forecast, options) => scoreBeachWithEngine(engine, beach, forecast, options),
    beachToSpotProfile,
    rankWindows: rerankHero,
  };
}

async function call(ids: string[]): Promise<CanonicalWeekScoutResponse> {
  const response = await POST(new NextRequest('http://localhost/api/surf/week-scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateBeachIds: ids, localTimezone: 'America/Los_Angeles', startLocalDate: DATE, dayCount: 7 }),
  }), { user: { id: 'anonymous-contract-account' }, supabase: {}, params: {} } as never);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  return (await response.json()).data;
}

function best(
  response: CanonicalWeekScoutResponse,
): CanonicalWeekScoutResponse['days'][number]['windows'][number] | undefined {
  const day = response.days[0];
  return day.windows.find((window) => window.id === day.bestWindowId);
}

describe('Week Scout route → real ranking profile contracts', () => {
  const originalFlag = process.env.WEEK_SCOUT_ENDPOINT_ENABLED;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(NOW);
    process.env.WEEK_SCOUT_ENDPOINT_ENABLED = 'true';
    mockResolveWaterQuality.mockResolvedValue({ state: 'resolved', heldBeachIds: [], waterQualityStatusByBeachId: {}, epoch: 'clear' });
  });
  afterEach(() => {
    jest.useRealTimers();
    if (originalFlag === undefined) delete process.env.WEEK_SCOUT_ENDPOINT_ENABLED;
    else process.env.WEEK_SCOUT_ENDPOINT_ENABLED = originalFlag;
  });

  it('finds the advanced multi-board winner past eight; caps results only after ranking', async () => {
    const forecasts = new Map(BEACHES.map((beach, index) => [beach.id, rows(beach, index === 29 ? 4.4 : 2.9)]));
    mockDependencies = dependencies('advanced', ACCOUNT_BOARDS, forecasts);
    const forward = await call(BEACHES.map((beach) => beach.id));
    const reverse = await call(BEACHES.map((beach) => beach.id).reverse());
    expect(best(forward)?.beachId).toBe(BEACHES[29].id);
    expect(best(reverse)?.beachId).toBe(BEACHES[29].id);
    expect(reverse).toEqual(forward);
    expect(forward.days[0].windows.length).toBe(8);
    expect(best(forward)?.rankedSpots).toHaveLength(8);
    expect(mockDependencies.fetchForecasts).toHaveBeenCalledTimes(2);
    expect(mockDependencies.fetchForecasts).toHaveBeenCalledWith(expect.arrayContaining(BEACHES), 192);
    expect(forward.sessionDecision.selection?.beachId).toBe(BEACHES[29].id);
  });

  it('preserves EPIC-eligible 2.9-ft longboard scoring for the reported account', async () => {
    mockDependencies = dependencies('advanced', ACCOUNT_BOARDS, new Map([[BEACHES[0].id, rows(BEACHES[0], 2.9)]]));
    const response = await call([BEACHES[0].id]);
    expect(best(response)).toMatchObject({ safe: true, rideable: true, verdict: 'worth_it', forecast: { waveHeight: '2.9 ft' } });
    expect(best(response)!.conditionScore).toBeGreaterThanOrEqual(80);
  });

  it.each([...SKILL_LEVELS, null])('withholds disputed recommendations for %s without changing physical surf or board scores', async (skill) => {
    const forecasts = rows(BEACHES[0], 2.9).map((row) => ({ ...row, raw_forecast: {
      wave_source_selection: { reason: 'reported_inputs' as const, disagreement: true, noaa_height_m: 0.91, open_meteo_height_m: 1.58 },
    } }));
    mockDependencies = dependencies(skill, ACCOUNT_BOARDS, new Map([[BEACHES[0].id, forecasts]]));
    const response = await call([BEACHES[0].id]);
    expect(response.days[0].windows.length).toBeGreaterThan(0);
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.sessionDecision.selection).toBeNull();
    for (const window of response.days[0].windows) {
      expect(window).toMatchObject({ verdict: 'skip', forecast: { waveHeight: '2.9 ft' } });
      expect(window.takeaway).toContain('Wave forecasts disagree');
      expect(window.rankedSpots).toEqual([]);
    }
  });

  it.each([...SKILL_LEVELS, null])('keeps physical forecasts independent of skill %s', async (skill) => {
    const forecasts = new Map([[BEACHES[0].id, rows(BEACHES[0], 2.9)]]);
    const before = JSON.stringify([...forecasts]);
    mockDependencies = dependencies(skill, [], forecasts);
    const response = await call([BEACHES[0].id]);
    expect(response.days[0].windows).not.toHaveLength(0);
    expect(response.days[0].windows[0].forecast).toMatchObject({ waveHeight: '2.9 ft', period: '15s', swellDirection: 'SW', freshnessAt: NOW.toISOString() });
    expect(JSON.stringify([...forecasts])).toBe(before);
  });

  it('cannot promote a disputed high-scoring window over an available clear alternative', async () => {
    const disputed = rows(BEACHES[0], 4.4);
    disputed[2].raw_forecast = { wave_source_selection: {
      reason: 'reported_inputs', disagreement: true, noaa_height_m: 0.91, open_meteo_height_m: 1.58,
    } };
    mockDependencies = dependencies('advanced', ACCOUNT_BOARDS, new Map([
      [BEACHES[0].id, disputed], [BEACHES[1].id, rows(BEACHES[1], 2.9)],
    ]));
    const response = await call([BEACHES[0].id, BEACHES[1].id]);
    expect(best(response)?.beachId).toBe(BEACHES[1].id);
    expect(response.sessionDecision.selection?.beachId).toBe(BEACHES[1].id);
    expect(best(response)?.rankedSpots.map((spot) => spot.beachId)).toEqual([BEACHES[1].id]);
  });

  it.each(BOARD_CLASSES)('does not recommend unsafe large surf to beginners with %s', async (board) => {
    mockDependencies = dependencies('beginner', [board], new Map([[BEACHES[0].id, rows(BEACHES[0], 8)]]));
    const response = await call([BEACHES[0].id]);
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.sessionDecision.selection).toBeNull();
    expect(response.days[0].windows).not.toHaveLength(0);
    for (const window of response.days[0].windows) {
      expect(window.forecast.waveHeight).toBe('8 ft');
      expect(window.rankedSpots).toEqual([]);
    }
  });

  it.each(BOARD_CLASSES.map((board, index) => [board, SKILL_LEVELS[index % SKILL_LEVELS.length]] as const))(
    'ranks suitable clean surf above chop for %s / %s', async (board, skill) => {
      const band = getRideabilityBand(skill, board).ideal;
      const height = (band.min + band.max) / 2;
      mockDependencies = dependencies(skill, [board], new Map([
        [BEACHES[0].id, rows(BEACHES[0], height, 25)],
        [BEACHES[1].id, rows(BEACHES[1], height, 2)],
      ]));
      const response = await call([BEACHES[0].id, BEACHES[1].id]);
      expect(best(response)).toMatchObject({ beachId: BEACHES[1].id, safe: true, rideable: true });
      expect(best(response)!.rankedSpots[0].beachId).toBe(BEACHES[1].id);
    },
  );

  it('uses the same conservative scoring default as the safety default', async () => {
    const forecasts = new Map([[BEACHES[0].id, rows(BEACHES[0], 2.9)]]);
    mockDependencies = dependencies('beginner', [], forecasts);
    const beginner = await call([BEACHES[0].id]);
    mockDependencies = dependencies(null, [], forecasts);
    const unknown = await call([BEACHES[0].id]);
    expect(unknown.days).toEqual(beginner.days);
  });

  it.each(SKILL_LEVELS)('does not invent a surf suggestion on flat days for %s', async (skill) => {
    mockDependencies = dependencies(skill, [], new Map([[BEACHES[0].id, rows(BEACHES[0], 0)]]));
    const response = await call([BEACHES[0].id]);
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.sessionDecision.selection).toBeNull();
    expect(response.days[0].windows.flatMap((window) => window.rankedSpots)).toEqual([]);
  });

  it.each([null, '', 'not-a-skill'])('defaults missing/invalid profile %s to beginner safety', async (raw) => {
    mockDependencies = dependencies(parseSkillLevel(raw), [], new Map([[BEACHES[0].id, rows(BEACHES[0], 8)]]));
    const response = await call([BEACHES[0].id]);
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.sessionDecision.selection).toBeNull();
  });

  it('recomputes corrected rows and removes the newly unsafe selection', async () => {
    mockDependencies = dependencies('beginner', [], new Map([[BEACHES[0].id, rows(BEACHES[0], 2.9)]]));
    const before = await call([BEACHES[0].id]);
    expect(best(before)).toBeDefined();
    mockDependencies.fetchForecasts = async () => new Map([[BEACHES[0].id, rows(BEACHES[0], 8)]]);
    const after = await call([BEACHES[0].id]);
    expect(after.days[0].bestWindowId).toBeNull();
    expect(after.sessionDecision.selection).toBeNull();
  });

  it('removes a held winner from both selections and suggestions', async () => {
    mockDependencies = dependencies('advanced', ACCOUNT_BOARDS, new Map(BEACHES.slice(0, 2).map((beach, index) => [beach.id, rows(beach, index ? 4.4 : 2.9)])));
    mockResolveWaterQuality.mockResolvedValue({ state: 'resolved', heldBeachIds: [BEACHES[1].id], waterQualityStatusByBeachId: { [BEACHES[1].id]: 'closure' }, epoch: 'held' });
    const response = await call(BEACHES.slice(0, 2).map((beach) => beach.id));
    expect(best(response)?.beachId).toBe(BEACHES[0].id);
    expect(response.days[0].windows.every((window) => window.rankedSpots.every((spot) => spot.beachId !== BEACHES[1].id))).toBe(true);
  });

  it('keeps a full seven-day 30-beach request batched and the response bounded', async () => {
    const dates = Array.from({ length: 7 }, (_, day) => `2026-09-${String(day + 5).padStart(2, '0')}`);
    const forecasts = new Map(BEACHES.map((beach) => [beach.id, dates.flatMap((date) =>
      rows(beach, 4.4).map((row) => ({ ...row, id: `${row.id}:${date}`, forecast_at: row.forecast_at.replace(DATE, date) })),
    )]));
    mockDependencies = dependencies('advanced', ACCOUNT_BOARDS, forecasts);
    mockDependencies.fetchSunTimes = async (ids) => new Map(ids.map((id) => [id, {
      sunrises: dates.map((date) => new Date(`${date}T13:00:00Z`)),
      sunsets: [...dates, '2026-09-12'].map((date) => new Date(`${date}T02:00:00Z`)),
    }]));
    const response = await call(BEACHES.map((beach) => beach.id));
    expect(mockDependencies.fetchForecasts).toHaveBeenCalledTimes(1);
    expect(mockDependencies.fetchBeaches).toHaveBeenCalledTimes(1);
    expect(response.days).toHaveLength(7);
    for (const day of response.days) {
      expect(day.windows).toHaveLength(8);
      expect(day.bestWindowId).not.toBeNull();
      expect(day.windows.every((window) => window.rankedSpots.length === 8)).toBe(true);
    }
  });
});
