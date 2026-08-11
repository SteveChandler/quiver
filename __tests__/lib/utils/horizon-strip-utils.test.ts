/**
 * Tests for Horizon Strip utility functions
 */

// Mock date-fns submodule paths for ESM compat
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

import {
  getConditionTier,
  formatWaveRange,
  getTierLabel,
  aggregateDayForecasts,
  TIER_COLORS,
  type ConditionTier,
} from '@/lib/utils/horizon-strip-utils';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

describe('horizon-strip-utils', () => {
  describe('getConditionTier', () => {
    it('returns "epic" for scores >= 80', () => {
      expect(getConditionTier(80)).toBe('epic');
      expect(getConditionTier(90)).toBe('epic');
      expect(getConditionTier(100)).toBe('epic');
    });

    it('returns "good" for scores 70-79', () => {
      expect(getConditionTier(70)).toBe('good');
      expect(getConditionTier(79)).toBe('good');
    });

    it('returns "fair" for scores 55-69', () => {
      expect(getConditionTier(55)).toBe('fair');
      expect(getConditionTier(60)).toBe('fair');
      expect(getConditionTier(69)).toBe('fair');
    });

    it('returns "rideable" for scores 40-54', () => {
      expect(getConditionTier(40)).toBe('rideable');
      expect(getConditionTier(50)).toBe('rideable');
      expect(getConditionTier(54)).toBe('rideable');
    });

    it('returns "meh" for scores < 40', () => {
      expect(getConditionTier(0)).toBe('meh');
      expect(getConditionTier(20)).toBe('meh');
      expect(getConditionTier(39)).toBe('meh');
    });

    it('handles edge cases', () => {
      expect(getConditionTier(-10)).toBe('meh');
      expect(getConditionTier(150)).toBe('epic');
    });
  });

  describe('formatWaveRange', () => {
    it('formats range correctly when min and max differ', () => {
      expect(formatWaveRange(2, 4)).toBe('2-4ft');
      expect(formatWaveRange(1.2, 3.8)).toBe('1-4ft');
    });

    it('formats single value when min equals max', () => {
      expect(formatWaveRange(3, 3)).toBe('3ft');
      expect(formatWaveRange(2.4, 2.6)).toBe('2-3ft'); // Rounds differently
    });

    it('returns "Flat" when both are zero', () => {
      expect(formatWaveRange(0, 0)).toBe('Flat');
    });

    it('returns "Flat" when both are negative', () => {
      expect(formatWaveRange(-1, -1)).toBe('Flat');
    });

    it('shows range for values that straddle an integer', () => {
      // 5.7 → floor=5, 6.2 → ceil=7 → "5-7ft"
      expect(formatWaveRange(5.7, 6.2)).toBe('5-7ft');
    });

    it('shows single value for exact integers', () => {
      expect(formatWaveRange(6.0, 6.0)).toBe('6ft');
    });

    it('shows range when min and max are different integers', () => {
      expect(formatWaveRange(3.0, 5.0)).toBe('3-5ft');
    });

    it('characterizes the two-number arity used by horizon cards', () => {
      expect(formatWaveRange(1.01, 1.99)).toBe('1-2ft');
      expect(formatWaveRange(-1, 0.5)).toBe('0-1ft');
    });
  });

  describe('getTierLabel', () => {
    it('returns correct labels for each tier', () => {
      expect(getTierLabel('epic')).toBe('EPIC conditions');
      expect(getTierLabel('good')).toBe('GOOD conditions');
      expect(getTierLabel('fair')).toBe('FAIR conditions');
      expect(getTierLabel('rideable')).toBe('RIDEABLE conditions');
      expect(getTierLabel('meh')).toBe('MEH conditions');
    });
  });

  describe('TIER_COLORS', () => {
    const tiers: ConditionTier[] = ['epic', 'good', 'fair', 'rideable', 'meh'];

    it('has all required color properties for each tier', () => {
      for (const tier of tiers) {
        expect(TIER_COLORS[tier]).toHaveProperty('bg');
        expect(TIER_COLORS[tier]).toHaveProperty('border');
        expect(TIER_COLORS[tier]).toHaveProperty('text');
        expect(TIER_COLORS[tier]).toHaveProperty('badge');
      }
    });

    it('uses Tailwind class format', () => {
      for (const tier of tiers) {
        expect(TIER_COLORS[tier].bg).toMatch(/^bg-/);
        expect(TIER_COLORS[tier].border).toMatch(/^border-/);
        expect(TIER_COLORS[tier].text).toMatch(/^text-/);
      }
    });

    it('uses appropriate semantic colors for each tier', () => {
      // Epic should be amber/gold
      expect(TIER_COLORS.epic.bg).toContain('amber');

      // Good should be green/emerald
      expect(TIER_COLORS.good.bg).toContain('emerald');

      // Fair should be blue
      expect(TIER_COLORS.fair.bg).toContain('blue');

      // Rideable should use brand navy
      expect(TIER_COLORS.rideable.bg).toContain('2D357D');
    });
  });

  describe('aggregateDayForecasts', () => {
    // Helper to create a minimal forecast entity
    function makeForecast(
      date: string,
      time: string,
      dataSource: 'NOAA_NWS' | 'FALLBACK',
      waveHeight = '2.0',
    ): EnhancedForecastEntity {
      return {
        id: `${date}-${time}`,
        beach_id: 'test-beach',
        forecast_at: `${date}T${time}Z`,
        forecast_date: date,
        forecast_time: time,
        wave_height: waveHeight,
        wave_period: '10s',
        wave_direction: 'W',
        wind_speed: '5 mph',
        wind_direction: 'NW',
        data_source: dataSource,
        swell_1_height: null,
        swell_1_period: null,
        swell_1_direction: null,
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
        tide_height: null,
        tide_status: null,
        next_tide_type: null,
        next_tide_time: null,
        next_tide_height: null,
        next_tide_at: null,
        water_temp: null,
        air_temp: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as EnhancedForecastEntity;
    }

    const mockBeach = {
      id: 'test-beach',
      name: 'Test Beach',
      lat: 21.0,
      lon: -157.0,
      timezone: 'UTC',
      wind_offshore_deg: 0,
      wind_offshore_tol_deg: 45,
      wind_onshore_bad_kt: null,
      preferred_tide_ft_min: null,
      preferred_tide_ft_max: null,
    } as unknown as Beach;

    it('labels the Hawaii-local forecast date as today after UTC rolls over', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-26T03:00:00Z'));

      try {
        const hawaiiBeach = {
          ...mockBeach,
          name: 'Ala Moana Bowls',
          timezone: 'Pacific/Honolulu',
        };
        const result = aggregateDayForecasts(
          [makeForecast('2026-07-26', '03:00', 'NOAA_NWS', '5.1')],
          hawaiiBeach
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          fullDate: '2026-07-25',
          date: 'Jul 25',
          dayName: 'Today',
          isToday: true,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('trims trailing days with all-null wave_height', () => {
      const today = new Date();
      const dates = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const forecasts = [
        // Days 0-2: real data
        makeForecast(dates[0], '06:00', 'NOAA_NWS'),
        makeForecast(dates[0], '12:00', 'NOAA_NWS'),
        makeForecast(dates[1], '06:00', 'NOAA_NWS'),
        makeForecast(dates[1], '12:00', 'NOAA_NWS'),
        makeForecast(dates[2], '06:00', 'NOAA_NWS'),
        makeForecast(dates[2], '12:00', 'NOAA_NWS'),
        // Days 3-4: null wave_height (truly missing data)
        makeForecast(dates[3], '06:00', 'FALLBACK', null as unknown as string),
        makeForecast(dates[3], '12:00', 'FALLBACK', null as unknown as string),
        makeForecast(dates[4], '06:00', 'FALLBACK', null as unknown as string),
        makeForecast(dates[4], '12:00', 'FALLBACK', null as unknown as string),
      ];

      const result = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 12 });

      // Should only have 3 days (the real data), not 5
      expect(result.length).toBe(3);
      expect(result.map((d) => d.fullDate)).toEqual([dates[0], dates[1], dates[2]]);
    });

    it('keeps trailing FALLBACK days that have wave values (gap-filled slots)', () => {
      const today = new Date();
      const dates = Array.from({ length: 4 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const forecasts = [
        makeForecast(dates[0], '06:00', 'NOAA_NWS'),
        makeForecast(dates[0], '12:00', 'NOAA_NWS'),
        makeForecast(dates[1], '06:00', 'NOAA_NWS'),
        makeForecast(dates[1], '12:00', 'NOAA_NWS'),
        // Days 2-3: FALLBACK but with wave values (gap-filled)
        makeForecast(dates[2], '06:00', 'FALLBACK', '1.5'),
        makeForecast(dates[2], '12:00', 'FALLBACK', '1.8'),
        makeForecast(dates[3], '06:00', 'FALLBACK', '1.2'),
        makeForecast(dates[3], '12:00', 'FALLBACK', '1.4'),
      ];

      const result = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 12 });

      // All 4 days should be kept (FALLBACK with values not trimmed)
      expect(result.length).toBe(4);
    });

    it('keeps days with mixed real and fallback forecasts', () => {
      const today = new Date();
      const dates = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const forecasts = [
        makeForecast(dates[0], '06:00', 'NOAA_NWS'),
        makeForecast(dates[1], '06:00', 'NOAA_NWS'),
        // Day 2 has a mix of real and fallback — should NOT be trimmed
        makeForecast(dates[2], '06:00', 'NOAA_NWS'),
        makeForecast(dates[2], '12:00', 'FALLBACK'),
      ];

      const result = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 12 });

      expect(result.length).toBe(3);
    });

    it('uses the daylight slot for a future Pacific day', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-26T12:00:00Z'));

      try {
        const pacificBeach = {
          ...mockBeach,
          timezone: 'America/Los_Angeles',
        };
        const night = makeForecast(
          '2026-07-29',
          '09:00',
          'NOAA_NWS',
          '4.5',
        );
        Object.assign(night, {
          wave_period: '14s',
          swell_1_period: '14s',
          wind_speed: '1 mph',
          tide_height: '3',
          tide_status: 'rising',
        });
        const afternoon = makeForecast(
          '2026-07-29',
          '21:00',
          'NOAA_NWS',
          '3.5',
        );
        Object.assign(afternoon, {
          wave_period: '10s',
          swell_1_period: '10s',
          wind_speed: '8 mph',
          tide_height: '3',
          tide_status: 'rising',
        });

        const result = aggregateDayForecasts(
          [night, afternoon],
          pacificBeach,
        );

        expect(result).toHaveLength(1);
        expect(result[0].bestTime).toBe('21:00');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
