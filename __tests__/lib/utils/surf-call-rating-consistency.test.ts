/**
 * @jest-environment node
 *
 * Rating fields that describe one session must agree: the explanation, tiers
 * and character follow the verdict the caller stamps, and tier times read in
 * the beach's own timezone.
 */

import { computeSurfCall, computeSurfCallTiers } from '@/lib/utils/surf-call-logic';
import { LOW_TIDE_HEAVY_SWELL_WARNING } from '@/lib/domains/scoring';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'test-beach-id',
    name: 'Test Beach',
    slug: 'test-beach',
    lat: 32.75,
    lon: -117.25,
    city: 'San Diego',
    state: 'CA',
    country: 'US',
    break_type: 'beach break',
    timezone: 'America/Los_Angeles',
    wind_offshore_deg: 90,
    ...overrides,
  } as Beach;
}

function makeForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'test-beach-id',
    forecast_at: '2026-10-19T23:30:00Z',
    wave_height: '3-4 ft',
    wave_period: '12s',
    wind_speed: '8',
    wind_direction: 'W',
    wind_direction_deg: 270,
    tide_status: 'Rising',
    confidence_score: 75,
    data_source: 'NOAA_BUOY',
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeWindow(overrides: Partial<PersonalizedForecastWindow> = {}): PersonalizedForecastWindow {
  return {
    start: new Date('2026-10-19T23:30:00Z'),
    end: new Date('2026-10-20T02:30:00Z'),
    peakTime: new Date('2026-10-19T23:30:00Z'),
    tide: 'Rising',
    wind: '8 W',
    waveHeight: '3-4 ft',
    wavePeriod: '12s',
    dataSource: 'NOAA_BUOY',
    confidence: 75,
    timezone: 'America/Los_Angeles',
    score: 55,
    ...overrides,
  };
}

const BLOWN_OUT_ROW = {
  wave_height: '2-3 ft',
  wind_speed: '24',
  wind_direction: 'W',
  wind_direction_deg: 270,
};

describe('computeSurfCall — explanation follows the stamped verdict', () => {
  it('lets a blown-out row read as a wind-ruined MAYBE, not a generic NO', () => {
    const window = makeWindow({ score: 31, waveHeight: '2-3 ft' });
    const forecasts = [makeForecast(BLOWN_OUT_ROW)];

    const own = computeSurfCall(window, forecasts, makeBeach());
    expect(own.verdict).toBe('NO');
    expect(own.character?.category).toBe('skip');

    const stamped = computeSurfCall(window, forecasts, makeBeach(), { verdict: 'MAYBE' });
    expect(stamped.verdict).toBe('MAYBE');
    expect(stamped.character).toMatchObject({ category: 'skip', label: expect.stringMatching(/wind/i) });
    expect(stamped.whySentence).not.toMatch(/not favorable/i);
    expect(stamped.whySentence).toMatch(/wind/i);
    // MAYBE keeps a window; the NO baseline suppressed it.
    expect(stamped.bestWindowStart).not.toBeNull();
    expect(own.bestWindowStart).toBeNull();
  });

  it('derives per-skill tiers from the stamped verdict', () => {
    const window = makeWindow({ score: 31, waveHeight: '2-3 ft' });
    const forecasts = [makeForecast(BLOWN_OUT_ROW)];

    const tiers = computeSurfCallTiers(window, forecasts, makeBeach(), { verdict: 'MAYBE' });
    expect(tiers.intermediate.verdict).toBe('MAYBE');
    expect(tiers.intermediate.trail).toMatch(/^TRY AT /);
  });
});

describe('computeSurfCall — stamped verdict keeps caution and duration truth', () => {
  it('keeps the setup caution in the explanation under a stamped MAYBE', () => {
    const beach = makeBeach({
      break_type: 'beach',
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 6,
      preferred_tide_direction: 'either',
    } as Partial<Beach>);
    const forecasts = [
      makeForecast({
        wave_height: '7 ft',
        wave_period: '10s',
        swell_1_height: '7',
        swell_1_period: '10s',
        tide_height: '-0.4',
        tide_status: 'Falling',
      }),
    ];
    const window = makeWindow({ score: 90, waveHeight: '7 ft', wavePeriod: '10s' });

    const result = computeSurfCall(window, forecasts, beach, { verdict: 'MAYBE' });

    expect(result.verdict).toBe('MAYBE');
    expect(result.cautions).toContain(LOW_TIDE_HEAVY_SWELL_WARNING);
    expect(result.whySentence).toBe(`${LOW_TIDE_HEAVY_SWELL_WARNING}.`);
  });

  it('does not call a stamped MAYBE window too short to surf', () => {
    const window = makeWindow({
      start: new Date('2026-10-19T23:30:00Z'),
      end: new Date('2026-10-19T23:50:00Z'),
    });
    const forecasts = [makeForecast()];

    expect(computeSurfCall(window, forecasts, makeBeach()).whySentence).toMatch(/no viable window/i);

    const stamped = computeSurfCall(window, forecasts, makeBeach(), { verdict: 'MAYBE' });
    expect(stamped.verdict).toBe('MAYBE');
    expect(stamped.whySentence).not.toMatch(/no viable window/i);
  });

  it('still reports a stamped NO on a too-short window as such', () => {
    const window = makeWindow({
      end: new Date('2026-10-19T23:50:00Z'),
    });
    const stamped = computeSurfCall(window, [makeForecast()], makeBeach(), { verdict: 'NO' });
    expect(stamped.whySentence).toMatch(/no viable window/i);
  });
});

