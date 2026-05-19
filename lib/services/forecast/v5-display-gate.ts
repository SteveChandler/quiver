import {
  computeV5Shadow,
  getActiveCalibration,
  type CalibrationVersion,
} from "./calibration-v5";
import {
  formatDisplayHeightFt,
  parseDisplayHeightFt,
} from "./apply-beach-height-offset";
import { cardinalToDegrees } from "./forecast-transformer";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import type { EnhancedForecastEntity } from "@/types/forecast";

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function primaryDirectionDeg(forecast: EnhancedForecastEntity): number | null {
  return (
    cardinalToDegrees(forecast.swell_1_direction) ??
    toFiniteNumber(forecast.wave_direction_om) ??
    toFiniteNumber(forecast.swell_direction_om) ??
    null
  );
}

function applyV51DisplayOverrideToForecast<T extends EnhancedForecastEntity>(
  forecast: T,
  calibration: CalibrationVersion
): T {
  const v5 = computeV5Shadow({
    wave_height_om_m: forecast.wave_height_om,
    primary_swell_direction_deg: primaryDirectionDeg(forecast),
    calibration,
  });

  if (!v5) return forecast;

  const parsedDisplay = parseDisplayHeightFt(forecast.wave_height);
  const waveHeight = formatDisplayHeightFt({
    numericFt: v5.v5_shadow_height_m * METERS_TO_FEET,
    rangeSpread: parsedDisplay.rangeSpread,
  });

  if (waveHeight === forecast.wave_height) return forecast;
  return { ...forecast, wave_height: waveHeight };
}

export async function applyV51DisplayOverrideToForecasts<
  T extends EnhancedForecastEntity,
>(
  forecasts: T[],
  options: {
    enabled?: boolean;
    calibration?: CalibrationVersion | null;
  } = {}
): Promise<T[]> {
  if (options.enabled === false || forecasts.length === 0) return forecasts;

  const calibration =
    options.calibration === undefined
      ? await getActiveCalibration()
      : options.calibration;

  if (!calibration) return forecasts;

  return forecasts.map((forecast) =>
    applyV51DisplayOverrideToForecast(forecast, calibration)
  );
}
