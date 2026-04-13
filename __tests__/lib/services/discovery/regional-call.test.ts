import type { Beach } from '@/types/database';
import type {
  SurfDiscoveryRecommendation,
  PersonalizedForecastWindow,
} from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { generateRegionalCall } from '@/lib/services/discovery/regional-call';

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
  swell_1_direction: null,
  swell_1_period: null,
} as unknown as EnhancedForecastEntity;

let beachCounter = 0;

function mockRec(
  overrides: {
    swell_1_direction?: string | null;
    swell_1_period?: string | null;
    wind_speed?: string | null;
    wind_direction?: string | null;
    aspect_deg?: number | null;
  } = {}
): SurfDiscoveryRecommendation {
  const beachId = `beach-${++beachCounter}`;
  const beach: Beach & { photo_url?: string | null; aspect_deg?: number | null } = {
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
    aspect_deg: overrides.aspect_deg ?? null,
  } as Beach & { aspect_deg?: number | null };

  const forecast: EnhancedForecastEntity = {
    ...mockForecast,
    id: `forecast-${beachId}`,
    beach_id: beachId,
    swell_1_direction: overrides.swell_1_direction ?? null,
    swell_1_period: overrides.swell_1_period ?? null,
    wind_speed: overrides.wind_speed ?? '5',
    wind_direction: overrides.wind_direction ?? 'NE',
  } as unknown as EnhancedForecastEntity;

  return {
    beach,
    window: mockWindow,
    forecast,
    score: 65,
    matchQuality: 'good',
    subscores: {
      waveHeightFit: 18,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 10,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: `Surf at ${beachId}`,
    reasons: ['Good wave size'],
    warnings: [],
    generated_at: '2024-01-15T12:00:00Z',
  };
}

beforeEach(() => {
  beachCounter = 0;
});

// ============================================================================
// Tests
// ============================================================================

describe('generateRegionalCall', () => {
  it('includes dominant swell direction and period', () => {
    const recs = [
      mockRec({ swell_1_direction: 'SSW', swell_1_period: '13' }),
      mockRec({ swell_1_direction: 'SSW', swell_1_period: '14' }),
      mockRec({ swell_1_direction: 'SSW', swell_1_period: '12' }),
    ];
    const result = generateRegionalCall(recs);
    expect(result).toContain('SSW');
    // Should contain a period number (e.g. "13s")
    expect(result).toMatch(/\d+s/);
  });

  it('includes wind trend when dawn and midday differ', () => {
    const recs = [mockRec({ swell_1_direction: null, swell_1_period: null })];
    const result = generateRegionalCall(recs, {
      dawnWind: { speed: '0 mph', direction: '' },
      middayWind: { speed: '10 mph', direction: 'SW' },
    });
    expect(result.toLowerCase()).toContain('glassy');
    expect(result.toLowerCase()).toContain('onshore');
  });

  it('returns flat-day fallback when no swell data', () => {
    const recs = [
      mockRec({ swell_1_direction: null, swell_1_period: null }),
      mockRec({ swell_1_direction: null, swell_1_period: null }),
    ];
    const result = generateRegionalCall(recs);
    expect(result.length).toBeGreaterThan(0);
    // No wind options → full fallback
    expect(result).toBe('Small surf, pick your spot for fun.');
  });

  it('includes aspect advantage when top recs share facing', () => {
    const recs = [
      mockRec({ swell_1_direction: null, aspect_deg: 190 }),
      mockRec({ swell_1_direction: null, aspect_deg: 195 }),
      mockRec({ swell_1_direction: null, aspect_deg: 200 }),
    ];
    const result = generateRegionalCall(recs);
    expect(result.toLowerCase()).toContain('south');
  });
});
