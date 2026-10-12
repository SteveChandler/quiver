import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  forecastToSnapshot,
  scoreBeachWithEngine,
} from '@/lib/domains/scoring';
import { windChopCeiling } from '@/lib/domains/scoring/wind-chop-ceiling';
import type { ScorerInput } from '@/lib/domains/scoring/types';
import { createBeach, createForecast } from '../__fixtures__';

// Real Pacific Beach config and the Oct 12 2026 21:00Z (2 pm PT) enhanced_forecasts row.
const pacificBeach = createBeach({
  id: 'pacific-beach',
  slug: 'pacific-beach',
  name: 'Pacific Beach',
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 30,
  break_type: 'beach',
  swell_window_min_deg: 190,
  swell_window_max_deg: 310,
  swell_window_center_deg: 250,
  swell_window_halfwidth_deg: 60,
  preferred_tide_ft_min: 1.5,
  preferred_tide_ft_max: 4.5,
  preferred_tide_direction: 'falling',
} as never);

const oct12PbRow = {
  forecast_at: '2026-10-12T21:00:00Z',
  wave_height: '5.2 ft',
  wave_period: '11s',
  wave_direction: 'SSW',
  wind_speed: '15 mph',
  wind_direction: 'SW',
  wind_direction_deg: 225,
  tide_height: '2.7 ft',
  tide_status: 'Falling',
  swell_1_height: '3.1 ft',
  swell_1_period: '11s',
  swell_1_direction: 'SSW',
  swell_2_height: '1.6 ft',
  swell_2_period: '14s',
  swell_2_direction: 'WNW',
} as const;

function inputFor(overrides: Record<string, unknown>): ScorerInput {
  return {
    profile: beachToSpotProfile(pacificBeach as never),
    snapshot: forecastToSnapshot(createForecast({ ...oct12PbRow, ...overrides } as never) as never),
    window: null,
    preferences: null,
  };
}

function total(overrides: Record<string, unknown> = {}): number {
  const engine = createDiscoveryScoringEngine();
  const forecast = createForecast({ ...oct12PbRow, ...overrides } as never);
  return scoreBeachWithEngine(engine, pacificBeach as never, forecast as never).total;
}

describe('windChopCeiling: onshore-blown big swell', () => {
  it('caps the Oct 12 2026 Pacific Beach 2 pm row (5.2 ft @ 11 s, 15 mph SW onshore) at MEH', () => {
    expect(total()).toBeLessThanOrEqual(39);
  });

  it('caps at 39 when sustained onshore wind is >= 15 mph', () => {
    const chop = windChopCeiling(inputFor({}), new Map([['windQuality', 22]]));
    expect(chop?.ceiling).toBe(39);
  });

  it('caps at 54 when sustained onshore-or-cross wind is 12-15 mph and wind quality is poor', () => {
    const chop = windChopCeiling(
      inputFor({ wind_speed: '13 mph' }),
      new Map([['windQuality', 30]]),
    );
    expect(chop?.ceiling).toBe(54);
  });

  it('treats sideshore wind like onshore', () => {
    // 180 deg is 90 deg off the 90 deg offshore vector: sideshore for a 30 deg tolerance.
    const chop = windChopCeiling(
      inputFor({ wind_direction: 'S', wind_direction_deg: 180 }),
      new Map([['windQuality', 22]]),
    );
    expect(chop?.ceiling).toBe(39);
  });

  it('does not fire below 12 mph', () => {
    const chop = windChopCeiling(
      inputFor({ wind_speed: '11 mph' }),
      new Map([['windQuality', 20]]),
    );
    expect(chop).toBeNull();
  });

  it('does not fire when wind quality is >= 35', () => {
    const chop = windChopCeiling(
      inputFor({ wind_speed: '13 mph' }),
      new Map([['windQuality', 50]]),
    );
    expect(chop).toBeNull();
  });

  it('does not fire on offshore wind', () => {
    const chop = windChopCeiling(
      inputFor({ wind_speed: '18 mph', wind_direction: 'E', wind_direction_deg: 90 }),
      new Map([['windQuality', 30]]),
    );
    expect(chop).toBeNull();
  });

  it('leaves 5.2 ft @ 12 s with 6 mph offshore unaffected', () => {
    const offshore = {
      wave_period: '12s',
      swell_1_period: '12s',
      wind_speed: '6 mph',
      wind_direction: 'E',
      wind_direction_deg: 90,
    };
    const input = inputFor(offshore);
    const engine = createDiscoveryScoringEngine();
    const composite = engine.score(input);
    expect(windChopCeiling(input, composite.subscores)).toBeNull();
    expect(total(offshore)).toBeGreaterThan(54);
  });

  it('does not cap big surf at 13 mph onshore today: the textured tier keeps windQuality >= 35', () => {
    const input = inputFor({ wind_speed: '13 mph' });
    const composite = createDiscoveryScoringEngine().score(input);
    expect(composite.subscores.get('windQuality')).toBeGreaterThanOrEqual(35);
    expect(windChopCeiling(input, composite.subscores)).toBeNull();
  });

  it('still requires poor windQuality when the caller ignores it for the small-wave branch', () => {
    const chop = windChopCeiling(
      inputFor({ wind_speed: '13 mph' }),
      new Map([['windQuality', 51]]),
      { ignoreWindQuality: true },
    );
    expect(chop).toBeNull();
  });

  it('takes the lower ceiling when the small-wave branch also fires', () => {
    const chop = windChopCeiling(
      inputFor({ wave_height: '2 ft', wave_period: '7s', wind_speed: '16 mph' }),
      new Map([['windQuality', 10]]),
    );
    expect(chop?.ceiling).toBe(39);
  });

  it('does not print a rounded-up speed under the 54 tier', () => {
    const chop = windChopCeiling(
      inputFor({ wind_speed: '14.6 mph' }),
      new Map([['windQuality', 30]]),
    );
    expect(chop?.ceiling).toBe(54);
    expect(chop?.reason).toBe('Textured onshore wind (14 mph) caps score at 54');
  });
});
