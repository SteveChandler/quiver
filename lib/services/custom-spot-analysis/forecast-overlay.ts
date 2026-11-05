import { cardinalToDegrees } from '@/lib/services/forecast/forecast-transformer';
import { formatDisplayHeightFt, parseDisplayHeightFt } from '@/lib/services/forecast/apply-beach-height-offset';
import {
  transformToFaceHeightDecomposed,
  type SwellComponentInput,
} from '@/lib/utils/wave-height-transformer';
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
  return { heightFt, periodS, directionDeg: cardinalToDegrees(direction), partition };
}

// Bounds the terrain adjustment so a modeling outlier cannot swing a forecast
// further than terrain alone plausibly would.
const MIN_TERRAIN_RATIO = 0.5;
const MAX_TERRAIN_RATIO = 1.5;

/** Ratios this close to 1 are noise; the anchor's forecast passes through untouched. */
const NEUTRAL_RATIO_BAND = 0.03;

function terrainEnabled(beach: Beach): boolean {
  return shouldUseTerrainFactors({
    terrain_enabled: beach.terrain_enabled,
    swell_access_factors: beach.swell_access_factors,
    wind_exposure_factors: beach.wind_exposure_factors,
  });
}

/**
 * How much more or less of this forecast's swell reaches the custom spot than
 * the anchor beach. Both sides run the same components and source through the
 * transformer, so only swell access differs. Null when it cannot be computed,
 * including when the anchor beach has no terrain of its own.
 */
export function customSpotTerrainRatio(
  forecast: EnhancedForecastEntity,
  customBeach: Beach,
  anchorBeach: Beach
): number | null {
  if (!terrainEnabled(customBeach) || customBeach.terrain_status !== 'ok') return null;
  // Access-vs-access only: an anchor without terrain uses the cosine swell
  // window, which is not comparable and pins the ratio at its bounds.
  if (!terrainEnabled(anchorBeach)) return null;
  const rawHeightFt = parseDisplayHeightFt(forecast.wave_height).numericFt;
  if (rawHeightFt == null) return null;
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
  if (components.every((value) => value === null)) return null;

  const faceHeight = (
    beach: Beach,
    useTerrain: boolean
  ): ReturnType<typeof transformToFaceHeightDecomposed> =>
    transformToFaceHeightDecomposed({
      components,
      beach: {
        swell_access_factors: beach.swell_access_factors,
        terrain_enabled: useTerrain,
        swell_window_center_deg: beach.swell_window_center_deg,
        swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
        shoaling_factors: null,
        deepwater_decay_factor: null,
      },
      source: 'model_swell',
      rawHeightFt,
      periodS: parseNumber(forecast.wave_period),
      swellDirectionDeg: cardinalToDegrees(forecast.wave_direction),
    });
  const custom = faceHeight(customBeach, true);
  const anchor = faceHeight(anchorBeach, true);
  if (custom.path === 'legacy' || anchor.path === 'legacy' || !(anchor.faceHeightFt > 0)) {
    return null;
  }
  return Math.max(MIN_TERRAIN_RATIO, Math.min(MAX_TERRAIN_RATIO, custom.faceHeightFt / anchor.faceHeightFt));
}

/**
 * Scales the anchor beach's forecast height by the custom spot's terrain
 * ratio, keeping the anchor's calibration, offsets, provenance and display
 * format.
 */
export function applyCustomSpotForecastGeometry(
  forecast: EnhancedForecastEntity,
  customBeach: Beach,
  anchorBeach: Beach
): EnhancedForecastEntity {
  const ratio = customSpotTerrainRatio(forecast, customBeach, anchorBeach);
  if (ratio == null || Math.abs(ratio - 1) <= NEUTRAL_RATIO_BAND) return forecast;
  const parsed = parseDisplayHeightFt(forecast.wave_height);
  const scaledFt = Math.round((parsed.numericFt as number) * ratio * 10) / 10;
  return {
    ...forecast,
    wave_height: parsed.rangeSpread == null
      ? `${scaledFt.toFixed(1)} ft`
      : formatDisplayHeightFt({ numericFt: scaledFt, rangeSpread: parsed.rangeSpread }),
  };
}
