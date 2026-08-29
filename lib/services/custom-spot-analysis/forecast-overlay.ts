import { formatDisplayHeightFt, parseDisplayHeightFt } from '@/lib/services/forecast/apply-beach-height-offset';
import { transformToFaceHeightDecomposed, type SwellComponentInput } from '@/lib/utils/wave-height-transformer';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { useTerrainFactors as shouldUseTerrainFactors } from '@/types/terrain';

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function component(
  height: string | null | undefined,
  period: string | null | undefined,
  direction: string | null | undefined,
  partition: 'swell' | 'wind_wave'
): SwellComponentInput | null {
  const heightFt = parseNumber(height);
  const periodS = parseNumber(period);
  if (heightFt == null || periodS == null) return null;
  return { heightFt, periodS, directionDeg: parseNumber(direction), partition };
}

export function applyCustomSpotForecastGeometry(
  forecast: EnhancedForecastEntity,
  customBeach: Beach
): EnhancedForecastEntity {
  if (
    !shouldUseTerrainFactors({
      terrain_enabled: customBeach.terrain_enabled,
      swell_access_factors: customBeach.swell_access_factors,
      wind_exposure_factors: customBeach.wind_exposure_factors,
    })
    || customBeach.terrain_status !== 'ok'
  ) {
    return forecast;
  }

  const parsedHeight = parseDisplayHeightFt(forecast.wave_height);
  if (parsedHeight.numericFt == null) return forecast;
  const components = [
    component(forecast.swell_1_height, forecast.swell_1_period, forecast.swell_1_direction, 'swell'),
    component(forecast.swell_2_height, forecast.swell_2_period, forecast.swell_2_direction, 'swell'),
    component(
      forecast.wind_wave_height,
      forecast.wind_wave_period,
      forecast.wind_wave_direction,
      'wind_wave'
    ),
  ];
  if (components.every((value) => value === null)) return forecast;

  const transformed = transformToFaceHeightDecomposed({
    components,
    beach: {
      swell_access_factors: customBeach.swell_access_factors,
      terrain_enabled: true,
      swell_window_center_deg: customBeach.swell_window_center_deg,
      swell_window_halfwidth_deg: customBeach.swell_window_halfwidth_deg,
      shoaling_factors: null,
      deepwater_decay_factor: null,
    },
    source: 'model_swell',
    rawHeightFt: parsedHeight.numericFt,
    periodS: parseNumber(forecast.wave_period),
    swellDirectionDeg: parseNumber(forecast.wave_direction),
  });
  if (transformed.path === 'legacy') return forecast;

  return {
    ...forecast,
    wave_height: formatDisplayHeightFt({
      numericFt: transformed.faceHeightFt,
      rangeSpread: parsedHeight.rangeSpread,
    }),
    isCalibrated: false,
    is_ml_calibrated: false,
    ml_corrected_height: null,
  };
}
