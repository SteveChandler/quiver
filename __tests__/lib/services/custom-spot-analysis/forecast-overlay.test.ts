import { applyCustomSpotForecastGeometry } from '@/lib/services/custom-spot-analysis/forecast-overlay';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const forecast = {
  id: 'forecast', beach_id: 'nearest', forecast_at: '2026-08-28T12:00:00Z',
  forecast_date: '2026-08-28', forecast_time: '12:00:00', wave_height: '4ft',
  wave_period: '14s', wave_direction: '270', swell_1_height: '4ft',
  swell_1_period: '14s', swell_1_direction: '270', water_temp: null,
  confidence_score: 80, data_source: 'OPEN_METEO', created_at: '', updated_at: '',
} as EnhancedForecastEntity;

function beach(access: number): Beach {
  const factors = Array(72).fill(1);
  factors[54] = access;
  return {
    id: 'nearest', name: 'Custom', terrain_enabled: true, terrain_status: 'ok',
    swell_access_factors: factors, wind_exposure_factors: Array(72).fill(1),
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 45,
  } as Beach;
}

describe('custom spot forecast geometry', () => {
  it('attenuates borrowed model swell with the custom coordinate access array', () => {
    const open = applyCustomSpotForecastGeometry(forecast, beach(1));
    const blocked = applyCustomSpotForecastGeometry(forecast, beach(0.25));

    expect(Number.parseFloat(blocked.wave_height ?? '')).toBeLessThan(
      Number.parseFloat(open.wave_height ?? '')
    );
    expect(blocked.isCalibrated).toBe(false);
  });

  it('keeps the nearest-anchor forecast unchanged while analysis is unavailable', () => {
    const pending = { ...beach(0.25), terrain_status: 'queued' } as Beach;
    expect(applyCustomSpotForecastGeometry(forecast, pending)).toBe(forecast);
  });

  it('keeps the forecast unchanged when the global terrain kill switch is off', () => {
    const previous = process.env.TERRAIN_SCORING_ENABLED;
    process.env.TERRAIN_SCORING_ENABLED = 'false';
    try {
      expect(applyCustomSpotForecastGeometry(forecast, beach(0.25))).toBe(forecast);
    } finally {
      if (previous === undefined) delete process.env.TERRAIN_SCORING_ENABLED;
      else process.env.TERRAIN_SCORING_ENABLED = previous;
    }
  });
});
