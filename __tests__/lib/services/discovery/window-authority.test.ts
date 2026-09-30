import {
  DISPLAY_WINDOW_MINUTES,
  WINDOW_AUTHORITY_MAX_WINDOWS,
  deriveDisplayWindow,
  selectBeachDayWindows,
  withDisplayWindow,
} from '@/lib/services/discovery/window-authority';
import { selectBestWindows } from '@/lib/services/discovery/window-selector';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { PersonalizedForecastWindow } from '@/types/personalization';

const timezone = 'America/Los_Angeles';
const beach = { id: 'beach-1', name: 'Ocean Beach', timezone } as Beach;

function forecast(id: string, forecastAt: string): EnhancedForecastEntity {
  return { id, beach_id: beach.id, forecast_at: forecastAt } as EnhancedForecastEntity;
}

function window(
  start: string,
  end: string,
  peakTime?: string,
): PersonalizedForecastWindow {
  return {
    start: new Date(start),
    end: new Date(end),
    peakTime: peakTime ? new Date(peakTime) : undefined,
    tide: 'Rising',
    wind: '5 mph W',
    waveHeight: '3 ft',
    wavePeriod: '12s',
    dataSource: 'CDIP',
    confidence: 85,
    timezone,
  };
}

describe('withDisplayWindow', () => {
  it('builds a 150-minute band around an in-window peak and respects daylight and raw bounds', () => {
    const sourceForecast = forecast('source', '2026-09-09T13:00:00.000Z');
    const rawWindow = {
      ...window(
        '2026-09-09T12:00:00.000Z',
        '2026-09-09T17:00:00.000Z',
        '2026-09-09T13:30:00.000Z',
      ),
      sourceForecast,
    };

    const result = withDisplayWindow(rawWindow);

    expect(result).not.toBe(rawWindow);
    expect(result.displayWindowStart.toISOString()).toBe('2026-09-09T13:00:00.000Z');
    expect(result.displayWindowEnd.toISOString()).toBe('2026-09-09T15:30:00.000Z');
    expect((result.displayWindowEnd.getTime() - result.displayWindowStart.getTime()) / 60_000)
      .toBe(DISPLAY_WINDOW_MINUTES);
    expect(result.sourceForecast).toBe(sourceForecast);
  });

  it('uses raw bounds for a window no longer than 150 minutes that contains its peak', () => {
    const rawWindow = window(
      '2026-09-09T15:00:00.000Z',
      '2026-09-09T17:00:00.000Z',
      '2026-09-09T16:00:00.000Z',
    );

    const result = withDisplayWindow(rawWindow);

    expect(result.displayWindowStart).toBe(rawWindow.start);
    expect(result.displayWindowEnd).toBe(rawWindow.end);
  });

  it('replaces an out-of-window peak with the raw window midpoint', () => {
    const rawWindow = window(
      '2026-09-09T15:00:00.000Z',
      '2026-09-09T18:00:00.000Z',
      '2026-09-09T12:00:00.000Z',
    );

    const result = withDisplayWindow(rawWindow);

    expect(result.peakTime.toISOString()).toBe('2026-09-09T16:30:00.000Z');
    expect(result.displayWindowStart.getTime()).toBeGreaterThanOrEqual(rawWindow.start.getTime());
    expect(result.displayWindowEnd.getTime()).toBeLessThanOrEqual(rawWindow.end.getTime());
  });
});

