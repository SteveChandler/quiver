/**
 * @jest-environment node
 */

const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock('@/lib/recommendations/major-event-hold/service', () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) =>
    mockEvaluateMajorEventHoldCandidates(...args),
}));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(async () => ({ data: [], error: null })),
      })),
    })),
  })),
}));

import {
  generateWeekScoutForecast,
  generateWeekScoutForecastForDays,
  generateWeekScoutRankingForDays,
  type WeekScoutServiceDependencies,
} from '@/lib/services/discovery/week-scout';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import {
  calculateDistancePenalty,
  WORTH_THE_DRIVE_REASON,
} from '@/lib/services/discovery/distance-friction';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';

const BEACH_A = '11111111-1111-4111-8111-111111111111';
const BEACH_B = '22222222-2222-4222-8222-222222222222';
const K40_LOCATION = { lat: 32.2, lon: -116.91 };

function beach(id: string, name: string): Beach {
  return {
    id,
    name,
    lat: 21.3,
    lon: -157.8,
    is_private: false,
    skill_level: 'intermediate',
  } as Beach;
}

function forecast(beachId: string, forecastAt: string): EnhancedForecastEntity {
  return {
    id: `${beachId}:${forecastAt}`,
    beach_id: beachId,
    forecast_at: forecastAt,
    wave_height: '3.5',
    wave_period: '12s',
    wave_direction: 'NW',
    wind_speed: '5',
    wind_direction: 'E',
    tide_height: '1.4',
    tide_status: 'Rising',
    water_temp: '78°F',
    confidence_score: 82,
    data_source: 'NOAA_NWS',
    created_at: '2026-07-31T12:00:00.000Z',
    updated_at: '2026-07-31T13:30:00.000Z',
  } as EnhancedForecastEntity;
}

