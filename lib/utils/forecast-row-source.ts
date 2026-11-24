/**
 * `enhanced_forecasts` rows for slots no wave model covers yet (past the
 * Open-Meteo horizon, or a beach whose sources all failed). Their wave fields
 * are null, so they are never a forecast: they must not be scored, ranked,
 * picked as a best window, or trigger an alert. Wind and tide on the same row
 * may still be real.
 */
export const FALLBACK_FORECAST_DATA_SOURCE = "FALLBACK";

export function isFallbackForecastRow(row: { data_source?: string | null }): boolean {
  return row.data_source === FALLBACK_FORECAST_DATA_SOURCE;
}
