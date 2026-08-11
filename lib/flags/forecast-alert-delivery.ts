export const FORECAST_ALERT_DELIVERY_ENABLED_FLAG =
  "FORECAST_ALERT_DELIVERY_ENABLED";

export function isForecastAlertDeliveryEnabled(): boolean {
  return process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG] === "true";
}