function dependencies(): WeekScoutServiceDependencies {
  const beaches = [beach(BEACH_A, 'Ala Moana'), beach(BEACH_B, 'Diamond Head')];
  const rows = new Map<string, EnhancedForecastEntity[]>(beaches.map((candidate) => [
    candidate.id,
    [
      forecast(candidate.id, '2026-07-31T16:00:00.000Z'),
      forecast(candidate.id, '2026-07-31T20:00:00.000Z'),
      forecast(candidate.id, '2026-08-01T00:00:00.000Z'),
    ],
  ]));

  return {
    now: new Date('2026-07-31T14:00:00.000Z'),
    fetchBeaches: jest.fn(async () => beaches),
    fetchForecasts: jest.fn(async () => rows),
    fetchSunTimes: jest.fn(async () => new Map()),
    fetchPreferences: jest.fn(async () => null),
    fetchSkill: jest.fn(async () => 'intermediate'),
    fetchPersonalizationContext: jest.fn(async () => null),
    calculatePersonalizationBonus: jest.fn(() => ({
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    })),
    selectBestWindow: jest.fn(({ forecasts }) => {
      const sourceForecast = forecasts[0];
      const start = new Date(sourceForecast.forecast_at);
      return {
        start,
        end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        peakTime: new Date(start.getTime() + 60 * 60 * 1000),
        tide: sourceForecast.tide_status ?? 'Unknown',
        wind: `${sourceForecast.wind_speed} ${sourceForecast.wind_direction}`,
        waveHeight: sourceForecast.wave_height ?? 'Unknown',
        wavePeriod: sourceForecast.wave_period ?? 'Unknown',
        dataSource: sourceForecast.data_source ?? 'unknown',
        confidence: sourceForecast.confidence_score ?? 0,
        timezone: 'Pacific/Honolulu',
        sourceForecast,
      };
    }),
    scoreWindowCondition: jest.fn((_forecast, candidateBeach) => (
      candidateBeach.id === BEACH_B ? 84 : 78
    )),
    scoreBeach: jest.fn((_beach, _forecast, options) => ({
      total: 80 + (options?.affinityBonus ?? 0),
      matchQuality: 'excellent',
      subscores: {
        waveHeightFit: 22,
        periodEnergyScore: 18,
        windAlignment: 19,
        tideFit: 14,
        affinityBonus: options?.affinityBonus ?? 0,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      reasons: ['Clean wind and solid period'],
      warnings: [],
    })),
    beachToSpotProfile: jest.fn(() => ({ kind: 'beach' } as never)),
    rankWindows: jest.fn((recommendations) => ({
      reranked: recommendations,
      diagnostics: recommendations.map((recommendation, index) => ({
        beachSlug: recommendation.beach.id,
        representativeSlotScore: recommendation.score,
        setupSuitability: 80,
        windAlignment: recommendation.subscores.windAlignment,
        tideFit: recommendation.subscores.tideFit,
        waveHeightFit: recommendation.subscores.waveHeightFit,
        periodEnergyScore: recommendation.subscores.periodEnergyScore,
        affinityBonus: recommendation.subscores.affinityBonus,
        windowDurationHours: 2,
        windowPersistence: 100,
        heroWindowScore: recommendation.beach.id === BEACH_B ? 88 : 82,
        finalRank: index,
        isHero: index === 0,
        sharedSetupSignal: { directionDeg: 315, periodS: 12, source: 'cluster-majority' },
      })),
    })),
  };
}

function k40Dependencies(rawScores: Record<string, number>): WeekScoutServiceDependencies {
  const deps = dependencies();
  const beaches = [
    { ...beach(BEACH_A, 'K-40'), ...K40_LOCATION },
    { ...beach(BEACH_B, 'Ocean Beach Pier'), lat: 32.749, lon: -117.252 },
  ];
  deps.fetchBeaches = jest.fn(async () => beaches);
  deps.rankWindows = jest.fn((recommendations) => ({
    reranked: recommendations,
    diagnostics: recommendations.map((recommendation, index) => ({
      beachSlug: recommendation.beach.id,
      representativeSlotScore: recommendation.score,
      setupSuitability: 80,
      windAlignment: recommendation.subscores.windAlignment,
      tideFit: recommendation.subscores.tideFit,
      waveHeightFit: recommendation.subscores.waveHeightFit,
      periodEnergyScore: recommendation.subscores.periodEnergyScore,
      affinityBonus: recommendation.subscores.affinityBonus,
      windowDurationHours: 2,
      windowPersistence: 100,
      heroWindowScore: rawScores[recommendation.beach.id],
      finalRank: index,
      isHero: index === 0,
      sharedSetupSignal: { directionDeg: 315, periodS: 12, source: 'cluster-majority' },
    })),
  }));
  return deps;
}

describe('generateWeekScoutForecast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        candidates.map(({ candidateId }) => ({
          candidateId,
          evaluation: {
            outcome: 'allow',
            holdIds: [],
            holdEpoch: 'week-scout-test-epoch',
          },
          recommendationAvailability: {
            state: 'available',
            holdEpoch: 'week-scout-test-epoch',
          },
        })),
    );
  });

  it('reuses canonical scoring for a two-day weekend request', async () => {
    const response = await generateWeekScoutForecastForDays(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 2,
      },
      dependencies(),
    );

    expect(response.days.map((day) => day.localDate)).toEqual([
      '2026-07-31',
      '2026-08-01',
    ]);
    expect(response.scorerVersion).toBe('week-scout-v1:discovery-hero-v1');
  });

  it('returns every scored-row partition and identifies the existing scorer focus only when material', async () => {
    const deps = dependencies();
    const rows = new Map<string, EnhancedForecastEntity[]>([
      [BEACH_A, [{
        ...forecast(BEACH_A, '2026-07-31T16:00:00.000Z'),
        swell_1_height: '2 ft', swell_1_period: '13s', swell_1_direction: 'SSW',
        swell_2_height: '3 ft', swell_2_period: '6s', swell_2_direction: 'W',
        wind_wave_height: '0 ft', wind_wave_period: null, wind_wave_direction: null,
      }]],
      [BEACH_B, [forecast(BEACH_B, '2026-07-31T16:00:00.000Z')]],
    ]);
    deps.fetchForecasts = jest.fn(async () => rows);

    const response = await generateWeekScoutForecastForDays('user-week-scout', {
      candidateBeachIds: [BEACH_A, BEACH_B],
      localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-31', dayCount: 1,
    }, deps);
    const window = response.days[0].windows.find((item) => item.beachId === BEACH_A);

    expect(window?.forecast.components).toEqual([
      expect.objectContaining({ kind: 'swell_1', height: '2 ft', period: '13s', direction: 'SSW', source: null }),
      expect.objectContaining({ kind: 'swell_2', height: '3 ft', period: '6s', direction: 'W', source: null }),
      expect.objectContaining({ kind: 'wind_sea', height: '0 ft', period: null, direction: null, source: null }),
    ]);
    expect(window?.forecast.scoringComponent).toBe('swell_2');
  });

  it('preserves every allowed two-day window for Weekend Scout ranking', async () => {
    const response = await generateWeekScoutRankingForDays(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 2,
      },
      dependencies(),
    );

    expect(response.days).toHaveLength(2);
    expect(response.days[0].windows).toHaveLength(6);
    expect(response.days[0].windows.every((window) => (
      window.rankingScore !== null
      && window.conditionScore !== null
      && window.safe !== null
      && window.rideable !== null
    ))).toBe(true);
  });

  it.each([0, 8, 1.5])('rejects unsupported internal dayCount %s', async (dayCount) => {
    await expect(
      generateWeekScoutForecastForDays(
        'user-week-scout',
        {
          candidateBeachIds: [BEACH_A],
          localTimezone: 'Pacific/Honolulu',
          startLocalDate: '2026-08-01',
          dayCount,
        },
        dependencies(),
      ),
    ).rejects.toThrow(/dayCount/i);
  });

  it('retains every daily ranking while adding one supplemental canonical weekly session', async () => {
    const deps = dependencies();
    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      deps,
    );

    expect(response.days).toHaveLength(7);
    expect(response.days.map((day) => day.localDate)).toEqual([
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);

    const firstDay = response.days[0];
    expect(firstDay.windows).toHaveLength(6);
    expect(new Set(firstDay.windows.map((window) => window.bucket))).toEqual(
      new Set(['morning', 'midday', 'evening']),
    );
    expect(firstDay.windows.filter((window) => window.bucket === 'morning')).toHaveLength(2);
    expect(response.sessionDecision).toMatchObject({
      verdict: 'go',
      selection: {
        beachId: BEACH_B,
      },
      skillEligibility: {
        skill: 'intermediate',
        state: 'eligible',
      },
    });
    const selectedId = response.sessionDecision.selection?.candidateId;
    const visibleDecisions = response.days.flatMap((day) => day.windows);
    expect(visibleDecisions).toHaveLength(6);
    expect(visibleDecisions.every((window) => (
      window.verdict !== null
      && window.conditionScore !== null
      && window.rankingScore !== null
      && window.rideable !== null
      && window.safe !== null
      && window.takeaway !== null
      && window.rankedSpots.length > 0
    ))).toBe(true);
    expect(
      response.days.flatMap((day) => day.windows).every((window) => (
        window.forecast.waveHeight === '3.5'
        && window.forecast.period === '12s'
        && window.forecast.waterTemp === '78°F'
        && window.forecast.tideHeightFt === 1.4
      )),
    ).toBe(true);

    const winner = response.days
      .flatMap((day) => day.windows)
      .find((window) => window.id === selectedId);
    expect(winner).toMatchObject({
      beachId: BEACH_B,
      bucket: 'morning',
      verdict: 'worth_it',
      conditionScore: 84,
      rankingScore: 88,
      rideable: true,
      safe: true,
      forecast: {
        waterTemp: '78°F',
        tideHeightFt: 1.4,
        tidePhase: 'Rising',
        freshnessAt: '2026-07-31T13:30:00.000Z',
      },
      takeaway: 'Clean wind and solid period',
      rankedSpots: expect.arrayContaining([
        expect.objectContaining({ beachId: BEACH_A }),
        expect.objectContaining({ beachId: BEACH_B }),
      ]),
    });
    expect(firstDay.bestWindowId).toBe(selectedId);
    expect(response.days.slice(1).every((day) => day.bestWindowId === null)).toBe(true);
    expect(firstDay.exclusionReasons).toEqual([]);
    expect(response.days.slice(1).every((day) => (
      day.exclusionReasons.length === 1
      && day.exclusionReasons[0] === 'no_forecasts'
    ))).toBe(true);

    expect(deps.selectBestWindow).toHaveBeenCalledTimes(6);
    expect(deps.rankWindows).toHaveBeenCalledTimes(3);
  });

  it('scores a broad drive-range pool but returns only eight ranked windows per bucket', async () => {
    const candidates = Array.from({ length: 10 }, (_, index) => beach(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      `Beach ${index + 1}`,
    ));
    const deps = dependencies();
    deps.fetchBeaches = jest.fn(async () => candidates);
    deps.fetchForecasts = jest.fn(async () => new Map(
      candidates.map((candidate) => [
        candidate.id,
        [
          forecast(candidate.id, '2026-07-31T16:00:00.000Z'),
          forecast(candidate.id, '2026-07-31T20:00:00.000Z'),
          forecast(candidate.id, '2026-08-01T00:00:00.000Z'),
        ],
      ]),
    ));

    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: candidates.map((candidate) => candidate.id),
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      deps,
    );

    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.any(Array),
      }),
    );
    const evaluatedCandidates = mockEvaluateMajorEventHoldCandidates.mock.calls.at(-1)?.[0]
      .candidates as unknown[];
    expect(deps.fetchBeaches).toHaveBeenCalledWith(
      candidates.map((candidate) => candidate.id),
    );
    expect(evaluatedCandidates).toHaveLength(30);
    expect(response.days[0].windows).toHaveLength(24);
    expect(response.days[0].windows.every((window) => (
      window.rankedSpots.length <= 8
    ))).toBe(true);
    expect(response.days[0].windows.some((window) => (
      window.id === response.days[0].bestWindowId
    ))).toBe(true);
  });

  it('generates the same candidate fingerprint regardless of input order', async () => {
    const first = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      dependencies(),
    );
    const second = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_B, BEACH_A],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      dependencies(),
    );

    expect(first.candidateFingerprint).toBe(second.candidateFingerprint);
  });

  it('counts pre-cap evaluated rows separately from missing rows and selector rejections', async () => {
    const deps = dependencies();
    const ids = Array.from({ length: 10 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    const evaluatedIds = ids.slice(0, 9);
    deps.fetchBeaches = jest.fn(async () => ids.map((id) => beach(id, id)));
    deps.fetchForecasts = jest.fn(async () => new Map(evaluatedIds.map((id) => [
      id,
      [forecast(id, '2026-07-31T16:00:00.000Z')],
    ])));
    const defaultSelect = deps.selectBestWindow;
    deps.selectBestWindow = jest.fn((options) => (
      options.forecasts[0].beach_id === ids[8] ? null : defaultSelect(options)
    ));

    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: ids,
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31',
      dayCount: 7,
    }, deps);

    expect(response.coverage?.days[0]).toEqual(expect.objectContaining({
      eligible: 10,
      evaluated: 9,
      missing: 1,
      excluded: null,
    }));
    expect(response.coverage?.days[0].buckets).toEqual([
      expect.objectContaining({ bucket: 'morning', eligible: 10, evaluated: 9, missing: 1, noWindow: 1 }),
      expect.objectContaining({ bucket: 'midday', eligible: 10, evaluated: 0, missing: 10, noWindow: 0 }),
      expect.objectContaining({ bucket: 'evening', eligible: 10, evaluated: 0, missing: 10, noWindow: 0 }),
    ]);
    expect(response.days[0].windows.length).toBeLessThanOrEqual(8);
  });

  it('retains the requested eligible denominator when beach hydration omits an ID', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    const hydratedIds = ids.slice(0, 9);
    const deps = dependencies();
    deps.fetchBeaches = jest.fn(async () => hydratedIds.map((id) => beach(id, id)));
    deps.fetchForecasts = jest.fn(async () => new Map(hydratedIds.map((id) => [
      id, [forecast(id, '2026-07-31T16:00:00.000Z')],
    ])));

    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: ids,
      localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-31', dayCount: 7,
    }, deps);

    expect(response.coverage?.days[0]).toEqual(expect.objectContaining({
      eligible: 10, evaluated: 9, missing: 1,
    }));
  });

  it('marks a high-scoring window unrideable when its size exceeds the surfer skill band', async () => {
    const deps = dependencies();
    const largeForecast = {
      ...forecast(BEACH_A, '2026-07-31T16:00:00.000Z'),
      wave_height: '20',
    };
    deps.fetchBeaches = jest.fn(async () => [beach(BEACH_A, 'Ala Moana')]);
    deps.fetchForecasts = jest.fn(async () => new Map([[BEACH_A, [largeForecast]]]));
    deps.scoreBeach = jest.fn(() => ({
      total: 90,
      matchQuality: 'perfect',
      subscores: {
        waveHeightFit: 25,
        periodEnergyScore: 20,
        windAlignment: 20,
        tideFit: 15,
        affinityBonus: 0,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      reasons: ['Powerful swell'],
      warnings: [],
    }));

    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      deps,
    );

    expect(response.sessionDecision).toMatchObject({
      verdict: 'no',
      reasonCode: 'wave_height_exceeds_skill',
      selection: null,
    });
    expect(response.days[0].windows[0]).toMatchObject({
      verdict: 'worth_it',
      rideable: false,
      safe: true,
      forecast: {
        waveHeight: '20',
      },
    });
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual(['no_rideable_windows']);
  });

  it('explains when every generated window is unsafe', async () => {
    const deps = dependencies();
    deps.scoreBeach = jest.fn(() => ({
      total: 82,
      matchQuality: 'excellent',
      subscores: {
        waveHeightFit: 22,
        periodEnergyScore: 18,
        windAlignment: 19,
        tideFit: 14,
        affinityBonus: 0,
        personalizationBonus: 0,
        distancePenalty: 0,
      },
      reasons: ['Strong conditions'],
      warnings: ['Unsafe hazard at this beach'],
    }));

    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      deps,
    );

    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual(['no_safe_windows']);
  });

  it('explains when safe rideable windows all have skip verdicts', async () => {
    const deps = dependencies();
    deps.scoreWindowCondition = jest.fn(() => 30);

    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      deps,
    );

    expect(response.days[0].windows[0]).toMatchObject({
      safe: true,
      rideable: true,
      verdict: 'skip',
    });
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual([
      'no_recommendable_windows',
    ]);
  });

  it('evaluates exact generated windows with the verified profile skill', async () => {
    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      dependencies(),
    );
    const firstWindow = response.days[0].windows[0];

    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: expect.arrayContaining([
        {
          candidateId: firstWindow.id,
          beachId: firstWindow.beachId,
          startsAt: firstWindow.start,
          endsAt: firstWindow.end,
        },
      ]),
      profileExperience: 'intermediate',
      applyWaterQualityHolds: true,
    });
    expect(mockEvaluateMajorEventHoldCandidates.mock.calls[0][0].candidates).toHaveLength(6);
    expect(response.recommendationAvailability).toEqual({
      state: 'available',
      holdEpoch: 'week-scout-test-epoch',
    });
  });

  it('removes a water-quality-held beach from Week Scout recommendations', async () => {
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      async ({ candidates }: { candidates: Array<{ candidateId: string; beachId: string }> }) =>
        candidates.map(({ candidateId, beachId }) => {
          const held = beachId === BEACH_A;
          return {
            candidateId,
            evaluation: held
              ? {
                  outcome: 'explicit_none' as const,
                  reasonCode: 'water_quality_hold' as const,
                  holdIds: [`water-quality:${beachId}`],
                  holdEpoch: 'week-scout-water-quality-epoch',
                }
              : {
                  outcome: 'allow' as const,
                  holdIds: [],
                  holdEpoch: 'week-scout-water-quality-epoch',
                },
            recommendationAvailability: held
              ? {
                  state: 'none' as const,
                  reasonCode: 'water_quality_hold' as const,
                  holdEpoch: 'week-scout-water-quality-epoch',
                }
              : {
                  state: 'available' as const,
                  holdEpoch: 'week-scout-water-quality-epoch',
                },
          };
        }),
    );

    const response = await generateWeekScoutForecastForDays(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 2,
      },
      dependencies(),
    );

    const heldWindows = response.days.flatMap((day) =>
      day.windows.filter((window) => window.beachId === BEACH_A),
    );
    const allowedWindows = response.days.flatMap((day) =>
      day.windows.filter((window) => window.beachId === BEACH_B),
    );
    expect(heldWindows).toHaveLength(0);
    expect(allowedWindows).toHaveLength(3);
    expect(allowedWindows.every((window) => window.rankingScore !== null)).toBe(true);
    expect(response.recommendationAvailability).toMatchObject({
      state: 'available',
    });
  });

  it('returns explicit none recommendation semantics while preserving physical day data when held', async () => {
    mockEvaluateMajorEventHoldCandidates.mockImplementationOnce(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
        candidates.map(({ candidateId }) => ({
          candidateId,
          evaluation: {
            outcome: 'explicit_none',
            reasonCode: 'major_event_hold',
            holdIds: ['hold-1'],
            expiresAt: '2026-08-02T00:00:00.000Z',
            holdEpoch: 'held-epoch',
          },
          recommendationAvailability: {
            state: 'none',
            reasonCode: 'major_event_hold',
            expiresAt: '2026-08-02T00:00:00.000Z',
            holdEpoch: 'held-epoch',
          },
        })),
    );

    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      dependencies(),
    );
    const firstWindow = response.days[0].windows[0];

    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual([]);
    expect(firstWindow).toMatchObject({
      beachId: expect.any(String),
      start: expect.any(String),
      end: expect.any(String),
      forecast: {
        waveHeight: '3.5',
        period: '12s',
        tideHeightFt: 1.4,
      },
      conditionScore: null,
      rankingScore: null,
      verdict: null,
      takeaway: null,
      rankedSpots: [],
    });
    expect(response.recommendationAvailability).toMatchObject({
      state: 'none',
      reasonCode: 'major_event_hold',
    });
    expect(response.sessionDecision).toMatchObject({
      verdict: 'no',
      reasonCode: 'major_event_hold',
      selection: null,
    });
  });

  it('fails malformed hold decisions closed without dropping physical windows', async () => {
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([]);

    const response = await generateWeekScoutForecast(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 7,
      },
      dependencies(),
    );

    expect(response.days[0].windows).toHaveLength(6);
    expect(response.days[0].windows[0].forecast.waveHeight).toBe('3.5');
    expect(response.days[0].windows[0].conditionScore).toBeNull();
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual([]);
    expect(response.recommendationAvailability).toMatchObject({
      state: 'none',
      reasonCode: 'hold_state_unavailable',
    });
    expect(response.sessionDecision).toMatchObject({
      verdict: 'no',
      reasonCode: 'hold_state_unavailable',
      selection: null,
    });
  });

  it('ranks the near K-40 candidate above a modestly stronger raw Ocean Beach score', async () => {
    const rawScores = { [BEACH_A]: 82, [BEACH_B]: 89 };
    const response = await generateWeekScoutForecastForDays(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 1,
        userLocation: K40_LOCATION,
      },
      k40Dependencies(rawScores),
    );
    const morning = response.days[0].windows.filter(({ bucket }) => bucket === 'morning');
    const winner = response.days[0].windows.find(
      ({ id }) => id === response.days[0].bestWindowId,
    );
    const farDistance = calculateDistanceInMiles(K40_LOCATION, {
      lat: 32.749,
      lon: -117.252,
    });

    expect(morning[0].beachId).toBe(BEACH_A);
    expect(winner?.beachId).toBe(BEACH_A);
    expect(morning.find(({ beachId }) => beachId === BEACH_B)?.rankingScore).toBe(
      rawScores[BEACH_B] + calculateDistancePenalty(farDistance),
    );
  });

  it('keeps a much stronger distant winner and marks it worth the drive', async () => {
    const response = await generateWeekScoutForecastForDays(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 1,
        userLocation: K40_LOCATION,
      },
      k40Dependencies({ [BEACH_A]: 82, [BEACH_B]: 98 }),
    );
    const winner = response.days[0].windows.find(
      ({ id }) => id === response.days[0].bestWindowId,
    );

    expect(winner?.beachId).toBe(BEACH_B);
    expect(winner?.rankedSpots.find(({ beachId }) => beachId === BEACH_B)?.reason).toBe(
      WORTH_THE_DRIVE_REASON,
    );
  });

  it('preserves ranking scores exactly when request coordinates are unavailable', async () => {
    const rawScores = { [BEACH_A]: 82, [BEACH_B]: 83 };
    const response = await generateWeekScoutForecastForDays(
      'user-week-scout',
      {
        candidateBeachIds: [BEACH_A, BEACH_B],
        localTimezone: 'Pacific/Honolulu',
        startLocalDate: '2026-07-31',
        dayCount: 1,
      },
      k40Dependencies(rawScores),
    );
    const morning = response.days[0].windows.filter(({ bucket }) => bucket === 'morning');

    expect(morning.map(({ beachId, rankingScore }) => ({ beachId, rankingScore }))).toEqual([
      { beachId: BEACH_B, rankingScore: rawScores[BEACH_B] },
      { beachId: BEACH_A, rankingScore: rawScores[BEACH_A] },
    ]);
  });
});