describe('display window last light', () => {
  // Sep 30 in San Diego: sunrise 06:36 PDT, sunset 18:38 PDT, so last light is 18:58 PDT.
  const sunTimes = {
    sunrises: [new Date('2026-09-30T13:36:00.000Z')],
    sunsets: [new Date('2026-10-01T01:38:00.000Z')],
  };
  const LAST_LIGHT = '2026-10-01T01:58:00.000Z';

  it('re-clamps the end to last light after the band is shifted forward to the raw start', () => {
    const rawWindow = window(
      '2026-10-01T00:00:00.000Z', // 17:00 PDT
      '2026-10-01T03:00:00.000Z', // 20:00 PDT
      '2026-10-01T00:00:00.000Z',
    );

    const withoutSun = withDisplayWindow(rawWindow);
    const withSun = withDisplayWindow(rawWindow, sunTimes);

    // Without sun times the 18:00 fallback band shifts to 17:00-19:30.
    expect(withoutSun.displayWindowEnd.toISOString()).toBe('2026-10-01T02:30:00.000Z');
    expect(withSun.displayWindowStart.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(withSun.displayWindowEnd.toISOString()).toBe(LAST_LIGHT);
    expect(withSun.end).toBe(rawWindow.end);
  });

  it('clamps a short raw window that runs past last light', () => {
    const result = deriveDisplayWindow({
      rawStart: new Date('2026-10-01T00:30:00.000Z'), // 17:30 PDT
      rawEnd: new Date('2026-10-01T02:30:00.000Z'), // 19:30 PDT
      peak: new Date('2026-10-01T01:00:00.000Z'), // 18:00 PDT
      timezone,
      sunTimes,
    });

    expect(result.start.toISOString()).toBe('2026-10-01T00:30:00.000Z');
    expect(result.end.toISOString()).toBe(LAST_LIGHT);
  });

  it('keeps a dark peak unclamped so Now is never gated by the clock', () => {
    const rawWindow = window(
      '2026-10-01T03:00:00.000Z', // 20:00 PDT
      '2026-10-01T06:00:00.000Z', // 23:00 PDT
      '2026-10-01T03:00:00.000Z',
    );

    const result = withDisplayWindow(rawWindow, sunTimes);

    expect(result.displayWindowStart.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(result.displayWindowEnd.toISOString()).toBe('2026-10-01T05:30:00.000Z');
  });

  it('does not clamp on the 18:00 fallback when no sunset is known for the peak day', () => {
    const otherDay = {
      sunrises: [new Date('2026-10-01T13:37:00.000Z')],
      sunsets: [new Date('2026-10-02T01:36:00.000Z')],
    };
    const rawWindow = window(
      '2026-10-01T00:00:00.000Z',
      '2026-10-01T03:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    );

    const result = withDisplayWindow(rawWindow, otherDay);

    expect(result.displayWindowEnd.toISOString()).toBe('2026-10-01T02:30:00.000Z');
  });

  it('leaves a window that already ends before last light untouched', () => {
    const rawWindow = window(
      '2026-10-01T00:00:00.000Z', // 17:00 PDT
      '2026-10-01T01:30:00.000Z', // 18:30 PDT
      '2026-10-01T00:30:00.000Z',
    );

    const result = withDisplayWindow(rawWindow, sunTimes);

    expect(result.displayWindowStart).toBe(rawWindow.start);
    expect(result.displayWindowEnd).toBe(rawWindow.end);
  });
});

describe('withDisplayWindow with a display source', () => {
  // Sep 30 in San Diego: last light is 18:58 PDT (01:58Z).
  const sunTimes = {
    sunrises: [new Date('2026-09-30T13:36:00.000Z')],
    sunsets: [new Date('2026-10-01T01:38:00.000Z')],
  };
  const LAST_LIGHT = '2026-10-01T01:58:00.000Z';
  // A NOW window: the 08:00 bucket that contains the request instant, peaking at it.
  const now = window(
    '2026-09-30T15:00:00.000Z', // 08:00 PDT
    '2026-09-30T21:00:00.000Z', // 14:00 PDT, extended through supported rows
    '2026-09-30T17:27:00.000Z', // 10:27 PDT
  );
  // The 11:00 row the scoped call anchors on.
  const anchor = window(
    '2026-09-30T18:00:00.000Z',
    '2026-09-30T21:00:00.000Z',
    '2026-09-30T18:00:00.000Z',
  );

  it('keeps the band end fixed as the request instant moves inside the bucket', () => {
    const ends = ['17:27', '17:56', '18:40'].map((time) => {
      const moved = { ...now, peakTime: new Date(`2026-09-30T${time}:00.000Z`) };
      return withDisplayWindow(moved, sunTimes, anchor).displayWindowEnd.toISOString();
    });

    expect(new Set(ends)).toEqual(new Set(['2026-09-30T20:30:00.000Z']));
    // The same instants on their own peak slide with the clock.
    expect(withDisplayWindow(now, sunTimes).displayWindowEnd.toISOString())
      .toBe('2026-09-30T18:42:00.000Z');
  });

  it('equals the band the anchor row presents on its own', () => {
    const anchored = withDisplayWindow(now, sunTimes, anchor);
    const scoped = withDisplayWindow(anchor, sunTimes);

    expect(anchored.displayWindowStart).toEqual(scoped.displayWindowStart);
    expect(anchored.displayWindowEnd).toEqual(scoped.displayWindowEnd);
  });

  it('keeps the window raw bounds and peak', () => {
    const result = withDisplayWindow(now, sunTimes, anchor);

    expect(result.start).toBe(now.start);
    expect(result.end).toBe(now.end);
    expect(result.peakTime).toBe(now.peakTime);
  });

  it('ends at last light when the anchored band would run past it', () => {
    const eveningNow = window(
      '2026-09-30T21:00:00.000Z', // 14:00 PDT
      '2026-10-01T03:00:00.000Z', // 20:00 PDT
      '2026-10-01T00:20:00.000Z', // 17:20 PDT
    );
    const eveningAnchor = window(
      '2026-10-01T00:00:00.000Z', // 17:00 PDT
      '2026-10-01T03:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    );

    const result = withDisplayWindow(eveningNow, sunTimes, eveningAnchor);

    expect(result.displayWindowStart.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(result.displayWindowEnd.toISOString()).toBe(LAST_LIGHT);
  });

  it('falls back to the light-clamped band on the window when the anchor row starts after last light', () => {
    const duskNow = window(
      '2026-10-01T00:00:00.000Z', // 17:00 PDT
      '2026-10-01T03:00:00.000Z', // 20:00 PDT
      '2026-10-01T01:40:00.000Z', // 18:40 PDT, before last light
    );
    const darkAnchor = window(
      '2026-10-01T03:00:00.000Z', // 20:00 PDT
      '2026-10-01T06:00:00.000Z',
      '2026-10-01T03:00:00.000Z',
    );

    const result = withDisplayWindow(duskNow, sunTimes, darkAnchor);

    expect(result.displayWindowEnd.toISOString()).toBe(LAST_LIGHT);
    expect(result.displayWindowEnd.getTime()).toBeGreaterThan(result.displayWindowStart.getTime());
  });

  it('keeps a dark anchor band unclamped when the window is itself dark', () => {
    const nightNow = window(
      '2026-10-01T03:00:00.000Z', // 20:00 PDT
      '2026-10-01T06:00:00.000Z',
      '2026-10-01T03:20:00.000Z', // 20:20 PDT, after last light
    );
    const nightAnchor = window(
      '2026-10-01T03:00:00.000Z',
      '2026-10-01T06:00:00.000Z',
      '2026-10-01T03:00:00.000Z',
    );

    const result = withDisplayWindow(nightNow, sunTimes, nightAnchor);

    expect(result.displayWindowStart.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(result.displayWindowEnd.toISOString()).toBe('2026-10-01T05:30:00.000Z');
  });
});

describe('selectBeachDayWindows', () => {
  const requestedDayRows = [
    forecast('morning', '2026-09-09T15:00:00.000Z'),
    forecast('midday', '2026-09-09T19:00:00.000Z'),
  ];
  const otherDayRow = forecast('tomorrow', '2026-09-10T15:00:00.000Z');

  it('runs one selector for the local day and assigns only the top window per daypart', () => {
    const ranked = [
      window('2026-09-09T14:00:00.000Z', '2026-09-09T17:00:00.000Z', '2026-09-09T15:00:00.000Z'),
      window('2026-09-09T15:00:00.000Z', '2026-09-09T18:00:00.000Z', '2026-09-09T16:00:00.000Z'),
      window('2026-09-09T18:00:00.000Z', '2026-09-09T21:00:00.000Z', '2026-09-09T19:00:00.000Z'),
    ];
    const selectWindows = jest.fn(() => ranked);

    const result = selectBeachDayWindows({
      beach,
      forecasts: [...requestedDayRows, otherDayRow],
      userPrefs: null,
      localDate: '2026-09-09',
      selectWindows: selectWindows as unknown as typeof selectBestWindows,
    });

    expect(selectWindows).toHaveBeenCalledTimes(1);
    expect(selectWindows).toHaveBeenCalledWith(expect.objectContaining({
      beach,
      forecasts: requestedDayRows,
      maxWindows: WINDOW_AUTHORITY_MAX_WINDOWS,
    }));
    expect(result.bestDayWindow).toBe(result.dayparts.morning);
    expect(result.dayparts.morning).toMatchObject({
      ...ranked[0],
      displayWindowStart: new Date('2026-09-09T14:00:00.000Z'),
      displayWindowEnd: new Date('2026-09-09T16:30:00.000Z'),
    });
    expect(result.dayparts.midday).toMatchObject({
      ...ranked[2],
      displayWindowStart: new Date('2026-09-09T18:00:00.000Z'),
      displayWindowEnd: new Date('2026-09-09T20:30:00.000Z'),
    });
    expect(result.dayparts.evening).toBeNull();
  });

  it('does not call the selector when the local day has no rows', () => {
    const selectWindows = jest.fn(() => []);

    const result = selectBeachDayWindows({
      beach,
      forecasts: [otherDayRow],
      userPrefs: null,
      localDate: '2026-09-09',
      selectWindows: selectWindows as unknown as typeof selectBestWindows,
    });

    expect(selectWindows).not.toHaveBeenCalled();
    expect(result).toEqual({
      bestDayWindow: null,
      dayparts: { morning: null, midday: null, evening: null },
    });
  });
});
