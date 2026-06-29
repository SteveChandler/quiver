import { computeWindowDistinctionReason } from '@/lib/services/discovery/window-distinction';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const beach = {
  id: 'beach-1',
  name: 'Test Beach',
  slug: 'test-beach',
  lat: 32.7157,
  lon: -117.1611,
  city: 'San Diego',
  state: 'CA',
  country: 'USA',
  is_private: false,
  skill_level: 'intermediate',
  break_type: 'beach',
  swell_window_min_deg: 240,
  swell_window_max_deg: 300,
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 30,
  wind_onshore_bad_kt: null,
  wind_cross_shore_ok_kt: null,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: 'rising',
} as Beach;

function forecastAt(hourUtc: number): string {
  return `2024-01-15T${String(hourUtc).padStart(2, '0')}:00:00Z`;
}

function createForecast(
  id: string,
  forecast_at: string,
  overrides: Partial<EnhancedForecastEntity> = {},
): EnhancedForecastEntity {
  return {
    id,
    beach_id: 'beach-1',
    forecast_at,
    forecast_date: forecast_at.slice(0, 10),
    forecast_time: forecast_at.slice(11, 19),
    wave_height: '3',
    wave_period: '13s',
    wave_direction: '270',
    swell_1_height: '3',
    swell_1_period: '13s',
    swell_1_direction: '270',
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    water_temp: '62',
    wind_speed: '5',
    wind_direction: 'NE',
    wind_direction_deg: 45,
    tide_height: '3',
    tide_status: 'Rising',
    confidence_score: 90,
    data_source: 'NOAA_NWS',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('computeWindowDistinctionReason', () => {
  const timezone = 'America/Los_Angeles';

  it('returns null when there are fewer than two local-day windows', () => {
    const selected = createForecast('selected', forecastAt(17));

    expect(
      computeWindowDistinctionReason(selected, [selected], beach, timezone)
    ).toBeNull();
  });

  it('describes a uniform day when every axis stays within the uniform band', () => {
    const selected = createForecast('selected', forecastAt(17));
    const windows = [
      createForecast('early', forecastAt(14)),
      selected,
      createForecast('late', forecastAt(20)),
    ];

    expect(
      computeWindowDistinctionReason(selected, windows, beach, timezone)
    ).toBe('Conditions hold steady all day');
  });

  it('identifies one window that clearly leads on tide only', () => {
    const selected = createForecast('selected', forecastAt(17), {
      tide_height: '3',
    });
    const windows = [
      createForecast('early', forecastAt(14), { tide_height: '7' }),
      selected,
      createForecast('late', forecastAt(20), { tide_height: '0' }),
    ];

    expect(
      computeWindowDistinctionReason(selected, windows, beach, timezone)
    ).toBe('Best tide of the day');
  });

  it('identifies one window that clearly leads on wind only', () => {
    const selected = createForecast('selected', forecastAt(17), {
      wind_speed: '2',
      wind_direction: 'W',
      wind_direction_deg: 270,
    });
    const windows = [
      createForecast('early', forecastAt(14), {
        wind_speed: '14',
        wind_direction: 'W',
        wind_direction_deg: 270,
      }),
      selected,
      createForecast('late', forecastAt(20), {
        wind_speed: '14',
        wind_direction: 'W',
        wind_direction_deg: 270,
      }),
    ];

    expect(
      computeWindowDistinctionReason(selected, windows, beach, timezone)
    ).toBe('Cleanest wind of the day');
  });

  it('does not claim the selected window is best when a later window is better', () => {
    const selected = createForecast('selected', forecastAt(17), {
      tide_height: '7',
      wind_speed: '12',
      wind_direction: 'W',
      wind_direction_deg: 270,
    });
    const windows = [
      createForecast('early', forecastAt(14), {
        tide_height: '6.8',
        wind_speed: '12',
        wind_direction: 'W',
        wind_direction_deg: 270,
      }),
      selected,
      createForecast('late', forecastAt(20), {
        tide_height: '3',
        wind_speed: '2',
        wind_direction: 'W',
        wind_direction_deg: 270,
      }),
    ];

    expect(
      computeWindowDistinctionReason(selected, windows, beach, timezone)
    ).toBeNull();
  });

  it('uses the overall-score fallback when no single axis explains the lead', () => {
    const selected = createForecast('selected', forecastAt(17), {
      wave_height: '4',
      wave_period: '13s',
      swell_1_height: '4',
      swell_1_period: '13s',
      wind_speed: '2',
      wind_direction: 'W',
      wind_direction_deg: 270,
      tide_height: '3',
    });
    const windows = [
      createForecast('early', forecastAt(14), {
        wave_height: '2',
        wave_period: '10s',
        swell_1_height: '2',
        swell_1_period: '10s',
        wind_speed: '12',
        wind_direction: 'W',
        wind_direction_deg: 270,
        tide_height: '6',
      }),
      selected,
      createForecast('late', forecastAt(20), {
        wave_height: '2.2',
        wave_period: '10s',
        swell_1_height: '2.2',
        swell_1_period: '10s',
        wind_speed: '12',
        wind_direction: 'W',
        wind_direction_deg: 270,
        tide_height: '5.8',
      }),
    ];

    expect(
      computeWindowDistinctionReason(selected, windows, beach, timezone)
    ).toBe('Best window of the day');
  });
});
