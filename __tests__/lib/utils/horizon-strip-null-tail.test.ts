// Mock date-fns submodule paths for ESM compat (before any imports)
jest.mock('date-fns/format', () => {
  return (date: Date, pattern: string) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (pattern === 'yyyy-MM-dd') {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    if (pattern === 'MMM d') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    }
    return date.toISOString();
  };
});
jest.mock('date-fns/parseISO', () => {
  return (str: string) => new Date(str + 'T00:00:00');
});
jest.mock('date-fns/isToday', () => {
  return (date: Date) => {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  };
});
jest.mock('date-fns/startOfDay', () => {
  return (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };
});
jest.mock('date-fns-tz', () => ({
  formatInTimeZone: (_date: Date, _tz: string, pattern: string) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (pattern === 'MMM d') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[_date.getMonth()]} ${_date.getDate()}`;
    }
    if (pattern === 'EEE') {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return days[_date.getDay()];
    }
    return _date.toISOString();
  },
  toZonedTime: (date: Date, _tz: string) => new Date(date),
}));

// Mock the scorer to avoid complex setup
jest.mock('@/lib/scoring/surf-conditions-scorer', () => ({
  scoreConditions: () => ({ total: 50 }),
}));

import { aggregateDayForecasts } from '@/lib/utils/horizon-strip-utils';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

function makeForecasts(
  dateStr: string,
  count: number,
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${dateStr}-${i}`,
    beach_id: 'test-beach',
    forecast_at: `${dateStr}T${String(i * 3).padStart(2, '0')}:00:00Z`,
    forecast_date: dateStr,
    forecast_time: `${String(i * 3).padStart(2, '0')}:00`,
    wave_height: '3.5',
    wave_period: '12s',
    wave_direction: 'W',
    wind_speed: '5 mph',
    wind_direction: 'NW',
    data_source: 'NOAA_NWS',
    ...overrides,
  } as unknown as EnhancedForecastEntity));
}

const mockBeach = {
  id: 'test-beach',
  name: 'Test Beach',
  lat: 32.87,
  lon: -117.25,
  center_lat: 32.87,
  center_lng: -117.25,
  timezone: 'America/Los_Angeles',
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
  wind_onshore_bad_kt: null,
} as unknown as Beach;

describe('horizon-strip: trailing null-wave trimming', () => {
  it('trims trailing days with ALL null wave_height', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

    const forecasts = [
      ...makeForecasts(today, 8),
      ...makeForecasts(tomorrow, 8),
      // Day 3: all null wave_height
      ...makeForecasts(dayAfter, 8, { wave_height: null as unknown as string }),
    ];

    const result = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 5 });
    // Should have 2 days (day 3 trimmed due to null waves)
    expect(result.length).toBe(2);
    expect(result.map((d) => d.fullDate)).not.toContain(dayAfter);
  });

  it('does NOT trim FALLBACK days with non-null wave values', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const forecasts = [
      ...makeForecasts(today, 8),
      // Tomorrow: FALLBACK source BUT has wave values
      ...makeForecasts(tomorrow, 8, { data_source: 'FALLBACK' }),
    ];

    const result = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 5 });
    // Should have 2 days (FALLBACK day NOT trimmed because it has wave values)
    expect(result.length).toBe(2);
    expect(result.map((d) => d.fullDate)).toContain(tomorrow);
  });

  it('trims trailing days with empty string wave_height', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const forecasts = [
      ...makeForecasts(today, 8),
      ...makeForecasts(tomorrow, 8, { wave_height: '' }),
    ];

    const result = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 5 });
    expect(result.length).toBe(1);
  });
});
