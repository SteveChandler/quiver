/**
 * Shared Test Fixtures for Domains
 *
 * Provides factory functions for creating test objects.
 * Reduces code duplication across domain test files.
 */

import type { SpotProfile } from '@/lib/domains/spot-profile';
import type {
  ConditionsSnapshot,
  ConditionsWindow,
  SwellComponent,
} from '@/lib/domains/conditions';
import type { ScorerInput, ScorerPlugin } from '@/lib/domains/scoring';

/**
 * Default SpotProfile for testing.
 */
export const DEFAULT_PROFILE: SpotProfile = {
  id: 'test-beach',
  name: 'Test Beach',
  timezone: 'America/Los_Angeles',
  coordinates: { lat: 33.8, lon: -118.4 },
  swellWindow: { minDeg: 250, maxDeg: 290, centerDeg: 270, halfWidthDeg: 20 },
  windThresholds: {
    offshoreDeg: 90,
    offshoreToleranceDeg: 45,
    maxOnshoreMph: 10,
    maxAnyMph: 18,
    crossShoreOkKts: 15,
  },
  tidePreferences: { minHeightFt: 0, maxHeightFt: 5, preferredDirection: 'either' },
  skillLevel: 'intermediate',
  breakType: 'beach',
};

/**
 * Default ConditionsSnapshot for testing.
 */
export const DEFAULT_SNAPSHOT: ConditionsSnapshot = {
  timestamp: new Date(),
  waveHeight: 4,
  wavePeriod: 12,
  waveDirection: 270,
  primarySwell: null,
  secondarySwell: null,
  windWave: null,
  wind: { speedMph: 5, directionDeg: 90 },
  tide: { heightFt: 3, status: 'rising', direction: 'rising' },
  confidence: 80,
  dataSource: 'test',
};

/**
 * Creates a SpotProfile with optional overrides.
 */
export function createProfile(overrides: Partial<SpotProfile> = {}): SpotProfile {
  return { ...DEFAULT_PROFILE, ...overrides };
}

/**
 * Creates a ConditionsSnapshot with optional overrides.
 * Always creates a fresh timestamp.
 */
export function createSnapshot(
  overrides: Partial<ConditionsSnapshot> = {}
): ConditionsSnapshot {
  return {
    ...DEFAULT_SNAPSHOT,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Creates a ScorerInput with optional overrides.
 */
export function createInput(
  snapshotOverrides: Partial<ConditionsSnapshot> = {},
  profileOverrides: Partial<SpotProfile> = {}
): ScorerInput {
  return {
    profile: createProfile(profileOverrides),
    snapshot: createSnapshot(snapshotOverrides),
    window: null,
    preferences: null,
  };
}

/**
 * Creates a SwellComponent with computed energy.
 */
export function createSwell(
  heightFt: number,
  periodS: number,
  directionDeg: number
): SwellComponent {
  return {
    heightFt,
    periodS,
    directionDeg,
    energy: heightFt * heightFt * periodS,
  };
}

/**
 * Creates a mock scorer for testing the scoring engine.
 */
export function createMockScorer(
  name: string,
  score: number,
  weight: number,
  skip = false
): ScorerPlugin {
  return {
    name,
    weight,
    score: () => ({
      name,
      score,
      weight,
      reasons: [`${name} reason`],
      warnings: [],
      skip,
      skipReason: skip ? `${name} skip reason` : null,
    }),
  };
}

/**
 * Creates a Beach database object for testing.
 * Note: This uses the raw database type, not the domain SpotProfile.
 */
export function createBeach(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-beach-id',
    name: 'Test Beach',
    slug: 'test-beach',
    description: 'A test beach',
    region: 'test-region',
    latitude: 33.8,
    longitude: -118.4,
    center_lat: 33.8,
    center_lng: -118.4,
    lat: 33.8,
    lon: -118.4,
    timezone: 'America/Los_Angeles',
    skill_level: 'intermediate',
    break_type: 'beach',
    swell_window_min_deg: 250,
    swell_window_max_deg: 290,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 45,
    max_wind_onshore_mph: 10,
    max_wind_any_mph: 18,
    preferred_tide_ft_min: 0,
    preferred_tide_ft_max: 5,
    preferred_tide_direction: 'either',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates an EnhancedForecastEntity for testing.
 */
export function createForecast(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-forecast-id',
    beach_id: 'test-beach-id',
    forecast_date: '2025-01-15',
    forecast_time: '08:00',
    wave_height: '4',
    wave_period: '12s',
    wave_direction: '270',
    wind_speed: '5',
    wind_direction: 'E',
    wind_direction_deg: 90,
    tide_height: '3',
    tide_status: 'rising',
    swell_1_height: '4',
    swell_1_period: '12s',
    swell_1_direction: '270',
    water_temp: '62',
    weather_condition: 'clear',
    confidence_score: 80,
    data_source: 'NOAA_NWS',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
