import { validateForecastValues } from "@/lib/services/forecast/forecast-validator";

describe("validateForecastValues", () => {
  const baseForecast = {
    wave_height: "3.5 ft",
    wave_period: "12s",
    swell_1_period: "14s",
  };

  it("returns valid for typical San Diego conditions", () => {
    const result = validateForecastValues(baseForecast as any);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("flags unusually large waves over 8ft", () => {
    const forecast = { ...baseForecast, wave_height: "10 ft" };
    const result = validateForecastValues(forecast as any);
    expect(result.isValid).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Unusually large waves")])
    );
  });

  it("warns about unusually small waves under 0.5ft", () => {
    const forecast = { ...baseForecast, wave_height: "0.3 ft" };
    const result = validateForecastValues(forecast as any);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Unusually small waves")])
    );
  });

  it("warns about very short wave periods under 6s", () => {
    const forecast = { ...baseForecast, wave_period: "5s" };
    const result = validateForecastValues(forecast as any);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Very short wave period")])
    );
  });

  it("warns about short swell periods under 8s", () => {
    const forecast = { ...baseForecast, swell_1_period: "7s" };
    const result = validateForecastValues(forecast as any);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Short swell period")])
    );
  });

  it("handles null/missing values gracefully", () => {
    const forecast = { wave_height: null, wave_period: null, swell_1_period: null };
    const result = validateForecastValues(forecast as any);
    expect(result.isValid).toBe(true);
  });
});
