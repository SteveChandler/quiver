export const FORECAST_HANDOFF_BLEND_ENABLED_FLAG =
  "FORECAST_HANDOFF_BLEND_ENABLED";

export function isForecastHandoffBlendEnabled(): boolean {
  return process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG] === "true";
}
