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
import { buildCanonicalDecisionFromSurfDiscovery } from '@/lib/recommendations/canonical-decision/discovery-adapter';
import { resolveRecommendationLabel } from '@/lib/services/discovery/recommendation-label';
import { getQualityLabel } from '@/lib/utils/score-color-utils';
import { verdictFromRecommendationLabel } from '@/lib/utils/surf-call-logic';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import {
  calculateDistancePenalty,
  WORTH_THE_DRIVE_REASON,
} from '@/lib/services/discovery/distance-friction';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';
import { deriveDisplayWindow } from '@/lib/services/discovery/window-authority';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';

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
    timezone: 'Pacific/Honolulu',
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

  const selectBestWindows = jest.fn((options: WindowSelectorOptions) => (
    options.forecasts.map((sourceForecast) => {
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
    })
  ));

  return {
    now: new Date('2026-07-31T14:00:00.000Z'),
    fetchBeaches: jest.fn(async () => beaches),
    fetchForecasts: jest.fn(async () => rows),
    fetchSunTimes: jest.fn(async () => new Map()),
    fetchRankingContext: jest.fn(async () => ({
      implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), implicitWeight: 0,
    })),
    fetchSkill: jest.fn(async () => 'intermediate'),
    fetchMatchEvidence: jest.fn(async () => new Map()),
    calculatePersonalizationBonus: jest.fn(() => ({
      affinityBonus: 0,
      personalizationBonus: 0,
      reasons: [],
    })),
    selectBestWindows: selectBestWindows as unknown as WeekScoutServiceDependencies['selectBestWindows'],
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

  it('keeps Avalanche at 64 MAYBE/FAIR despite an advanced longboard personalization boost', async () => {
    const deps = dependencies();
    const avalanche = { ...beach(BEACH_A, 'Avalanche'), skill_level: 'advanced', timezone: 'America/Los_Angeles' };
    deps.now = new Date('2026-09-22T19:30:00.000Z');
    const row = { ...forecast(BEACH_A, '2026-09-23T18:00:00.000Z'), wave_height: '2.4 ft' };
    deps.fetchBeaches = jest.fn(async () => [avalanche]);
    deps.fetchForecasts = jest.fn(async () => new Map([[BEACH_A, [row]]]));
    deps.fetchSkill = jest.fn(async () => 'advanced');
    // Southpoint longboard 2+1 is a board name; scoring consumes its longboard class.
    deps.fetchBoardClasses = jest.fn(async () => ['longboard' as const]);
    deps.fetchRankingContext = jest.fn(async () => ({} as never));
    deps.calculatePersonalizationBonus = jest.fn(() => ({
      affinityBonus: 8, personalizationBonus: 6, reasons: ['Wind matches your usual sessions'],
    }));
    deps.scoreWindowCondition = jest.fn(() => 64);
    const response = await generateWeekScoutRankingForDays('user-avalanche', {
      candidateBeachIds: [BEACH_A], localTimezone: 'America/Los_Angeles',
      startLocalDate: '2026-09-23', dayCount: 1,
    }, deps);
    const windows = response.days[0].windows;
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ conditionScore: 64, verdict: 'maybe', rankingScore: 82 });
    expect(windows[0].rankedSpots).toEqual([
      expect.objectContaining({ conditionScore: 64, verdict: 'maybe', rankingScore: 82 }),
    ]);
    const recommendation = (deps.rankWindows as jest.Mock).mock.calls
      .flatMap(([recs]: [SurfDiscoveryRecommendation[]]) => recs)[0];
    const call = buildCanonicalDecisionFromSurfDiscovery({
      anchorTime: deps.now.toISOString(),
      scope: {
        kind: 'plan_next_session', windowStart: deps.now.toISOString(),
        windowEnd: '2026-09-24T00:00:00.000Z', timezone: 'America/Los_Angeles',
      },
      profileExperience: 'Advanced',
      recommendationAvailability: { state: 'available', holdEpoch: 'regression' },
      recommendations: [{ ...recommendation, score: 64 }],
    });
    expect(call.verdict).toBe('maybe');
    expect(call.selection!.evidence).toMatchObject({ conditionScore: 64, recommendationLabel: 'Maybe' });
    expect(verdictFromRecommendationLabel(call.selection!.evidence.recommendationLabel!)).toBe('MAYBE');
    expect(getQualityLabel(windows[0].conditionScore!)).toBe('FAIR');
    expect(getQualityLabel(call.selection!.evidence.conditionScore)).toBe('FAIR');
    expect(deps.scoreWindowCondition).toHaveBeenCalledWith(row, avalanche, 'advanced', ['longboard']);
    expect(deps.rankWindows).toHaveBeenCalledWith([
      expect.objectContaining({ score: 78 }),
    ]);
  });

  it.each(
    ([null, 'beginner', 'intermediate', 'advanced', 'expert'] as const).flatMap((skill) =>
      [0, 39, 40, 54, 55, 64, 69, 70, 79, 80, 100].flatMap((score) =>
        ([null, 'GOOD', 'FAIR', 'MEH'] as const).map((matchLabel) => ({ skill, score, matchLabel })),
      ),
    ),
  )('matches surf-call for score=$score skill=$skill learned=$matchLabel', async ({ skill, score, matchLabel }) => {
    const deps = dependencies();
    const candidateBeach = { ...beach(BEACH_A, 'Safe beach'), skill_level: 'beginner' };
    const row = { ...forecast(BEACH_A, '2026-07-31T20:00:00.000Z'), wave_height: '2.4 ft' };
    const similarity: SurfDiscoveryRecommendation['similarity'] = matchLabel === null ? null : {
      state: 'ready', score: 7, label: matchLabel, confidence: 'high',
      bonusApplied: 0, reason: 'History', reasons: ['History'], sessionCount: 20,
    };
    deps.fetchBeaches = jest.fn(async () => [candidateBeach]);
    deps.fetchForecasts = jest.fn(async () => new Map([[BEACH_A, [row]]]));
    deps.fetchSkill = jest.fn(async (): Promise<SkillLevel | null> => skill);
    deps.fetchBoardClasses = jest.fn(async () => ['longboard' as const]);
    deps.scoreWindowCondition = jest.fn(() => score);
    deps.fetchMatchEvidence = jest.fn(async () => new Map([[`${row.beach_id}:${row.forecast_at}`, similarity]]));
    const ranked = await generateWeekScoutRankingForDays('user-parity', {
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31', dayCount: 1,
    }, deps);
    const window = ranked.days[0].windows[0];
    expect(window).toMatchObject({ beachId: BEACH_A, conditionScore: score });
    const call = buildCanonicalDecisionFromSurfDiscovery({
      anchorTime: deps.now.toISOString(),
      scope: {
        kind: 'plan_next_session', windowStart: deps.now.toISOString(),
        windowEnd: '2026-08-01T14:00:00.000Z', timezone: 'Pacific/Honolulu',
      },
      profileExperience: skill,
      recommendationAvailability: { state: 'available', holdEpoch: 'parity' },
      recommendations: [{
        recommendationId: window.id, beach: candidateBeach, forecast: row,
        window: { start: new Date(window.start), end: new Date(window.end), timezone: 'Pacific/Honolulu' },
        score, similarity,
        recommendationLabel: resolveRecommendationLabel({ beach: candidateBeach, forecast: row, score }).label,
      } as SurfDiscoveryRecommendation],
    });
    expect(call.selection).not.toBeNull();
    const verdicts = { worth_it: 'go', maybe: 'maybe', skip: 'no' } as const;
    expect(verdicts[window.verdict!]).toBe(call.verdict);
    const labels = { worth_it: 'Worth it', maybe: 'Maybe', skip: 'Skip' } as const;
    expect(labels[window.verdict!]).toBe(call.selection!.evidence.recommendationLabel);
    expect(window.conditionScore).toBe(score);
    expect(window.rankingScore).toBe(82);
    expect(deps.fetchMatchEvidence).toHaveBeenCalledTimes(1);
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
    expect(response.scorerVersion).toBe('week-scout-v2:day-window-authority-v1');
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
    for (const window of firstDay.windows) {
      const display = deriveDisplayWindow({
        rawStart: new Date(window.start),
        rawEnd: new Date(window.end),
        peak: new Date(window.peakTime),
        timezone: 'Pacific/Honolulu',
      });
      expect(window.displayWindowStart).toBe(display.start.toISOString());
      expect(window.displayWindowEnd).toBe(display.end.toISOString());
    }

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
    expect(firstDay.bestDayWindow).toBe(winner);
    expect(response.days.slice(1).every((day) => day.bestWindowId === null)).toBe(true);
    expect(response.days.slice(1).every((day) => day.bestDayWindow === null)).toBe(true);
    expect(firstDay.exclusionReasons).toEqual([]);
    expect(response.days.slice(1).every((day) => (
      day.exclusionReasons.length === 1
      && day.exclusionReasons[0] === 'no_forecasts'
    ))).toBe(true);

    expect(deps.selectBestWindows).toHaveBeenCalledTimes(2);
    expect((deps.selectBestWindows as jest.Mock).mock.calls.every(
      ([options]: [WindowSelectorOptions]) => options.forecasts.length === 3,
    )).toBe(true);
    expect(deps.rankWindows).toHaveBeenCalledTimes(3);
  });

  it('week scout names the same window as the full-day selector for the same beach and day', async () => {
    const deps = dependencies();
    const morningForecast = forecast(BEACH_A, '2026-07-31T16:00:00.000Z');
    const eveningForecast = forecast(BEACH_A, '2026-08-01T02:00:00.000Z');
    deps.fetchBeaches = jest.fn(async () => [beach(BEACH_A, 'Ala Moana')]);
    deps.fetchForecasts = jest.fn(async () => new Map([[
      BEACH_A,
      [morningForecast, eveningForecast],
    ]]));
    const defaultRankWindows = deps.rankWindows;
    deps.rankWindows = jest.fn((recommendations) => {
      const ranked = defaultRankWindows(recommendations);
      return {
        ...ranked,
        diagnostics: ranked.diagnostics.map((diagnostic, index) => ({
          ...diagnostic,
          heroWindowScore:
            recommendations[index].window.peakTime?.toISOString()
              === '2026-08-01T03:00:00.000Z'
              ? 99
              : 60,
        })),
      };
    });

    const response = await generateWeekScoutForecastForDays('user-week-scout', {
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31',
      dayCount: 1,
    }, deps);

    expect(deps.selectBestWindows).toHaveBeenCalledTimes(1);
    const day = response.days[0];
    const morning = day.windows.find(({ bucket }) => bucket === 'morning');
    const evening = day.windows.find(({ bucket }) => bucket === 'evening');
    expect(morning).toMatchObject({
      isBeachDayBest: true,
      start: '2026-07-31T16:00:00.000Z',
      end: '2026-07-31T18:00:00.000Z',
    });
    expect(evening).toMatchObject({
      isBeachDayBest: false,
      rankingScore: 99,
    });
    expect(morning?.rankingScore).toBe(60);
    expect(day.windows).toHaveLength(2);
    expect(day.bestWindowId).toBe(morning?.id);
    expect(day.bestDayWindow).toBe(morning);
    expect(response.sessionDecision.selection?.candidateId).toBe(morning?.id);
  });

  it('does not promote a recommendable preview when the beach day best is skip', async () => {
    const deps = dependencies();
    const morningForecast = forecast(BEACH_A, '2026-07-31T16:00:00.000Z');
    const eveningForecast = forecast(BEACH_A, '2026-08-01T02:00:00.000Z');
    deps.fetchBeaches = jest.fn(async () => [beach(BEACH_A, 'Ala Moana')]);
    deps.fetchForecasts = jest.fn(async () => new Map([[
      BEACH_A,
      [morningForecast, eveningForecast],
    ]]));
    deps.scoreWindowCondition = jest.fn((sourceForecast) => (
      sourceForecast === morningForecast ? 30 : 80
    ));

    const response = await generateWeekScoutForecastForDays('user-week-scout', {
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31',
      dayCount: 1,
    }, deps);

    const day = response.days[0];
    expect(day.windows.find(({ isBeachDayBest }) => isBeachDayBest)).toMatchObject({
      bucket: 'morning',
      verdict: 'skip',
    });
    expect(day.windows.find(({ isBeachDayBest }) => !isBeachDayBest)).toMatchObject({
      bucket: 'evening',
      verdict: 'worth_it',
    });
    expect(day.bestWindowId).toBeNull();
    expect(day.bestDayWindow).toBeNull();
    expect(day.exclusionReasons).toEqual(['no_recommendable_windows']);
    expect(response.sessionDecision.selection).toBeNull();
  });

  it('assigns dayparts and coverage in the beach timezone', async () => {
    const deps = dependencies();
    const losAngelesBeach = {
      ...beach(BEACH_A, 'Ocean Beach'),
      timezone: 'America/Los_Angeles',
    } as Beach;
    deps.fetchBeaches = jest.fn(async () => [losAngelesBeach]);
    deps.fetchForecasts = jest.fn(async () => new Map([[
      BEACH_A,
      [forecast(BEACH_A, '2026-07-31T18:00:00.000Z')],
    ]]));

    const response = await generateWeekScoutForecastForDays('user-week-scout', {
      candidateBeachIds: [BEACH_A],
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31',
      dayCount: 1,
    }, deps);

    expect(response.days[0].windows).toHaveLength(1);
    expect(response.days[0].windows[0].bucket).toBe('midday');
    expect(response.coverage?.days[0].buckets).toEqual([
      expect.objectContaining({ bucket: 'morning', evaluated: 0, missing: 1, noWindow: 0 }),
      expect.objectContaining({ bucket: 'midday', evaluated: 1, missing: 0, noWindow: 0 }),
      expect.objectContaining({ bucket: 'evening', evaluated: 0, missing: 1, noWindow: 0 }),
    ]);
    expect(response.sessionDecision.selection?.timezone).toBe('America/Los_Angeles');
  });

  it('scores only 252 returned slots out of 420 drafts for 20 beaches over seven days', async () => {
    const candidates = Array.from({ length: 20 }, (_, index) => beach(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, `Beach ${index}`,
    ));
    const deps = dependencies();
    deps.fetchBeaches = jest.fn(async () => candidates);
    const rows = candidates.map((candidate) => [candidate.id, Array.from({ length: 7 }, (_, day) =>
      [16, 20, 24].map((hour) => forecast(candidate.id,
        new Date(Date.UTC(2026, 6, 31 + day, hour)).toISOString())),
    ).flat()] as const);
    deps.fetchForecasts = jest.fn(async () => new Map(rows));
    deps.fetchMatchEvidence = jest.fn(async (_user, _ids, forecasts) => new Map(
      forecasts.map((row) => [`${row.beach_id}:${row.forecast_at}`, row.beach_id === candidates[0].id ? {
        state: 'ready' as const, score: 1, label: 'MEH', confidence: 'high' as const,
        bonusApplied: 0, reason: 'Mismatch', reasons: ['Mismatch'], sessionCount: 25, similarSessionCount: 5,
      } : null]),
    ));
    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: candidates.map((candidate) => candidate.id),
      localTimezone: 'Pacific/Honolulu', startLocalDate: '2026-07-31', dayCount: 7,
    }, deps);
    const returned = response.days.flatMap((day) => day.windows);
    expect(rows.flatMap(([, forecasts]) => forecasts)).toHaveLength(420);
    expect(returned).toHaveLength(252); // 20 day-bests + 8 midday + 8 evening per day.
    expect(deps.fetchMatchEvidence).toHaveBeenCalledTimes(1);
    const scored = (deps.fetchMatchEvidence as jest.Mock).mock.calls[0][2] as EnhancedForecastEntity[];
    expect(scored).toHaveLength(252);
    expect(new Set(scored.map((row) => `${row.beach_id}:${row.forecast_at}`))).toEqual(
      new Set(returned.map((window) => `${window.beachId}:${window.start}`)),
    );
    expect((deps.rankWindows as jest.Mock).mock.invocationCallOrder.every((order) =>
      order < (deps.fetchMatchEvidence as jest.Mock).mock.invocationCallOrder[0])).toBe(true);
    expect(returned[0].rankedSpots[0]).toMatchObject({ beachId: candidates[0].id, verdict: 'maybe' });
    for (const day of response.days) {
      expect(day.bestWindowId).not.toBeNull();
      expect(day.windows.find((window) => window.id === day.bestWindowId)?.verdict).not.toBe('skip');
    }
  });

  it('caps previews at eight per bucket without compacting away beach day bests', async () => {
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
      { resolveWaterQualityHolds: expect.any(Function) },
    );
    const evaluatedCandidates = mockEvaluateMajorEventHoldCandidates.mock.calls.at(-1)?.[0]
      .candidates as unknown[];
    expect(deps.fetchBeaches).toHaveBeenCalledWith(
      candidates.map((candidate) => candidate.id),
    );
    expect(evaluatedCandidates).toHaveLength(30);
    expect(response.days[0].windows.filter(({ bucket }) => bucket === 'morning')).toHaveLength(10);
    expect(response.days[0].windows.filter(({ bucket }) => bucket === 'midday')).toHaveLength(8);
    expect(response.days[0].windows.filter(({ bucket }) => bucket === 'evening')).toHaveLength(8);
    expect(response.days[0].windows).toHaveLength(26);
    expect(response.days[0].windows.every((window) => (
      window.rankedSpots.length <= 8
    ))).toBe(true);
    expect(response.days[0].windows.some((window) => (
      window.id === response.days[0].bestWindowId
    ))).toBe(true);
  });

  it('keeps a ninth beach day best when compacting a single bucket', async () => {
    const candidates = Array.from({ length: 9 }, (_, index) => beach(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      `Beach ${index + 1}`,
    ));
    const deps = dependencies();
    deps.fetchBeaches = jest.fn(async () => candidates);
    deps.fetchForecasts = jest.fn(async () => new Map(
      candidates.map((candidate) => [
        candidate.id,
        [forecast(candidate.id, '2026-07-31T16:00:00.000Z')],
      ]),
    ));

    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: candidates.map(({ id }) => id),
      localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31',
      dayCount: 7,
    }, deps);

    expect(response.days[0].windows).toHaveLength(9);
    expect(response.days[0].windows.every(({ isBeachDayBest }) => isBeachDayBest)).toBe(true);
    expect(response.days[0].windows.some(({ beachId }) => (
      beachId === candidates[8].id
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

  it('counts beach-local evaluated rows separately from missing rows and selector rejections', async () => {
    const deps = dependencies();
    const ids = Array.from({ length: 10 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    const evaluatedIds = ids.slice(0, 9);
    deps.fetchBeaches = jest.fn(async () => ids.map((id) => beach(id, id)));
    deps.fetchForecasts = jest.fn(async () => new Map(evaluatedIds.map((id) => [
      id,
      [forecast(id, '2026-07-31T16:00:00.000Z')],
    ])));
    const defaultSelect = deps.selectBestWindows;
    deps.selectBestWindows = jest.fn((options: WindowSelectorOptions) => (
      options.forecasts[0].beach_id === ids[8] ? [] : defaultSelect(options)
    )) as unknown as WeekScoutServiceDependencies['selectBestWindows'];

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
      verdict: 'skip',
      rideable: false,
      safe: true,
      forecast: {
        waveHeight: '20',
      },
    });
    expect(response.days[0].bestWindowId).toBeNull();
    expect(response.days[0].bestDayWindow).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual(['no_rideable_windows']);
  });

  it('never lifts an unsafe window on personal history', async () => {
    const deps = dependencies();
    deps.scoreWindowCondition = jest.fn(() => 60);
    deps.scoreBeach = jest.fn(() => ({
      total: 82,
      matchQuality: 'excellent',
      subscores: {
        waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 19, tideFit: 14,
        affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0,
      },
      reasons: ['Strong conditions'],
      warnings: ['Unsafe hazard at this beach'],
    }));
    deps.fetchMatchEvidence = jest.fn(async (_user, _ids, forecasts: EnhancedForecastEntity[]) => new Map(
      forecasts.map((row) => [`${row.beach_id}:${row.forecast_at}`, {
        state: 'ready', score: 9, label: 'GOOD', confidence: 'high',
        bonusApplied: 0, reason: 'History', reasons: ['History'],
        sessionCount: 40, similarSessionCount: 12,
      } as SurfDiscoveryRecommendation['similarity']]),
    ));

    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31', dayCount: 7,
    }, deps);

    const windows = response.days.flatMap((day) => day.windows);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((window) => window.verdict !== 'worth_it')).toBe(true);
    expect(response.sessionDecision?.verdict).not.toBe('go');
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
    expect(response.days[0].bestDayWindow).toBeNull();
    expect(response.days[0].exclusionReasons).toEqual(['no_safe_windows']);
  });

  it('moves a safe window at most one tier on personal history, end to end', async () => {
    const deps = dependencies();
    deps.scoreWindowCondition = jest.fn(() => 30);
    deps.fetchSkill = jest.fn(async (): Promise<SkillLevel | null> => 'advanced');
    deps.fetchMatchEvidence = jest.fn(async (_user, _ids, forecasts: EnhancedForecastEntity[]) => new Map(
      forecasts.map((row) => [`${row.beach_id}:${row.forecast_at}`, {
        state: 'ready', score: 9, label: 'GOOD', confidence: 'high',
        bonusApplied: 0, reason: 'History', reasons: ['History'],
        sessionCount: 40, similarSessionCount: 12,
      } as SurfDiscoveryRecommendation['similarity']]),
    ));

    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31', dayCount: 7,
    }, deps);

    // Physical Skip + strong history is one tier up (Maybe), never go.
    const verdicts = response.days.flatMap((day) => day.windows.map((window) => window.verdict));
    expect(verdicts).not.toContain('worth_it');
    expect(response.sessionDecision?.verdict).not.toBe('go');
  });

  it('keeps main no-selection result when every window is a quality skip', async () => {
    const deps = dependencies();
    deps.scoreWindowCondition = jest.fn(() => 30);

    const response = await generateWeekScoutForecast('user-week-scout', {
      candidateBeachIds: [BEACH_A], localTimezone: 'Pacific/Honolulu',
      startLocalDate: '2026-07-31', dayCount: 7,
    }, deps);

    expect(response.sessionDecision).toMatchObject({ verdict: 'no', reasonCode: 'no_candidates', selection: null });
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
    expect(response.days[0].bestDayWindow).toBeNull();
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
    }, { resolveWaterQualityHolds: expect.any(Function) });
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
    expect(heldWindows).toEqual([
      expect.objectContaining({
        isBeachDayBest: true,
        rankingScore: null,
        verdict: null,
      }),
    ]);
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
    expect(response.days[0].bestDayWindow).toBeNull();
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
    expect(response.days[0].bestDayWindow).toBeNull();
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
