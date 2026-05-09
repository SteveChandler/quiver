/**
 * Unit tests for personalization-layer.ts
 *
 * Tests both exported functions:
 *   - fetchPersonalizationContext (async, DB-backed)
 *   - calculatePersonalizationBonus (pure function)
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { UserImplicitPreferences } from '@/types/implicit-preferences';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';
import type { PersonalizationContext } from '@/lib/services/discovery/personalization-layer';

// ============================================================================
// Supabase mock — must be declared before imports that pull it in
// ============================================================================

// Build chainable mock pieces that tests can update via mockState
const mockIn = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

// Reset the chain so every call returns the final .then-able promise
function resetChain(resolveValue: { data: unknown; error: unknown }) {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    then: jest.fn((cb: (r: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(cb(resolveValue))
    ),
  };

  mockIn.mockReturnValue(chain);
  mockEq.mockReturnValue({ ...chain });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

const mockSupabase = { from: mockFrom };

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/implicit-preferences-service');
jest.mock('@/lib/services/preference-learning-service');
jest.mock('@/lib/services/personalized-scoring-service');
jest.mock('@/lib/logger', () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// Imports (after mocks are declared)
// ============================================================================

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  getImplicitPreferences,
  calculateImplicitBonus,
  isTopEngagedBeach,
} from '@/lib/services/implicit-preferences-service';
import { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import {
  matchesLearnedWaveRange,
  matchesLearnedWindPrefs,
  matchesLearnedTidePrefs,
} from '@/lib/services/personalized-scoring-service';
import {
  fetchPersonalizationContext,
  calculatePersonalizationBonus,
} from '@/lib/services/discovery/personalization-layer';

// ============================================================================
// Typed mock helpers
// ============================================================================

const mockGetImplicitPreferences = getImplicitPreferences as jest.MockedFunction<typeof getImplicitPreferences>;
const mockGetUserSurfPreferences = getUserSurfPreferences as jest.MockedFunction<typeof getUserSurfPreferences>;
const mockCalculateImplicitBonus = calculateImplicitBonus as jest.MockedFunction<typeof calculateImplicitBonus>;
const mockIsTopEngagedBeach = isTopEngagedBeach as jest.MockedFunction<typeof isTopEngagedBeach>;
const mockMatchesLearnedWaveRange = matchesLearnedWaveRange as jest.MockedFunction<typeof matchesLearnedWaveRange>;
const mockMatchesLearnedWindPrefs = matchesLearnedWindPrefs as jest.MockedFunction<typeof matchesLearnedWindPrefs>;
const mockMatchesLearnedTidePrefs = matchesLearnedTidePrefs as jest.MockedFunction<typeof matchesLearnedTidePrefs>;
const mockCreateSupabaseServiceRoleClient = createSupabaseServiceRoleClient as jest.MockedFunction<typeof createSupabaseServiceRoleClient>;

// ============================================================================
// Test data helpers
// ============================================================================

function makeBeach(overrides?: Partial<Beach>): Beach {
  return {
    id: 'beach-1',
    name: 'Test Beach',
    slug: 'test-beach',
    break_type: 'beach',
    lat: 33.0,
    lon: -117.0,
    city: 'San Diego',
    state: 'CA',
    country: 'US',
    is_private: false,
    skill_level: 'intermediate',
    center_lat: 33.0,
    center_lng: -117.0,
    // Provide null for all optional columns the Beach type requires
    average_rating: null,
    best_conditions_prose: null,
    best_months: null,
    cdip_eligible: false,
    cdip_station: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    description: null,
    featured_image_url: null,
    region: null,
    review_count: 0,
    tide_station: null,
    wind_station: null,
    ...overrides,
  } as unknown as Beach;
}

function makeForecast(overrides?: Partial<EnhancedForecastEntity>): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'beach-1',
    forecast_at: '2024-01-15T10:00:00Z',
    forecast_date: '2024-01-15',
    forecast_time: '10:00:00',
    wave_height: '3',
    wave_period: '12s',
    wind_speed: '8',
    wind_direction: '270',
    wind_direction_deg: 270,
    tide_status: 'rising',
    tide_height: '3.5',
    water_temp: '60',
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeContext(overrides?: Partial<PersonalizationContext>): PersonalizationContext {
  return {
    implicitPrefs: null,
    learnedPrefs: null,
    affinityMap: new Map(),
    implicitWeight: 0,
    ...overrides,
  };
}

function makeImplicitPrefs(overrides?: Partial<UserImplicitPreferences>): UserImplicitPreferences {
  return {
    user_id: 'user-1',
    inferred_wave_min_ft: null,
    inferred_wave_max_ft: null,
    break_type_weights: {},
    time_slot_weights: {},
    location_centroid_lat: null,
    location_centroid_lon: null,
    typical_travel_radius_miles: null,
    top_engaged_beach_ids: [],
    confidence: 0.5,
    event_count: 10,
    last_computed_at: '2024-01-01T00:00:00Z',
    computed_from: null,
    computed_to: null,
    ...overrides,
  };
}

function makeLearnedPrefs(overrides?: Partial<UserSurfPreferences>): UserSurfPreferences {
  return {
    wave_min_ft: null,
    wave_max_ft: null,
    wave_period_min_s: null,
    wave_period_max_s: null,
    max_wind_mph: null,
    preferred_wind_directions: null,
    preferred_tide_statuses: null,
    confidence: 0.8,
    sample_size: 20,
    ...overrides,
  };
}

// ============================================================================
// calculatePersonalizationBonus — pure function tests
// ============================================================================

describe('calculatePersonalizationBonus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no matches for any learned/implicit prefs
    mockMatchesLearnedWaveRange.mockReturnValue(false);
    mockMatchesLearnedWindPrefs.mockReturnValue(false);
    mockMatchesLearnedTidePrefs.mockReturnValue(false);
    mockIsTopEngagedBeach.mockReturnValue(false);
    mockCalculateImplicitBonus.mockReturnValue({
      total: 0,
      breakdown: { waveRange: 0, breakType: 0, topEngaged: 0 },
    });
  });

  describe('new user with no preferences', () => {
    it('returns total of 0 and no reasons when context has all nulls', () => {
      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext();

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.total).toBe(0);
      expect(result.affinityBonus).toBe(0);
      expect(result.personalizationBonus).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('learned wave range match', () => {
    it('adds +15 * confidence when wave range matches and confidence > 0.5', () => {
      const learned = makeLearnedPrefs({
        confidence: 0.8,
        wave_min_ft: 2,
        wave_max_ft: 5,
      });
      mockMatchesLearnedWaveRange.mockReturnValue(true);
      mockMatchesLearnedWindPrefs.mockReturnValue(false);
      mockMatchesLearnedTidePrefs.mockReturnValue(false);

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: '3' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // 15 * 0.8 = 12
      expect(result.personalizationBonus).toBeCloseTo(12);
      expect(result.reasons).toContain('Wave size matches your sweet spot');
    });

    it('adds 0 when learned prefs confidence is at or below 0.5', () => {
      const learned = makeLearnedPrefs({ confidence: 0.5, wave_min_ft: 2, wave_max_ft: 5 });
      mockMatchesLearnedWaveRange.mockReturnValue(true);

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: '3' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
      expect(result.reasons).not.toContain('Wave size matches your sweet spot');
    });

    it('adds 0 from wave range when learned prefs confidence is below threshold (0.3)', () => {
      const learned = makeLearnedPrefs({ confidence: 0.3, wave_min_ft: 2, wave_max_ft: 5 });
      mockMatchesLearnedWaveRange.mockReturnValue(true);

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: '3' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
    });

    it('adds 0 from wave range when forecast wave does not match range', () => {
      const learned = makeLearnedPrefs({ confidence: 0.8, wave_min_ft: 2, wave_max_ft: 5 });
      mockMatchesLearnedWaveRange.mockReturnValue(false);

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: '8' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
    });

    it('applies maximum bonus when confidence is 1.0', () => {
      const { matchesLearnedWaveRange: matchWave, matchesLearnedWindPrefs: matchWind, matchesLearnedTidePrefs: matchTide } =
        require('@/lib/services/personalized-scoring-service');
      matchWave.mockReturnValue(true);
      matchWind.mockReturnValue(true);
      matchTide.mockReturnValue(true);

      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext({
        learnedPrefs: { confidence: 1.0 } as any,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // Learned condition personalization is capped so it cannot override setup quality.
      expect(result.personalizationBonus).toBe(12);
    });

    it('applies proportional bonus at confidence 0.51 (just above threshold)', () => {
      const { matchesLearnedWaveRange: matchWave } =
        require('@/lib/services/personalized-scoring-service');
      matchWave.mockReturnValue(true);

      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext({
        learnedPrefs: { confidence: 0.51 } as any,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // 15 * 0.51 = 7.65
      expect(result.personalizationBonus).toBeCloseTo(7.65, 1);
    });
  });

  describe('learned wind preference match', () => {
    it('adds +10 * confidence when wind prefs match and confidence > 0.5', () => {
      const learned = makeLearnedPrefs({
        confidence: 0.8,
        max_wind_mph: 15,
        preferred_wind_directions: [270],
      });
      mockMatchesLearnedWaveRange.mockReturnValue(false);
      mockMatchesLearnedWindPrefs.mockReturnValue(true);
      mockMatchesLearnedTidePrefs.mockReturnValue(false);

      const beach = makeBeach();
      const forecast = makeForecast({ wind_speed: '10', wind_direction: '280' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // 10 * 0.8 = 8
      expect(result.personalizationBonus).toBeCloseTo(8);
      expect(result.reasons).toContain('Wind matches your usual sessions');
    });

    it('adds 0 from wind when wind conditions do not match', () => {
      const learned = makeLearnedPrefs({
        confidence: 0.8,
        max_wind_mph: 15,
        preferred_wind_directions: [270],
      });
      mockMatchesLearnedWindPrefs.mockReturnValue(false);

      const beach = makeBeach();
      const forecast = makeForecast({ wind_speed: '20', wind_direction: '90' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
      expect(result.reasons).not.toContain('Wind matches your usual sessions');
    });
  });

  describe('learned tide preference match', () => {
    it('adds +8 * confidence when tide prefs match and confidence > 0.5', () => {
      const learned = makeLearnedPrefs({
        confidence: 0.8,
        preferred_tide_statuses: ['rising'],
      });
      mockMatchesLearnedWaveRange.mockReturnValue(false);
      mockMatchesLearnedWindPrefs.mockReturnValue(false);
      mockMatchesLearnedTidePrefs.mockReturnValue(true);

      const beach = makeBeach();
      const forecast = makeForecast({ tide_status: 'rising' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // 8 * 0.8 = 6.4
      expect(result.personalizationBonus).toBeCloseTo(6.4);
      expect(result.reasons).toContain('Tide matches your usual sessions');
    });

    it('adds 0 from tide when tide status does not match', () => {
      const learned = makeLearnedPrefs({
        confidence: 0.8,
        preferred_tide_statuses: ['rising'],
      });
      mockMatchesLearnedTidePrefs.mockReturnValue(false);

      const beach = makeBeach();
      const forecast = makeForecast({ tide_status: 'falling' });
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
      expect(result.reasons).not.toContain('Tide matches your usual sessions');
    });
  });

  describe('implicit preferences bonus', () => {
    it('adds implicit bonus when implicitWeight > 0 and implicitPrefs present', () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      mockIsTopEngagedBeach.mockReturnValue(false);
      mockCalculateImplicitBonus.mockReturnValue({
        total: 8,
        breakdown: { waveRange: 6, breakType: 2, topEngaged: 0 },
      });

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: '3', wave_period: '12s', wind_speed: '8' });
      const context = makeContext({
        implicitPrefs: implicit,
        implicitWeight: 0.5,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(8);
      expect(result.reasons).toContain('Matches your surfing patterns');
    });

    it('does not add implicit bonus when implicitWeight is 0', () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      mockCalculateImplicitBonus.mockReturnValue({
        total: 10,
        breakdown: { waveRange: 10, breakType: 0, topEngaged: 0 },
      });

      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext({
        implicitPrefs: implicit,
        implicitWeight: 0, // Zero weight — should suppress
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
      expect(mockCalculateImplicitBonus).not.toHaveBeenCalled();
    });

    it('does not add implicit bonus when implicitPrefs is null even with weight > 0', () => {
      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext({
        implicitPrefs: null,
        implicitWeight: 0.5,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
      expect(mockCalculateImplicitBonus).not.toHaveBeenCalled();
    });

    it('adds 0 when calculateImplicitBonus returns total of 0', () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      mockIsTopEngagedBeach.mockReturnValue(false);
      mockCalculateImplicitBonus.mockReturnValue({
        total: 0,
        breakdown: { waveRange: 0, breakType: 0, topEngaged: 0 },
      });

      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext({
        implicitPrefs: implicit,
        implicitWeight: 0.5,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.personalizationBonus).toBe(0);
      expect(result.reasons).not.toContain('Matches your surfing patterns');
    });

    it('passes correct forecastData to calculateImplicitBonus', () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      mockIsTopEngagedBeach.mockReturnValue(false);
      mockCalculateImplicitBonus.mockReturnValue({
        total: 5,
        breakdown: { waveRange: 5, breakType: 0, topEngaged: 0 },
      });

      const beach = makeBeach({ id: 'beach-xyz', break_type: 'reef' });
      const forecast = makeForecast({ wave_height: '4.5', wave_period: '14s', wind_speed: '12' });
      const context = makeContext({ implicitPrefs: implicit, implicitWeight: 0.4 });

      calculatePersonalizationBonus(beach, forecast, context);

      expect(mockCalculateImplicitBonus).toHaveBeenCalledWith(
        { wave_height_ft: 4.5, wave_period_s: 14, wind_speed_mph: 12 },
        'reef',
        false, // isTopEngaged
        implicit,
        0.4
      );
    });

    it('passes isTopEngaged=true when beach is in top_engaged_beach_ids', () => {
      const implicit = makeImplicitPrefs({ top_engaged_beach_ids: ['beach-1'] });
      mockIsTopEngagedBeach.mockReturnValue(true);
      mockCalculateImplicitBonus.mockReturnValue({
        total: 2,
        breakdown: { waveRange: 0, breakType: 0, topEngaged: 2 },
      });

      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ implicitPrefs: implicit, implicitWeight: 0.5 });

      calculatePersonalizationBonus(beach, forecast, context);

      expect(mockIsTopEngagedBeach).toHaveBeenCalledWith('beach-1', implicit);
      expect(mockCalculateImplicitBonus).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        true, // isTopEngaged
        implicit,
        0.5
      );
    });
  });

  describe('beach affinity bonus', () => {
    it('adds affinity bonus when affinity score > 10', () => {
      const affinityMap = new Map([['beach-1', 80]]);
      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ affinityMap });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // min(80 * 0.05, 4) = 4
      expect(result.affinityBonus).toBeCloseTo(4);
      expect(result.reasons).toContain("One of your go-to spots");
    });

    it('caps affinity bonus at 4 for very high affinity scores', () => {
      const affinityMap = new Map([['beach-1', 200]]);
      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ affinityMap });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // min(200 * 0.05, 4) = 4
      expect(result.affinityBonus).toBe(4);
    });

    it('adds 0 affinity when affinity score is exactly 10 (boundary)', () => {
      const affinityMap = new Map([['beach-1', 10]]);
      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ affinityMap });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.affinityBonus).toBe(0);
      expect(result.reasons).not.toContain("One of your go-to spots");
    });

    it('adds 0 affinity when affinity score is below 10', () => {
      const affinityMap = new Map([['beach-1', 5]]);
      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ affinityMap });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.affinityBonus).toBe(0);
      expect(result.reasons).not.toContain("One of your go-to spots");
    });

    it('adds 0 affinity when beach is not in affinityMap', () => {
      const affinityMap = new Map([['other-beach', 90]]);
      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ affinityMap });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.affinityBonus).toBe(0);
    });

    it('adds 0 affinity when affinityMap is empty', () => {
      const beach = makeBeach({ id: 'beach-1' });
      const forecast = makeForecast();
      const context = makeContext({ affinityMap: new Map() });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.affinityBonus).toBe(0);
    });
  });

  describe('combined scenarios', () => {
    it('sums learned bonuses with affinity correctly', () => {
      const learned = makeLearnedPrefs({ confidence: 0.8 });
      mockMatchesLearnedWaveRange.mockReturnValue(true);
      mockMatchesLearnedWindPrefs.mockReturnValue(false);
      mockMatchesLearnedTidePrefs.mockReturnValue(false);

      const affinityMap = new Map([['beach-1', 80]]);

      const beach = makeBeach({ id: 'beach-1', break_type: 'point' });
      const forecast = makeForecast({ wave_height: '3' });
      const context = makeContext({
        learnedPrefs: learned,
        affinityMap,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // wave range: +15 * 0.8 = +12
      // affinity: min(80 * 0.05, 4) = 4
      expect(result.personalizationBonus).toBeCloseTo(12);
      expect(result.affinityBonus).toBeCloseTo(4);
      expect(result.total).toBeCloseTo(16);
      expect(result.reasons).toContain('Wave size matches your sweet spot');
      expect(result.reasons).toContain("One of your go-to spots");
    });

    it('includes all three learned prefs bonuses when all match', () => {
      const learned = makeLearnedPrefs({ confidence: 0.8 });
      mockMatchesLearnedWaveRange.mockReturnValue(true);
      mockMatchesLearnedWindPrefs.mockReturnValue(true);
      mockMatchesLearnedTidePrefs.mockReturnValue(true);

      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext({ learnedPrefs: learned });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // Raw learned bonus is 26.4, capped at 12.
      expect(result.personalizationBonus).toBeCloseTo(12);
      expect(result.reasons).toContain('Wave size matches your sweet spot');
      expect(result.reasons).toContain('Wind matches your usual sessions');
      expect(result.reasons).toContain('Tide matches your usual sessions');
    });

    it('total equals affinityBonus + personalizationBonus', () => {
      const learned = makeLearnedPrefs({ confidence: 0.8 });
      mockMatchesLearnedWaveRange.mockReturnValue(true);
      mockMatchesLearnedWindPrefs.mockReturnValue(false);
      mockMatchesLearnedTidePrefs.mockReturnValue(false);

      const affinityMap = new Map([['beach-1', 50]]);
      const beach = makeBeach({ id: 'beach-1', break_type: 'point' });
      const forecast = makeForecast();
      const context = makeContext({
        learnedPrefs: learned,
        affinityMap,
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.total).toBeCloseTo(result.affinityBonus + result.personalizationBonus);
    });
  });

  describe('wave height parsing for implicit bonus', () => {
    it('passes null wave_height_ft when wave_height is empty string', () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      mockIsTopEngagedBeach.mockReturnValue(false);
      mockCalculateImplicitBonus.mockReturnValue({
        total: 0,
        breakdown: { waveRange: 0, breakType: 0, topEngaged: 0 },
      });

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: '' });
      const context = makeContext({ implicitPrefs: implicit, implicitWeight: 0.5 });

      calculatePersonalizationBonus(beach, forecast, context);

      expect(mockCalculateImplicitBonus).toHaveBeenCalledWith(
        expect.objectContaining({ wave_height_ft: null }),
        expect.any(String),
        expect.any(Boolean),
        implicit,
        0.5
      );
    });

    it('passes null wave_height_ft when wave_height is null', () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      mockIsTopEngagedBeach.mockReturnValue(false);
      mockCalculateImplicitBonus.mockReturnValue({
        total: 0,
        breakdown: { waveRange: 0, breakType: 0, topEngaged: 0 },
      });

      const beach = makeBeach();
      const forecast = makeForecast({ wave_height: null });
      const context = makeContext({ implicitPrefs: implicit, implicitWeight: 0.5 });

      calculatePersonalizationBonus(beach, forecast, context);

      expect(mockCalculateImplicitBonus).toHaveBeenCalledWith(
        expect.objectContaining({ wave_height_ft: null }),
        expect.any(String),
        expect.any(Boolean),
        implicit,
        0.5
      );
    });
  });

  describe('reasons array behavior', () => {
    it('accumulates multiple reasons when multiple bonuses apply', () => {
      const beach = makeBeach({ break_type: 'reef' });
      const forecast = makeForecast({
        wave_height: '3',
        wind_speed: '8',
        wind_direction: '270',
        tide_status: 'rising',
      });

      // Mock all learned matchers to return true
      const { matchesLearnedWaveRange: matchWave, matchesLearnedWindPrefs: matchWind, matchesLearnedTidePrefs: matchTide } =
        require('@/lib/services/personalized-scoring-service');
      matchWave.mockReturnValue(true);
      matchWind.mockReturnValue(true);
      matchTide.mockReturnValue(true);

      const context = makeContext({
        learnedPrefs: makeLearnedPrefs({ confidence: 0.8 }),
        affinityMap: new Map([['beach-1', 80]]),
      });

      const result = calculatePersonalizationBonus(beach, forecast, context);

      // Should have 4 reasons: 3 learned + affinity
      expect(result.reasons.length).toBe(4);
      expect(result.reasons).toContain('Wave size matches your sweet spot');
      expect(result.reasons).toContain('Wind matches your usual sessions');
      expect(result.reasons).toContain('Tide matches your usual sessions');
      expect(result.reasons).toContain("One of your go-to spots");
    });

    it('returns empty reasons array when no bonuses apply', () => {
      const beach = makeBeach();
      const forecast = makeForecast();
      const context = makeContext(); // all nulls/empty

      const result = calculatePersonalizationBonus(beach, forecast, context);

      expect(result.reasons).toEqual([]);
    });
  });
});

// ============================================================================
// score arithmetic edge cases
// ============================================================================

describe('score arithmetic edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchesLearnedWaveRange.mockReturnValue(false);
    mockMatchesLearnedWindPrefs.mockReturnValue(false);
    mockMatchesLearnedTidePrefs.mockReturnValue(false);
    mockIsTopEngagedBeach.mockReturnValue(false);
    mockCalculateImplicitBonus.mockReturnValue({
      total: 0,
      breakdown: { waveRange: 0, breakType: 0, topEngaged: 0 },
    });
  });

  it('total equals affinityBonus + personalizationBonus exactly', () => {
    const { matchesLearnedWaveRange: matchWave } =
      require('@/lib/services/personalized-scoring-service');
    matchWave.mockReturnValue(true);

    const beach = makeBeach();
    const forecast = makeForecast();
    const context = makeContext({
      learnedPrefs: makeLearnedPrefs({ confidence: 0.8 }),
      affinityMap: new Map([['beach-1', 50]]),
    });

    const result = calculatePersonalizationBonus(beach, forecast, context);

    // affinityBonus = min(50 * 0.05, 4) = 2.5
    // personalizationBonus = 15 * 0.8 = 12
    expect(result.affinityBonus).toBe(2.5);
    expect(result.personalizationBonus).toBe(12);
    expect(result.total).toBe(result.affinityBonus + result.personalizationBonus);
  });

  it('maximum possible total from all bonus sources', () => {
    const { matchesLearnedWaveRange: matchWave, matchesLearnedWindPrefs: matchWind, matchesLearnedTidePrefs: matchTide } =
      require('@/lib/services/personalized-scoring-service');
    matchWave.mockReturnValue(true);
    matchWind.mockReturnValue(true);
    matchTide.mockReturnValue(true);

    const mockCalcImplicit = require('@/lib/services/implicit-preferences-service').calculateImplicitBonus;
    const mockIsTopEngaged = require('@/lib/services/implicit-preferences-service').isTopEngagedBeach;
    mockCalcImplicit.mockReturnValue({ total: 20, breakdown: { waveRange: 10, breakType: 8, topEngaged: 2 } });
    mockIsTopEngaged.mockReturnValue(true);

    const beach = makeBeach({ break_type: 'reef' });
    const forecast = makeForecast();
    const context = makeContext({
      learnedPrefs: makeLearnedPrefs({ confidence: 1.0 }),
      implicitPrefs: makeImplicitPrefs({ confidence: 0.8 }),
      implicitWeight: 0.5,
      affinityMap: new Map([['beach-1', 100]]),
    });

    const result = calculatePersonalizationBonus(beach, forecast, context);

    // learned + implicit raw bonus is capped at 12.
    // affinity: min(100 * 0.05, 4) = 4
    expect(result.personalizationBonus).toBe(12);
    expect(result.affinityBonus).toBe(4);
    expect(result.total).toBe(16);
  });
});

// ============================================================================
// fetchPersonalizationContext — async, DB-backed tests
// ============================================================================

describe('fetchPersonalizationContext', () => {
  const testUserId = 'user-123';
  const testBeachIds = ['beach-1', 'beach-2', 'beach-3'];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: supabase returns no affinity rows
    resetChain({ data: [], error: null });
    (mockCreateSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase);

    // Default: services return null (new user)
    mockGetImplicitPreferences.mockResolvedValue(null);
    mockGetUserSurfPreferences.mockResolvedValue(null);
  });

  describe('parallel data fetching', () => {
    it('calls getImplicitPreferences, supabase affinity query, and getUserSurfPreferences', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0.5 });
      const learned = makeLearnedPrefs({ confidence: 0.8 });
      mockGetImplicitPreferences.mockResolvedValue(implicit);
      mockGetUserSurfPreferences.mockResolvedValue(learned);
      resetChain({ data: [], error: null });

      await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(mockGetImplicitPreferences).toHaveBeenCalledWith(testUserId);
      expect(mockGetUserSurfPreferences).toHaveBeenCalledWith(testUserId);
      expect(mockFrom).toHaveBeenCalledWith('user_beach_affinity');
    });

    it('uses pre-fetched learnedPrefs and skips getUserSurfPreferences call', async () => {
      const prefetched = makeLearnedPrefs({ confidence: 0.9 });

      await fetchPersonalizationContext(testUserId, testBeachIds, prefetched);

      expect(mockGetUserSurfPreferences).not.toHaveBeenCalled();
    });

    it('calls getUserSurfPreferences when learnedPrefs is not provided', async () => {
      await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(mockGetUserSurfPreferences).toHaveBeenCalledWith(testUserId);
    });

    it('calls getUserSurfPreferences when learnedPrefs is explicitly undefined', async () => {
      await fetchPersonalizationContext(testUserId, testBeachIds, undefined);

      expect(mockGetUserSurfPreferences).toHaveBeenCalledWith(testUserId);
    });

    it('skips getUserSurfPreferences when learnedPrefs is explicitly null', async () => {
      await fetchPersonalizationContext(testUserId, testBeachIds, null);

      expect(mockGetUserSurfPreferences).not.toHaveBeenCalled();
    });
  });

  describe('empty beachIds', () => {
    it('skips affinity query and returns empty affinityMap when beachIds is empty', async () => {
      const result = await fetchPersonalizationContext(testUserId, []);

      expect(mockFrom).not.toHaveBeenCalled();
      expect(result.affinityMap.size).toBe(0);
    });
  });

  describe('affinity map construction', () => {
    it('builds affinityMap from supabase affinity query results', async () => {
      const affinityData = [
        { beach_id: 'beach-1', affinity_score: 80 },
        { beach_id: 'beach-2', affinity_score: 40 },
      ];
      resetChain({ data: affinityData, error: null });

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.affinityMap.get('beach-1')).toBe(80);
      expect(result.affinityMap.get('beach-2')).toBe(40);
      expect(result.affinityMap.has('beach-3')).toBe(false);
    });

    it('returns empty affinityMap when affinity query returns empty data', async () => {
      resetChain({ data: [], error: null });

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.affinityMap.size).toBe(0);
    });

    it('returns empty affinityMap and continues when affinity query returns error', async () => {
      resetChain({ data: null, error: { message: 'DB error', code: '500' } });

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.affinityMap.size).toBe(0);
      // Should not throw
    });
  });

  describe('implicitWeight computation', () => {
    it('computes implicitWeight as implicitConf * (1 - explicitConf)', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      const learned = makeLearnedPrefs({ confidence: 0.3 });
      mockGetImplicitPreferences.mockResolvedValue(implicit);
      mockGetUserSurfPreferences.mockResolvedValue(learned);

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      // 0.6 * (1 - 0.3) = 0.6 * 0.7 = 0.42
      expect(result.implicitWeight).toBeCloseTo(0.42);
    });

    it('sets implicitWeight to 0 when rawImplicitWeight is below 0.1 threshold', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0.05 });
      mockGetImplicitPreferences.mockResolvedValue(implicit);
      mockGetUserSurfPreferences.mockResolvedValue(null); // explicitConf = 0

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      // 0.05 * (1 - 0) = 0.05 < 0.1 → 0
      expect(result.implicitWeight).toBe(0);
    });

    it('sets implicitWeight to 0 when implicitPrefs is null', async () => {
      mockGetImplicitPreferences.mockResolvedValue(null);

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.implicitWeight).toBe(0);
    });

    it('sets implicitWeight to 0 when both implicit and explicit confidence are 0', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0 });
      mockGetImplicitPreferences.mockResolvedValue(implicit);
      mockGetUserSurfPreferences.mockResolvedValue(null);

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.implicitWeight).toBe(0);
    });

    it('computes implicitWeight using pre-fetched learnedPrefs confidence', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0.8 });
      const prefetched = makeLearnedPrefs({ confidence: 0.5 });
      mockGetImplicitPreferences.mockResolvedValue(implicit);

      const result = await fetchPersonalizationContext(testUserId, testBeachIds, prefetched);

      // 0.8 * (1 - 0.5) = 0.4
      expect(result.implicitWeight).toBeCloseTo(0.4);
    });

    it('uses implicitWeight of full implicit confidence when learnedPrefs is null', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0.7 });
      mockGetImplicitPreferences.mockResolvedValue(implicit);
      // Pre-fetch null learnedPrefs → explicitConf = 0
      const result = await fetchPersonalizationContext(testUserId, testBeachIds, null);

      // 0.7 * (1 - 0) = 0.7
      expect(result.implicitWeight).toBeCloseTo(0.7);
    });

    it('fully suppresses implicit signal when explicitConf is 1.0', async () => {
      // When explicit confidence is at maximum, implicit should be completely suppressed
      mockGetImplicitPreferences.mockResolvedValue(makeImplicitPrefs({ confidence: 0.8 }));
      mockGetUserSurfPreferences.mockResolvedValue(makeLearnedPrefs({ confidence: 1.0 }));
      resetChain({ data: [], error: null });

      const ctx = await fetchPersonalizationContext('u1', ['b1']);

      // implicitWeight = 0.8 * (1 - 1.0) = 0.0, which is below 0.1 threshold
      expect(ctx.implicitWeight).toBe(0);
    });
  });

  describe('error handling', () => {
    it('returns null implicitPrefs and continues when getImplicitPreferences throws', async () => {
      mockGetImplicitPreferences.mockRejectedValue(new Error('Network timeout'));

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.implicitPrefs).toBeNull();
      expect(result.implicitWeight).toBe(0);
    });

    it('returns null learnedPrefs and continues when getUserSurfPreferences throws', async () => {
      mockGetUserSurfPreferences.mockRejectedValue(new Error('DB connection failed'));

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.learnedPrefs).toBeNull();
    });

    it('returns populated context for other data even when implicit prefs fetch fails', async () => {
      const learned = makeLearnedPrefs({ confidence: 0.8 });
      mockGetImplicitPreferences.mockRejectedValue(new Error('Timeout'));
      mockGetUserSurfPreferences.mockResolvedValue(learned);

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result.learnedPrefs).toEqual(learned);
      expect(result.implicitPrefs).toBeNull();
    });
  });

  describe('return shape', () => {
    it('returns a fully populated PersonalizationContext', async () => {
      const implicit = makeImplicitPrefs({ confidence: 0.6 });
      const learned = makeLearnedPrefs({ confidence: 0.3 });
      const affinityData = [{ beach_id: 'beach-1', affinity_score: 55 }];
      mockGetImplicitPreferences.mockResolvedValue(implicit);
      mockGetUserSurfPreferences.mockResolvedValue(learned);
      resetChain({ data: affinityData, error: null });

      const result = await fetchPersonalizationContext(testUserId, testBeachIds);

      expect(result).toMatchObject({
        implicitPrefs: implicit,
        learnedPrefs: learned,
      });
      expect(result.affinityMap).toBeInstanceOf(Map);
      expect(result.affinityMap.get('beach-1')).toBe(55);
      expect(typeof result.implicitWeight).toBe('number');
    });
  });
});
