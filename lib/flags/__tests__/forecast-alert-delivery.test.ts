import {
  FORECAST_ALERT_DELIVERY_ENABLED_FLAG,
  isForecastAlertDeliveryEnabled,
} from "@/lib/flags/forecast-alert-delivery";

describe("forecast alert delivery flag", () => {
  const originalValue = process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG];
      return;
    }
    process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG] = originalValue;
  });

  it("defaults off and enables only for exact true", () => {
    delete process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG];
    expect(isForecastAlertDeliveryEnabled()).toBe(false);

    process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG] = "TRUE";
    expect(isForecastAlertDeliveryEnabled()).toBe(false);

    process.env[FORECAST_ALERT_DELIVERY_ENABLED_FLAG] = "true";
    expect(isForecastAlertDeliveryEnabled()).toBe(true);
  });
});
