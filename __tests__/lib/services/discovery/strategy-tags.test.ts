import type { Beach } from '@/types/database';
import type {
  SurfDiscoveryRecommendation,
  PersonalizedForecastWindow,
} from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { assignStrategyTags } from '@/lib/services/discovery/strategy-tags';

// ============================================================================
// Fixtures
// ============================================================================

const mockWindow: PersonalizedForecastWindow = {
  start: new Date('2024-01-15T17:00:00Z'),
  end: new Date('2024-01-15T20:00:00Z'),
  tide: 'Rising',
  wind: '5 mph offshore',
  waveHeight: '3-4 ft',
  wavePeriod: '12s',
  dataSource: 'NOAA_NWS',
  confidence: 80,
  timezone: 'America/Los_Angeles',
};

const mockForecast: EnhancedForecastEntity = {
  id: 'forecast-1',
  beach_id: 'beach-1',
  forecast_at: '2024-01-15T17:00Z',
  forecast_date: '2024-01-15',
  forecast_time: '17:00',
  wave_height: '3',
  wind_speed: '5',
  wind_direction: 'NE',
  water_temp: '60',
} as EnhancedForecastEntity;

let beachCounter = 0;

function mockRec(
  overrides: Partial<SurfDiscoveryRecommendation> & {
    beachId?: string;
    crowd_level?: string;
    waveHeightFit?: number;
    windAlignment?: number;
  } = {}
): SurfDiscoveryRecommendation {
  const {
    beachId = `beach-${++beachCounter}`,
    crowd_level,
    waveHeightFit = 18,
    windAlignment = 15,
    ...rest
  } = overrides;

  const beach: Beach & { photo_url?: string | null; crowd_level?: string } = {
    id: beachId,
    name: `Beach ${beachId}`,
    slug: `beach-${beachId}`,
    lat: 34.0,
    lon: -118.0,
    city: 'Malibu',
    state: 'CA',
    is_private: false,
    wind_offshore_deg: 270,
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 2,
    preferred_tide_ft_max: 5,
    ...(crowd_level ? { crowd_level } : {}),
  } as Beach & { crowd_level?: string };

  return {
    beach,
    window: mockWindow,
    forecast: mockForecast,
    score: 65,
    matchQuality: 'good',
    subscores: {
      waveHeightFit,
      periodEnergyScore: 15,
      windAlignment,
      tideFit: 10,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: `Surf at Beach ${beachId}`,
    reasons: ['Good wave size'],
    warnings: [],
    generated_at: '2024-01-15T12:00:00Z',
    ...rest,
  };
}

beforeEach(() => {
  beachCounter = 0;
});

// ============================================================================
// Tests
// ============================================================================

describe('assignStrategyTags', () => {
  it('does not tag the hero (index 0)', () => {
    const hero = mockRec({ beachId: 'hero' });
    const second = mockRec({ beachId: 'second', waveHeightFit: 24 });
    // hero has lower waveHeightFit so second qualifies for biggest_waves
    hero.subscores.waveHeightFit = 18;
    const result = assignStrategyTags([hero, second]);
    expect(result[0].strategyTag).toBeUndefined();
  });

  it('assigns biggest_waves to rec with highest waveHeightFit exceeding hero', () => {
    const hero = mockRec({ beachId: 'hero', waveHeightFit: 18 });
    const candidate = mockRec({ beachId: 'big', waveHeightFit: 24 });
    const result = assignStrategyTags([hero, candidate]);
    expect(result[1].strategyTag?.type).toBe('biggest_waves');
    expect(result[1].strategyTag?.label).toBe('Biggest waves');
  });

  it('assigns cleanest to rec with highest windAlignment >= 16', () => {
    const hero = mockRec({ beachId: 'hero', windAlignment: 15 });
    const candidate = mockRec({ beachId: 'clean', windAlignment: 19 });
    const result = assignStrategyTags([hero, candidate]);
    expect(result[1].strategyTag?.type).toBe('cleanest');
    expect(result[1].strategyTag?.label).toBe('Cleanest');
  });

  it('assigns low_crowd to rec with light/moderate crowd and score >= 40', () => {
    const hero = mockRec({ beachId: 'hero' });
    const candidate = mockRec({ beachId: 'quiet', crowd_level: 'light', score: 55 });
    const result = assignStrategyTags([hero, candidate]);
    expect(result[1].strategyTag?.type).toBe('low_crowd');
    expect(result[1].strategyTag?.label).toBe('Low crowd');
  });

  it('assigns skip to recs with score < 40', () => {
    const hero = mockRec({ beachId: 'hero' });
    const bad1 = mockRec({ beachId: 'bad1', score: 30 });
    const bad2 = mockRec({ beachId: 'bad2', score: 25 });
    const result = assignStrategyTags([hero, bad1, bad2]);
    expect(result[1].strategyTag?.type).toBe('skip');
    expect(result[2].strategyTag?.type).toBe('skip');
  });

  it('assigns each non-skip tag at most once', () => {
    const hero = mockRec({ beachId: 'hero', waveHeightFit: 10 });
    const c1 = mockRec({ beachId: 'c1', waveHeightFit: 24 });
    const c2 = mockRec({ beachId: 'c2', waveHeightFit: 22 });
    const result = assignStrategyTags([hero, c1, c2]);
    const biggestCount = result.filter(r => r.strategyTag?.type === 'biggest_waves').length;
    expect(biggestCount).toBe(1);
    // The one that got biggest_waves should be c1 (higher fit)
    expect(result[1].strategyTag?.type).toBe('biggest_waves');
    // c2 should not also have biggest_waves
    expect(result[2].strategyTag?.type).not.toBe('biggest_waves');
  });

  it('respects priority: biggest_waves > cleanest > low_crowd', () => {
    const hero = mockRec({ beachId: 'hero', waveHeightFit: 10, windAlignment: 10 });
    // Candidate qualifies for all three: bigger waves, high windAlignment, light crowd
    const candidate = mockRec({
      beachId: 'all',
      waveHeightFit: 24,
      windAlignment: 19,
      crowd_level: 'light',
      score: 70,
    });
    const result = assignStrategyTags([hero, candidate]);
    // biggest_waves wins because it's checked first
    expect(result[1].strategyTag?.type).toBe('biggest_waves');
  });

  it('returns recs unchanged when only one recommendation', () => {
    const solo = mockRec({ beachId: 'solo' });
    const result = assignStrategyTags([solo]);
    expect(result[0].strategyTag).toBeUndefined();
    expect(result).toHaveLength(1);
  });
});
