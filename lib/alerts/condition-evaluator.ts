import type { AlertConditions, BeachAlertMeta, ForecastHour } from "./types";
import { isWithinArc, resolveWindDirection } from "./degree-utils";

export function evaluateConditions(
  conditions: AlertConditions,
  forecast: ForecastHour,
  beach: BeachAlertMeta
): boolean {
  if (conditions.swell_height_min != null) {
    if (forecast.wave_height == null || forecast.wave_height < conditions.swell_height_min) return false;
  }
  if (conditions.swell_height_max != null) {
    if (forecast.wave_height == null || forecast.wave_height > conditions.swell_height_max) return false;
  }
  if (conditions.swell_period_min != null) {
    const period = forecast.swell_1_period ?? forecast.wave_period;
    if (period == null || period < conditions.swell_period_min) return false;
  }
  if (conditions.swell_direction_min_deg != null && conditions.swell_direction_max_deg != null) {
    if (forecast.swell_1_direction == null) return false;
    if (!isWithinArc(forecast.swell_1_direction, conditions.swell_direction_min_deg, conditions.swell_direction_max_deg)) return false;
  }
  if (conditions.wind_direction != null) {
    if (forecast.wind_direction_deg == null) return false;
    const resolved = resolveWindDirection(forecast.wind_direction_deg, beach.wind_offshore_deg, beach.wind_offshore_tol_deg, beach.aspect_deg);
    if (resolved !== conditions.wind_direction) return false;
  }
  if (conditions.wind_speed_max_kt != null) {
    if (forecast.wind_speed == null || forecast.wind_speed > conditions.wind_speed_max_kt) return false;
  }
  if (conditions.tide_height_min_ft != null) {
    if (forecast.tide_height == null || forecast.tide_height < conditions.tide_height_min_ft) return false;
  }
  if (conditions.tide_height_max_ft != null) {
    if (forecast.tide_height == null || forecast.tide_height > conditions.tide_height_max_ft) return false;
  }
  if (conditions.tide_direction != null) {
    if (forecast.tide_status == null || forecast.tide_status !== conditions.tide_direction) return false;
  }
  return true;
}
