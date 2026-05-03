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
    similarity: null,
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

  // 2024-01-15T13:00Z = 5 AM in America/Los_Angeles, before the 9am cutoff.
  const PRE_DAWN_NOW = new Date('2024-01-15T13:00:00Z');
  // 2024-01-15T22:00Z = 2 PM in America/Los_Angeles, well past the 9am cutoff.
  const AFTERNOON_NOW = new Date('2024-01-15T22:00:00Z');

  it('assigns sleep_in when late-morning score retains >= 70% of original (before 9am)', () => {
    const hero = mockRec({ beachId: 'hero-si', score: 80 });
    const steady = mockRec({ beachId: 'steady', score: 60, waveHeightBadge: '2-3ft' });
    const sleepInScores = new Map([['steady', 45]]); // 45/60 = 75% >= 70%
    const result = assignStrategyTags([hero, steady], sleepInScores, PRE_DAWN_NOW);
    expect(result[1].strategyTag?.type).toBe('sleep_in');
    expect(result[1].strategyTag?.reason).toContain('past 9am');
  });

  it('does not assign sleep_in when score retention is below 70%', () => {
    const hero = mockRec({ beachId: 'hero-si2', score: 80 });
    const dawnOnly = mockRec({ beachId: 'dawn-only', score: 60 });
    const sleepInScores = new Map([['dawn-only', 30]]); // 30/60 = 50% < 70%
    const result = assignStrategyTags([hero, dawnOnly], sleepInScores, PRE_DAWN_NOW);
    expect(result[1].strategyTag?.type).not.toBe('sleep_in');
  });

  it('suppresses sleep_in (badge AND reason) once it is past 9am at the candidate beach', () => {
    // Same scoring as the passing case above — only difference is `now` is afternoon.
    const hero = mockRec({ beachId: 'hero-si3', score: 80 });
    const steady = mockRec({ beachId: 'steady-pm', score: 60, waveHeightBadge: '2-3ft' });
    const sleepInScores = new Map([['steady-pm', 45]]);
    const result = assignStrategyTags([hero, steady], sleepInScores, AFTERNOON_NOW);
    expect(result[1].strategyTag).toBeUndefined();
    // Belt-and-suspenders: the tag-derived reason copy must NOT be present either.
    // Since the renderer reads `strategyTag.reason`, suppressing the tag drops both.
    expect(JSON.stringify(result[1])).not.toContain('past 9am');
  });

  it('uses the candidate beach timezone (not the user/server tz) for the cutoff check', () => {
    // 2024-01-15T22:00Z is 12 PM Pacific (past cutoff) but 12 PM HST = noon → still
    // before the 9am cutoff. Wait, that's wrong — 22:00Z is 12:00 HST. To exercise
    // the international-tz branch with a clean pre-cutoff signal: 2024-01-15T15:00Z
    // = 7 AM PST (pre-cutoff for a Pacific beach) AND 5 AM HST (pre-cutoff for a
    // Hawaii beach). Same `now`, both should retain the tag — but we want to
    // demonstrate the per-beach-tz read, so use a moment when PT is past-cutoff
    // and HST is pre-cutoff: 2024-01-15T20:00Z = 12 PM PST (past) but 10 AM HST
    // (past too — not useful). Pick 2024-01-15T18:00Z = 10 AM PST (past) and
    // 8 AM HST (pre). A Hawaii beach should retain the tag at this `now`.
    const hawaiiNow = new Date('2024-01-15T18:00:00Z');
    const hawaiiWindow: PersonalizedForecastWindow = {
      ...mockWindow,
      timezone: 'Pacific/Honolulu',
    };
    const hero = mockRec({ beachId: 'hero-hi', score: 80, window: hawaiiWindow });
    const steady = mockRec({
      beachId: 'steady-hi',
      score: 60,
      waveHeightBadge: '2-3ft',
      window: hawaiiWindow,
    });
    const sleepInScores = new Map([['steady-hi', 45]]);
    const result = assignStrategyTags([hero, steady], sleepInScores, hawaiiNow);
    // 8 AM HST < 9 AM cutoff → tag retained.
    expect(result[1].strategyTag?.type).toBe('sleep_in');

    // Same `now`, Pacific timezone: 10 AM PST > 9 AM cutoff → tag suppressed.
    const pacificHero = mockRec({ beachId: 'hero-pt', score: 80 });
    const pacificSteady = mockRec({
      beachId: 'steady-pt',
      score: 60,
      waveHeightBadge: '2-3ft',
    });
    const pacificScores = new Map([['steady-pt', 45]]);
    const pacificResult = assignStrategyTags(
      [pacificHero, pacificSteady],
      pacificScores,
      hawaiiNow,
    );
    expect(pacificResult[1].strategyTag).toBeUndefined();
  });
});
