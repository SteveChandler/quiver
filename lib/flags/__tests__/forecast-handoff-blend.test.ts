import {
  FORECAST_HANDOFF_BLEND_ENABLED_FLAG,
  isForecastHandoffBlendEnabled,
} from "../forecast-handoff-blend";

describe("isForecastHandoffBlendEnabled", () => {
  const prev = process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG];

  afterEach(() => {
    if (prev === undefined) {
      delete process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG];
    } else {
      process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG] = prev;
    }
  });

  it("defaults off", () => {
    delete process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG];
    expect(isForecastHandoffBlendEnabled()).toBe(false);
  });

  it("is enabled only by the literal true string", () => {
    process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG] = "true";
    expect(isForecastHandoffBlendEnabled()).toBe(true);

    process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG] = "1";
    expect(isForecastHandoffBlendEnabled()).toBe(false);
  });
});
