import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { selectBestWindow, selectBestWindows } from '@/lib/services/discovery/window-selector/window-selector-core';
import { hasUsableTodayForecastForFallback } from '@/lib/services/discovery/surf-discovery-orchestrator';
import * as windowRefiner from '@/lib/services/discovery/window-selector/window-refiner';
import * as windowScorer from '@/lib/services/discovery/window-selector/window-scorer';

jest.mock('@/lib/services/discovery/window-selector/window-refiner', () => {
  const actual = jest.requireActual('@/lib/services/discovery/window-selector/window-refiner');
  return { ...actual, applySubHourRefinement: jest.fn(actual.applySubHourRefinement) };
});

jest.mock('@/lib/services/discovery/window-selector/window-scorer', () => {
  const actual = jest.requireActual('@/lib/services/discovery/window-selector/window-scorer');
  return { ...actual, scoreWindowForSelection: jest.fn(actual.scoreWindowForSelection) };
});

const beach = {
  id: 'liveness-beach',
  name: 'Liveness Beach',
  lat: 36.96,
  lon: -122.02,
  timezone: 'America/Los_Angeles',
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
} as Beach;

function localTime(time: string): Date {
  return new Date(`2026-10-16T${time}:00-07:00`);
}

function forecastAt(time: string): EnhancedForecastEntity {
  return {
    id: `forecast-${time}`,
    beach_id: beach.id,
    forecast_at: localTime(time).toISOString(),
    wave_height: '3',
    wave_period: '13s',
    wind_speed: '3',
    wind_direction: 'E',
    wind_direction_deg: 90,
    confidence_score: 85,
    data_source: 'NOAA_NWS',
  } as EnhancedForecastEntity;
}

function morningWindow(times: string[], now: string): ReturnType<typeof selectBestWindow> {
  return selectBestWindow({
    forecasts: times.map(forecastAt),
    beach,
    userPrefs: null,
    timeSlot: 'dawn-patrol',
    now: localTime(now),
  });
}

