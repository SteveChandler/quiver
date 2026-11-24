/** @jest-environment node */

jest.mock('@/lib/recommendations/major-event-hold/service', () => ({
  evaluateMajorEventHoldCandidates: jest.fn(async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
    candidates.map(({ candidateId }) => ({
      candidateId,
      evaluation: { outcome: 'allow', holdIds: [], holdEpoch: 'parity-epoch' },
      recommendationAvailability: { state: 'available', holdEpoch: 'parity-epoch' },
    }))),
}));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({ select: jest.fn(() => ({ in: jest.fn(async () => ({ data: [], error: null })) })) })),
  })),
}));
const mockDependencies = jest.fn();
jest.mock('@/lib/services/discovery/week-scout', () => ({
  ...jest.requireActual('@/lib/services/discovery/week-scout'),
  weekScoutDependenciesAt: (...args: unknown[]) => mockDependencies(...args),
}));

import { rankDayWithWeekScout } from '@/lib/cron/daily-call-runner';
import { selectDayCall } from '@/lib/recommendations/day-call';
import {
  generateWeekScoutForecast,
  type CanonicalWeekScoutResponse,
  type WeekScoutDayResponse,
  type WeekScoutServiceDependencies,
} from '@/lib/services/discovery/week-scout';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';

const NEAR = '11111111-1111-4111-8111-111111111111';
const FAR = '22222222-2222-4222-8222-222222222222';
const ANCHOR = { lat: 32.2, lon: -116.91 };
const NOW = new Date('2026-07-31T14:00:00.000Z');
const TODAY = '2026-07-31';
const TOMORROW = '2026-08-01';

function beach(id: string, name: string, lat: number, lon: number): Beach {
  return {
    id, name, lat, lon, is_private: false, skill_level: 'intermediate',
    timezone: 'Pacific/Honolulu', wind_offshore_deg: 90,
  } as Beach;
}

function row(beachId: string, forecastAt: string): EnhancedForecastEntity {
  return {
    id: `${beachId}:${forecastAt}`, beach_id: beachId, forecast_at: forecastAt,
    wave_height: '3.5', wave_period: '12s', wave_direction: 'NW', wind_speed: '5', wind_direction: 'E',
    tide_height: '1.4', tide_status: 'Rising', water_temp: '78°F', confidence_score: 82,
    data_source: 'NOAA_NWS', created_at: '2026-07-31T12:00:00.000Z', updated_at: '2026-07-31T13:30:00.000Z',
  } as EnhancedForecastEntity;
}

/**
 * Today: the far beach ranks 1 point above the near one, inside one 3-point
 * band, so Home's day card picks the nearer beach. Tomorrow both rank higher,
 * so the week's session pick is not on today.
 */
function dependencies(): WeekScoutServiceDependencies {
  const beaches = [beach(NEAR, 'Near Break', ANCHOR.lat, ANCHOR.lon), beach(FAR, 'Far Break', 32.749, -117.252)];
  const rows = new Map(beaches.map((candidate) => [candidate.id, [
    row(candidate.id, '2026-07-31T16:00:00.000Z'),
    row(candidate.id, '2026-08-01T16:00:00.000Z'),
  ]]));
  const heroScore = (recommendation: SurfDiscoveryRecommendation): number => {
    if (recommendation.forecast.forecast_at.startsWith(TOMORROW)) return 95;
    return recommendation.beach.id === FAR ? 83 : 82;
  };
  return {
    now: NOW,
    fetchBeaches: jest.fn(async () => beaches),
    fetchForecasts: jest.fn(async () => rows),
    fetchSunTimes: jest.fn(async () => new Map()),
    fetchRankingContext: jest.fn(async () => ({
      implicitPrefs: null, learnedPrefs: null, affinityMap: new Map(), implicitWeight: 0,
    })),
    fetchSkill: jest.fn(async () => 'intermediate'),
    fetchMatchEvidence: jest.fn(async () => new Map()),
    calculatePersonalizationBonus: jest.fn(() => ({ affinityBonus: 0, personalizationBonus: 0, reasons: [] })),
    selectBestWindows: jest.fn((options: WindowSelectorOptions) => options.forecasts.map((sourceForecast) => {
      const start = new Date(sourceForecast.forecast_at);
      return {
        start,
        end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        peakTime: new Date(start.getTime() + 60 * 60 * 1000),
        tide: 'Rising', wind: '5 E', waveHeight: '3.5', wavePeriod: '12s',
        dataSource: 'NOAA_NWS', confidence: 82, timezone: 'Pacific/Honolulu', sourceForecast,
      };
    })) as unknown as WeekScoutServiceDependencies['selectBestWindows'],
    scoreWindowCondition: jest.fn(() => 80),
    scoreBeach: jest.fn(() => ({
      total: 80,
      matchQuality: 'excellent',
      subscores: {
        waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 19, tideFit: 14,
        affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0,
      },
      reasons: ['Clean wind and solid period'],
      warnings: [],
    })),
    beachToSpotProfile: jest.fn(() => ({ kind: 'beach' } as never)),
    rankWindows: jest.fn((recommendations: SurfDiscoveryRecommendation[]) => ({
      reranked: recommendations,
      diagnostics: recommendations.map((recommendation, index) => ({
        beachSlug: recommendation.beach.id,
        representativeSlotScore: recommendation.score,
        setupSuitability: 80,
        windAlignment: 19, tideFit: 14, waveHeightFit: 22, periodEnergyScore: 18, affinityBonus: 0,
        windowDurationHours: 2,
        windowPersistence: 100,
        heroWindowScore: heroScore(recommendation),
        finalRank: index,
        isHero: index === 0,
        sharedSetupSignal: { directionDeg: 315, periodS: 12, source: 'cluster-majority' },
      })),
    })),
  };
}

function todayPickBeach(response: CanonicalWeekScoutResponse): string | undefined {
  const day = response.days.find(({ localDate }) => localDate === TODAY) as WeekScoutDayResponse | undefined;
  return day ? selectDayCall(day, NOW, { closeBufferMs: 0 })?.beachId : undefined;
}

describe('Daily Call and Home pick the same beach on a near tie (quiver#1534)', () => {
  beforeEach(() => {
    mockDependencies.mockImplementation(() => dependencies());
  });

  it('returns Home\'s day-card beach from the cron\'s ranking', async () => {
    const home = await generateWeekScoutForecast('user', {
      candidateBeachIds: [NEAR, FAR], localTimezone: 'Pacific/Honolulu', startLocalDate: TODAY,
      dayCount: 7, userLocation: ANCHOR, driveRadiusMiles: 45,
    }, dependencies());
    const cron = await rankDayWithWeekScout({
      userId: 'user', poolBeachIds: [NEAR, FAR], driveRadiusMiles: 45, timezone: 'Pacific/Honolulu',
      localDate: TODAY, sessionTime: null, anchor: ANCHOR, now: NOW, weekStartLocalDate: TODAY,
    });

    expect(todayPickBeach(home)).toBe(NEAR);
    expect(todayPickBeach(cron)).toBe(todayPickBeach(home));
    expect(cron.days.map(({ localDate }) => localDate)).toEqual([TODAY]);
  });

  it('keeps the one-day request when no week start is passed', async () => {
    const cron = await rankDayWithWeekScout({
      userId: 'user', poolBeachIds: [NEAR, FAR], driveRadiusMiles: 45, timezone: 'Pacific/Honolulu',
      localDate: TODAY, sessionTime: null, anchor: ANCHOR, now: NOW,
    });

    // The one-day session pick lands on today and wins on the raw score.
    expect(todayPickBeach(cron)).toBe(FAR);
  });
});
