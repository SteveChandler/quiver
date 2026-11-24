/**
 * @jest-environment node
 */

import { bridgeBeachForecastRows, tideWindowForRows } from '@/lib/services/discovery/hourly-bridge-rows';
import type { EnhancedForecastEntity } from '@/types/forecast';

const isBridgedForecast = (row: EnhancedForecastEntity): boolean => row.raw_forecast?.hourly_bridge != null;

const HOUR = 60 * 60 * 1000;
const TZ = 'America/Los_Angeles';

// 03:00, 06:00, 09:00 ... PDT on 2026-10-27 (UTC-7): stored rows every 3 h.
function rows(): EnhancedForecastEntity[] {
  return Array.from({ length: 8 }, (_, index) => {
    const at = new Date(Date.parse('2026-10-27T10:00:00.000Z') + index * 3 * HOUR).toISOString();
    return {
      id: `row-${index}`,
      beach_id: 'beach-1',
      forecast_at: at,
      forecast_date: at.slice(0, 10),
      forecast_time: at.slice(11, 19),
      wave_height: '3.0 ft',
      tide_height: '2.0 ft',
      tide_status: 'Rising',
    } as EnhancedForecastEntity;
  });
}

const sunTimes = {
  sunrises: [new Date('2026-10-27T14:00:00.000Z')], // 07:00 PDT, first light 06:30
  sunsets: [new Date('2026-10-28T00:00:00.000Z')], // 17:00 PDT, last light 17:20
};

const bridgedTimes = (out: EnhancedForecastEntity[]): string[] =>
  out.filter(isBridgedForecast).map((row) => row.forecast_at);

describe('bridgeBeachForecastRows', () => {
  it('keeps every stored row and bridges only hours that overlap usable light', () => {
    const out = bridgeBeachForecastRows(rows(), { timezone: TZ, tide: null, sunTimes });

    expect(out.filter((row) => !isBridgedForecast(row)).map((row) => row.id)).toEqual(rows().map((row) => row.id));
    // 04:00 and 05:00 PDT are before first light (06:30); 17:00 PDT overlaps last light (17:20).
    expect(bridgedTimes(out)).toEqual([
      '2026-10-27T14:00:00.000Z',
      '2026-10-27T15:00:00.000Z',
      '2026-10-27T17:00:00.000Z',
      '2026-10-27T18:00:00.000Z',
      '2026-10-27T20:00:00.000Z',
      '2026-10-27T21:00:00.000Z',
      '2026-10-27T23:00:00.000Z',
      '2026-10-28T00:00:00.000Z',
    ]);
  });

  it('honours the start and end bounds', () => {
    const out = bridgeBeachForecastRows(rows(), {
      timezone: TZ,
      tide: null,
      sunTimes,
      startMs: Date.parse('2026-10-27T17:00:00.000Z'),
      endMs: Date.parse('2026-10-27T21:00:00.000Z'),
    });

    expect(bridgedTimes(out)).toEqual(['2026-10-27T17:00:00.000Z', '2026-10-27T18:00:00.000Z', '2026-10-27T20:00:00.000Z']);
  });

  it('bridges a scoped hour in the dark, within 3 h of it only', () => {
    const scopedAtMs = Date.parse('2026-10-27T11:00:00.000Z'); // 04:00 PDT
    const out = bridgeBeachForecastRows(rows(), { timezone: TZ, tide: null, sunTimes, scopedAtMs });

    // 14:00Z is exactly 3 h after the scoped hour, so it is outside the radius.
    expect(bridgedTimes(out)).toEqual(['2026-10-27T11:00:00.000Z', '2026-10-27T12:00:00.000Z']);
    expect(out.find((row) => row.forecast_at === '2026-10-27T11:00:00.000Z')?.id).toBe('row-0:h+1');
  });

  it('gives the same ids on every run', () => {
    const ids = (): string[] => bridgeBeachForecastRows(rows(), { timezone: TZ, tide: null, sunTimes }).map((row) => row.id);
    expect(ids()).toEqual(ids());
  });
});

describe('tideWindowForRows', () => {
  it('pads the fetched rows by an hour before and two after, so the rate exists at both edges', () => {
    expect(tideWindowForRows(rows())).toEqual({
      startIso: '2026-10-27T09:00:00.000Z',
      endIso: '2026-10-28T09:00:00.000Z',
    });
  });

  it('covers the bridge radius around a scoped hour', () => {
    expect(tideWindowForRows(rows(), Date.parse('2026-10-27T16:00:00.000Z'))).toEqual({
      startIso: '2026-10-27T12:00:00.000Z',
      endIso: '2026-10-27T20:00:00.000Z',
    });
  });

  it('is null without a timed row', () => {
    expect(tideWindowForRows([])).toBeNull();
  });
});
