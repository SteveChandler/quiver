/**
 * Forecast Validation
 *
 * Validates forecast values against realistic San Diego area conditions.
 * Flags unrealistic values that may indicate sensor/model errors.
 */

import type { EnhancedForecastEntity } from "@/types/forecast";

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
}

/**
 * Validate forecast values for San Diego area
 * Flags conditions outside typical ranges
 */
export function validateForecastValues(
  forecast: EnhancedForecastEntity,
  beachName?: string
): ValidationResult {
  const waveHeight = parseFloat(forecast.wave_height || "0");
  const wavePeriod = parseFloat(
    forecast.wave_period?.replace("s", "") || "0"
  );
  const swell1Period = parseFloat(
    forecast.swell_1_period?.replace("s", "") || "0"
  );

  let isValid = true;
  const warnings: string[] = [];

  // San Diego typical conditions validation
  if (waveHeight > 8) {
    warnings.push(
      `Unusually large waves: ${forecast.wave_height} (typical max: 8ft)`
    );
    isValid = false;
  }

  if (waveHeight > 0 && waveHeight < 0.5) {
    warnings.push(
      `Unusually small waves: ${forecast.wave_height} (typical min: 1ft)`
    );
  }

  if (wavePeriod > 0 && wavePeriod < 6) {
    warnings.push(
      `Very short wave period: ${forecast.wave_period} (Pacific swells typically 10-18s)`
    );
  }

  if (swell1Period > 0 && swell1Period < 8) {
    warnings.push(
      `Short swell period: ${forecast.swell_1_period} (Pacific swells typically 12-18s)`
    );
  }

  return { isValid, warnings };
}
