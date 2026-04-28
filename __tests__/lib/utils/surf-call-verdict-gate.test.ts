/**
 * @jest-environment node
 *
 * Fix 2 integration: computeSurfCall must verdict-gate the best window.
 * - YES   → leave the wide window untouched
 * - MAYBE → narrow to peakTime ± 1h
 * - NO    → suppress (both bestWindowStart + bestWindowEnd null)
 */

import { computeSurfCall } from '@/lib/utils/surf-call-logic';
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
    wind_offshore_deg: 90,
    ...overrides,
  } as Beach;
}

function makeForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'test-beach-id',
    forecast_at: '2026-04-20T15:00:00Z',
    forecast_date: '2026-04-20',
    forecast_time: '08:00:00',
    wave_height: '3-4 ft',
    wave_period: '12s',
    wind_speed: '8',
    wind_direction: 'NW',
    wind_direction_deg: 315,
    tide_status: 'Rising',
    confidence_score: 75,
    data_source: 'NOAA_BUOY',
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeWindow(overrides: Partial<PersonalizedForecastWindow> = {}): PersonalizedForecastWindow {
  return {
    // Wide window: 11 hours of daylight
    start: new Date('2026-04-20T15:32:00Z'),
    end: new Date('2026-04-21T02:23:00Z'),
    peakTime: new Date('2026-04-20T18:00:00Z'),
    tide: 'Rising',
    wind: '8 NW',
    waveHeight: '3-4 ft',
    wavePeriod: '12s',
    dataSource: 'NOAA_BUOY',
    confidence: 75,
    timezone: 'America/Los_Angeles',
    score: 75,
    ...overrides,
  };
}

describe('computeSurfCall — best-window verdict gating', () => {
  it('leaves the wide window untouched when verdict is YES (high score)', () => {
    const window = makeWindow({ score: 85 }); // triggers YES
    // PR 4: character gate caps "Worth it" on positive characters only.
    // Use a clean offshore wind so the snapshot lands as medium-clean and
    // the score-only YES survives the gate.
    const forecasts = [
      makeForecast({
        wave_height: '4-5 ft',
        wind_speed: '5',
        wind_direction: 'E',
        wind_direction_deg: 90,
        swell_1_height: '4',
        swell_1_period: '12s',
        swell_1_direction: '270',
      }),
    ];
    const result = computeSurfCall(window, forecasts, makeBeach());
    if (result.verdict !== 'YES') {
      // guard so a future scoring refactor produces a clear failure
      throw new Error(`expected YES, got ${result.verdict}`);
    }
    expect(result.bestWindowStart).toBe(window.start.toISOString());
    expect(result.bestWindowEnd).toBe(window.end.toISOString());
  });

  it('narrows the window to peakTime ± 1h when verdict is MAYBE', () => {
    // Onshore wind + small waves tends to land around MAYBE for a beach break.
    const window = makeWindow({
      score: 55,
      waveHeight: '1-2 ft',
      wind: '8 W',
    });
    const forecasts = [
      makeForecast({
        wave_height: '1-2 ft',
        wind_speed: '8',
        wind_direction: 'W',
        wind_direction_deg: 270, // onshore vs offshore=90
      }),
    ];
    const result = computeSurfCall(window, forecasts, makeBeach());
    if (result.verdict !== 'MAYBE') {
      throw new Error(`expected MAYBE, got ${result.verdict}`);
    }
    // Peak 18:00Z ± 1h → 17:00Z – 19:00Z, clamped to window [15:32Z, 02:23Z+1d]
    expect(result.bestWindowStart).toBe('2026-04-20T17:00:00.000Z');
    expect(result.bestWindowEnd).toBe('2026-04-20T19:00:00.000Z');
  });

  it('sets bestWindowStart + bestWindowEnd to null when verdict is NO', () => {
    // Score well below MAYBE threshold to force NO
    const window = makeWindow({ score: 10 });
    const forecasts = [
      makeForecast({
        wave_height: '0-1 ft',
        wind_speed: '25',
        wind_direction: 'W',
        wind_direction_deg: 270, // onshore
      }),
    ];
    const result = computeSurfCall(window, forecasts, makeBeach());
    if (result.verdict !== 'NO') {
      throw new Error(`expected NO, got ${result.verdict}`);
    }
    expect(result.bestWindowStart).toBeNull();
    expect(result.bestWindowEnd).toBeNull();
  });
});