describe('window selector forecast row liveness', () => {
  it('checks the final end after refinement moves an otherwise open window into the past', () => {
    const refinement = jest.mocked(windowRefiner.applySubHourRefinement).mockClear().mockReturnValue({
      start: localTime('17:00'),
      end: localTime('18:00'),
    });

    try {
      expect(selectBestWindow({
        forecasts: ['11:00', '14:00', '17:00'].map(forecastAt),
        beach,
        userPrefs: null,
        now: localTime('18:30'),
        sunTimesCache: new Map([[beach.id, {
          sunrises: [localTime('06:30')],
          sunsets: [localTime('20:00')],
        }]]),
      })).toBeNull();
      expect(refinement).toHaveBeenCalledTimes(1);
    } finally {
      refinement.mockImplementation(jest.requireActual('@/lib/services/discovery/window-selector/window-refiner').applySubHourRefinement);
    }
  });

  it('excludes an expired below-threshold fallback before refinement', () => {
    const score = jest.mocked(windowScorer.scoreWindowForSelection).mockReturnValue(10);
    const refinement = jest.mocked(windowRefiner.applySubHourRefinement).mockClear();

    try {
      expect(selectBestWindow({
        forecasts: ['14:00', '17:00', '20:00'].map(forecastAt),
        beach,
        userPrefs: null,
        now: localTime('19:05'),
        sunTimesCache: new Map([[beach.id, {
          sunrises: [localTime('06:30')],
          sunsets: [localTime('18:30')],
        }]]),
      })).toBeNull();
      expect(refinement).not.toHaveBeenCalled();
    } finally {
      score.mockImplementation(jest.requireActual('@/lib/services/discovery/window-selector/window-scorer').scoreWindowForSelection);
    }
  });

  it('returns tomorrow when equal below-threshold rows today expired at last light at 19:10', () => {
    const now = localTime('19:10');
    const tomorrowTime = (time: string): Date => new Date(`2026-10-17T${time}:00-07:00`);
    const todayForecasts = ['11:00', '14:00', '17:00'].map(forecastAt);
    const tomorrowForecasts = ['08:00', '11:00'].map((time) => ({
      ...forecastAt(time),
      forecast_at: tomorrowTime(time).toISOString(),
    }));
    const sunTimes = {
      sunrises: [localTime('06:30'), tomorrowTime('06:30')],
      sunsets: [localTime('18:30'), tomorrowTime('18:30')],
    };
    const score = jest.mocked(windowScorer.scoreWindowForSelection).mockReturnValue(10);

    try {
      const windows = selectBestWindows({
        forecasts: [...todayForecasts, ...tomorrowForecasts],
        beach,
        userPrefs: null,
        now,
        sunTimesCache: new Map([[beach.id, sunTimes]]),
      });

      expect(windows).toHaveLength(1);
      expect(windows[0].start).toEqual(tomorrowTime('08:00'));
      expect(windows[0].sourceForecast).toEqual(tomorrowForecasts[0]);
      expect(hasUsableTodayForecastForFallback({
        forecasts: todayForecasts,
        beachTz: beach.timezone!,
        sunTimes,
        now,
      })).toBe(false);
    } finally {
      score.mockImplementation(jest.requireActual('@/lib/services/discovery/window-selector/window-scorer').scoreWindowForSelection);
    }
  });

  it.each(['19:05', '19:30', '20:10'])('rejects a window closed by last light at %s in both paths', (now) => {
    const forecasts = ['14:00', '17:00', '20:00'].map(forecastAt);
    const sunTimes = {
      sunrises: [localTime('06:30')],
      sunsets: [localTime('18:30')],
    };

    expect(selectBestWindow({
      forecasts,
      beach,
      userPrefs: null,
      now: localTime(now),
      sunTimesCache: new Map([[beach.id, sunTimes]]),
    })).toBeNull();
    expect(hasUsableTodayForecastForFallback({
      forecasts,
      beachTz: beach.timezone!,
      sunTimes,
      now: localTime(now),
    })).toBe(false);
  });

  it('keeps the 08:00 three-hourly row available for a morning window at 09:16', () => {
    const window = morningWindow(['05:00', '08:00', '11:00'], '09:16');

    expect(window).not.toBeNull();
    expect(window?.start).toEqual(localTime('08:00'));
    expect(window?.end).toEqual(localTime('11:00'));
    expect(window?.sourceForecast?.forecast_at).toBe(localTime('08:00').toISOString());
  });

  it('expires the 08:00 row after the 11:00 next row plus tolerance', () => {
    expect(morningWindow(['05:00', '08:00', '11:00'], '11:20')).toBeNull();
  });

  it('caps a five-hour gap at three hours plus tolerance in both liveness checks', () => {
    const times = ['03:00', '08:00', '13:00'];
    const args = {
      forecasts: times.map(forecastAt),
      beachTz: beach.timezone!,
      sunTimes: {
        sunrises: [localTime('06:00')],
        sunsets: [localTime('12:00')],
      },
    };

    expect(morningWindow(times, '11:14')?.start).toEqual(localTime('08:00'));
    expect(morningWindow(times, '11:16')).toBeNull();
    expect(hasUsableTodayForecastForFallback({ ...args, now: localTime('11:15') })).toBe(true);
    expect(hasUsableTodayForecastForFallback({ ...args, now: localTime('11:16') })).toBe(false);
  });

  it.each(['08:46', '09:15'])('keeps an hourly row through the next hour plus tolerance at %s', (now) => {
    expect(morningWindow(['07:00', '08:00', '09:00'], now)?.start).toEqual(localTime('08:00'));
  });

  it('expires an hourly row after its next hour plus tolerance', () => {
    expect(morningWindow(['07:00', '08:00', '09:00'], '09:16')?.start).toEqual(localTime('09:00'));
  });

  it.each([
    ['three-hourly', ['02:00', '05:00', '08:00'], '10:00', '11:16'],
    ['hourly', ['06:00', '07:00', '08:00'], '09:00', '09:16'],
    ['averaged median', ['05:00', '06:00', '08:00'], '09:40', '09:46'],
    ['median spacing with an outlier and duplicate', ['01:00', '06:00', '07:00', '07:00', '08:00'], '09:00', '09:16'],
    ['30-minute floor', ['07:40', '07:50', '08:00'], '08:40', '08:46'],
    ['three-hour cap', ['00:00', '04:00', '08:00'], '11:00', '11:16'],
    ['single-row default', ['08:00'], '08:40', '08:46'],
  ])('uses %s spacing for the final row in unsorted input', (_label, times, live, expired) => {
    expect(morningWindow([...times].reverse(), live)?.start).toEqual(localTime('08:00'));
    expect(morningWindow([...times].reverse(), expired)).toBeNull();
  });
});

describe('discovery fallback forecast row liveness', () => {
  it.each([
    ['three-hourly', ['05:00', '08:00'], '09:16', '11:20'],
    ['hourly', ['07:00', '08:00'], '09:15', '09:16'],
    ['averaged median', ['05:00', '06:00', '08:00'], '09:45', '09:46'],
    ['median spacing with an outlier and duplicate', ['01:00', '06:00', '07:00', '07:00', '08:00'], '09:15', '09:16'],
    ['30-minute floor', ['07:40', '07:50', '08:00'], '08:45', '08:46'],
    ['three-hour cap', ['00:00', '04:00', '08:00'], '11:15', '11:16'],
    ['single-row default', ['08:00'], '08:45', '08:46'],
  ])('uses %s spacing and tolerance for the final row', (_label, times, live, expired) => {
    const args = {
      forecasts: [...times].reverse().map(forecastAt),
      beachTz: beach.timezone!,
    };

    expect(hasUsableTodayForecastForFallback({ ...args, now: localTime(live) })).toBe(true);
    expect(hasUsableTodayForecastForFallback({ ...args, now: localTime(expired) })).toBe(false);
  });

  it('uses the next row to expire a daylight row even when the next row is after last light', () => {
    const args = {
      forecasts: ['05:00', '08:00', '11:00'].map(forecastAt),
      beachTz: beach.timezone!,
      sunTimes: {
        sunrises: [localTime('06:00')],
        sunsets: [localTime('10:30')],
      },
    };

    expect(hasUsableTodayForecastForFallback({ ...args, now: localTime('09:16') })).toBe(true);
    expect(hasUsableTodayForecastForFallback({ ...args, now: localTime('11:20') })).toBe(false);
  });
});
