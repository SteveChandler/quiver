import type { AlertConditions, ForecastHour } from "./types";

export function scoreForecastHour(conditions: AlertConditions, forecast: ForecastHour): number {
  const scores: number[] = [];

  // Minimums: higher is better
  if (conditions.swell_height_min != null && forecast.wave_height != null) {
    scores.push((forecast.wave_height - conditions.swell_height_min) / Math.max(conditions.swell_height_min, 1));
  }
  if (conditions.swell_period_min != null) {
    const period = forecast.swell_1_period ?? forecast.wave_period;
    if (period != null) {
      scores.push((period - conditions.swell_period_min) / Math.max(conditions.swell_period_min, 1));
    }
  }

  // Maximums: lower is better
  if (conditions.wind_speed_max_kt != null && forecast.wind_speed != null) {
    scores.push((conditions.wind_speed_max_kt - forecast.wind_speed) / Math.max(conditions.wind_speed_max_kt, 1));
  }

  // Ranges: center is best
  if (conditions.tide_height_min_ft != null && conditions.tide_height_max_ft != null && forecast.tide_height != null) {
    const center = (conditions.tide_height_min_ft + conditions.tide_height_max_ft) / 2;
    const halfWidth = (conditions.tide_height_max_ft - conditions.tide_height_min_ft) / 2;
    if (halfWidth > 0) {
      scores.push(1 - Math.abs(forecast.tide_height - center) / halfWidth);
    }
  }

  if (conditions.swell_height_min != null && conditions.swell_height_max != null && forecast.wave_height != null) {
    const center = (conditions.swell_height_min + conditions.swell_height_max) / 2;
    const halfWidth = (conditions.swell_height_max - conditions.swell_height_min) / 2;
    if (halfWidth > 0) {
      scores.push(1 - Math.abs(forecast.wave_height - center) / halfWidth);
    }
  }

  // Binary: pass/fail scored as 1.0
  if (conditions.wind_direction != null) scores.push(1.0);
  if (conditions.tide_direction != null) scores.push(1.0);

  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}
