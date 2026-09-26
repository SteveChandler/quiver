import type { WeekScoutServiceDependencies } from '@/lib/services/discovery/week-scout';
import type { WindowSelectorOptions } from '@/lib/services/discovery/window-selector/types';
import { createMockBeach } from '@/__tests__/setup/typed-mocks';
import { FLAT, NOW, TIMEZONE, dayRows, type PartitionSpec } from '@/__tests__/helpers/swell-events';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

/**
 * Week Scout service dependencies over two west-facing beaches with one W
 * groundswell peaking 2026-09-28; scoring is stubbed, detection is real.
 */
export const BLACKS = 'dddddddd-0000-4000-8000-000000000001';
export const SCRIPPS = 'dddddddd-0000-4000-8000-000000000002';
const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };

function beach(id: string, name: string, center: number): Beach {
  return createMockBeach({
    id, name, slug: name.toLowerCase(), timezone: TIMEZONE, is_private: false, skill_level: 'intermediate',
    swell_window_center_deg: center, swell_window_halfwidth_deg: 30,
  });
}

function rows(beachId: string): EnhancedForecastEntity[] {
  return Array.from({ length: 7 }, (_, day) => dayRows(day, day === 3 ? PEAK : FLAT, { noonBumpFt: day === 3 ? 0.2 : 0 }))
    .flat()
    .map((row, index) => ({
      ...row,
      id: `${beachId}:${index}`,
      beach_id: beachId,
      wave_height: '3 ft',
      wave_period: '14s',
      wave_direction: 'W',
      wind_speed: '5 mph',
      wind_direction: 'E',
      wind_direction_deg: 90,
      wind_source: 'NWS',
      tide_height: '2',
      tide_status: 'Rising',
      water_temp: '66°F',
      confidence_score: 80,
      data_source: 'NOAA_NWS',
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    } as EnhancedForecastEntity));
}

export function weekScoutSwellDependencies(): WeekScoutServiceDependencies {
  const beaches = [beach(BLACKS, 'Blacks', 270), beach(SCRIPPS, 'Scripps', 275)];
  const forecasts = new Map(beaches.map((item) => [item.id, rows(item.id)]));
  return {
    now: NOW,
    fetchBeaches: jest.fn(async () => beaches),
    fetchForecasts: jest.fn(async () => forecasts),
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
        tide: 'Rising', wind: '5 E', waveHeight: '3 ft', wavePeriod: '14s',
        dataSource: 'NOAA_NWS', confidence: 80, timezone: TIMEZONE, sourceForecast,
      };
    })) as unknown as WeekScoutServiceDependencies['selectBestWindows'],
    scoreWindowCondition: jest.fn(() => 82),
    scoreBeach: jest.fn(() => ({
      total: 82,
      matchQuality: 'excellent',
      subscores: {
        waveHeightFit: 22, periodEnergyScore: 18, windAlignment: 19, tideFit: 14,
        affinityBonus: 0, personalizationBonus: 0, distancePenalty: 0,
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
        windAlignment: 19, tideFit: 14, waveHeightFit: 22, periodEnergyScore: 18, affinityBonus: 0,
        windowDurationHours: 2, windowPersistence: 100,
        heroWindowScore: 84 - index,
        finalRank: index,
        isHero: index === 0,
        sharedSetupSignal: { directionDeg: 270, periodS: 16, source: 'cluster-majority' },
      })),
    })),
    loadSwellSnapshots: jest.fn(async () => []),
    loadSwellCrossingHistory: jest.fn(async () => ({ historyDays: 3, crossings: [] })),
    loadSwellHistory: jest.fn(async () => new Map()),
  };
}
