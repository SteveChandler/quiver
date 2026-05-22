/**
 * @jest-environment node
 */

describe("forecast API cache rules", () => {
  it("keeps the source-backed current forecast endpoint out of Workbox forecast caching", async () => {
    const { isCacheableForecastApiPath, isNoStoreForecastApiPath } =
      await import("../../config/forecast-api-cache-rules.mjs");

    expect(isNoStoreForecastApiPath("/api/forecasts/current")).toBe(true);
    expect(isCacheableForecastApiPath("/api/forecasts/current")).toBe(false);
    expect(isCacheableForecastApiPath("/api/forecasts/current/extra")).toBe(true);
    expect(isCacheableForecastApiPath("/api/forecasts/bulk")).toBe(true);
    expect(isCacheableForecastApiPath("/api/beaches")).toBe(false);
  });
});