describe('computeSurfCall — character agrees with the wind type', () => {
  it('does not promise clean wind under strong cross-shore wind', () => {
    const base = {
      wave_height: '3-4 ft',
      wave_period: '14s',
      wind_direction_deg: 180,
      tide_height: '2.0',
      swell_1_height: '3.5',
      swell_1_period: '14s',
      swell_1_direction: '270',
    };
    const beach = makeBeach({ wind_cross_shore_ok_kt: 4 } as Partial<Beach>);
    // 5 mph is over a 4 kt (4.6 mph) tolerance.
    const strong = computeSurfCall(
      makeWindow({ wavePeriod: '14s' }),
      [makeForecast({ ...base, wind_speed: '5' })],
      beach,
      { verdict: 'MAYBE' },
    );
    expect(strong.windType).toBe('cross-shore');
    expect(strong.character?.category).not.toMatch(/clean/);
    expect(strong.character?.label).not.toMatch(/clean wind/i);

    const within = computeSurfCall(
      makeWindow({ wavePeriod: '14s' }),
      [makeForecast({ ...base, wind_speed: '5' })],
      makeBeach(),
      { verdict: 'MAYBE' },
    );
    expect(within.character?.category).toBe('medium-clean');
  });

  it('does not promise clean wind under an onshore wind type', () => {
    const forecasts = [
      makeForecast({
        wave_height: '3-4 ft',
        wave_period: '14s',
        wind_speed: '5',
        wind_direction_deg: 270,
        tide_height: '2.0',
        swell_1_height: '3.5',
        swell_1_period: '14s',
        swell_1_direction: '270',
      }),
    ];
    const result = computeSurfCall(
      makeWindow({ wavePeriod: '14s' }),
      forecasts,
      makeBeach(),
      { verdict: 'MAYBE' },
    );
    expect(result.windType).toBe('onshore');
    expect(result.character?.label).not.toMatch(/clean wind|glassy/i);
    expect(result.character?.category).not.toMatch(/clean/);
  });

  it('keeps a clean-wind label when the wind is not onshore', () => {
    const forecasts = [
      makeForecast({
        wave_height: '3-4 ft',
        wave_period: '14s',
        wind_speed: '5',
        wind_direction_deg: 180,
        tide_height: '2.0',
        swell_1_height: '3.5',
        swell_1_period: '14s',
        swell_1_direction: '270',
      }),
    ];
    const result = computeSurfCall(
      makeWindow({ wavePeriod: '14s' }),
      forecasts,
      makeBeach(),
      { verdict: 'MAYBE' },
    );
    expect(result.windType).not.toBe('onshore');
    expect(result.character?.category).toBe('medium-clean');
  });
});

describe('computeSurfCallTiers — trail time is beach-local', () => {
  const window = makeWindow();
  const forecasts = [makeForecast()];

  it('formats a 23:30Z window start in America/Los_Angeles', () => {
    const tiers = computeSurfCallTiers(window, forecasts, makeBeach(), { verdict: 'MAYBE' });
    expect(tiers.intermediate.bestWindowStart).toBe('2026-10-19T23:30:00.000Z');
    expect(tiers.intermediate.trail).toBe('TRY AT 4:30 PM');
  });

  it('uses the beach timezone, not the server zone', () => {
    const tiers = computeSurfCallTiers(
      makeWindow({ timezone: 'Pacific/Honolulu' }),
      forecasts,
      makeBeach({ timezone: 'Pacific/Honolulu' }),
      { verdict: 'MAYBE' },
    );
    expect(tiers.intermediate.trail).toBe('TRY AT 1:30 PM');
  });

  it('prefers an explicit timezone option', () => {
    const tiers = computeSurfCallTiers(window, forecasts, makeBeach(), {
      verdict: 'MAYBE',
      timezone: 'Pacific/Honolulu',
    });
    expect(tiers.intermediate.trail).toBe('TRY AT 1:30 PM');
  });
});
