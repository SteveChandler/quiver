/**
 * @jest-environment node
 */

describe("forecast API cache rules", () => {
  it("keeps the source-backed current forecast endpoint out of Workbox forecast caching", async () => {
    const { isCacheableForecastApiPath, isNoStoreForecastApiPath } =
      await import("../../config/forecast-api-cache-rules.mjs");

    expect(isNoStoreForecastApiPath("/api/forecasts/current")).toBe(true);
    expect(isCacheableForecastApiPath("/api/forecasts/current")).toBe(false);
    expect(isCacheableForecastApiPath("/api/forecasts/current/extra")).toBe(
      true,
    );
    expect(isNoStoreForecastApiPath("/api/forecasts/bulk")).toBe(true);
    expect(isCacheableForecastApiPath("/api/forecasts/bulk")).toBe(false);
    expect(isNoStoreForecastApiPath("/api/forecasts/update-enhanced")).toBe(true);
    expect(isCacheableForecastApiPath("/api/forecasts/update-enhanced")).toBe(false);
    expect(
      isNoStoreForecastApiPath(
        "/api/forecasts/scored/11111111-1111-4111-8111-111111111111",
      ),
    ).toBe(true);
    expect(
      isCacheableForecastApiPath(
        "/api/forecasts/scored/11111111-1111-4111-8111-111111111111",
      ),
    ).toBe(false);
    expect(isNoStoreForecastApiPath("/api/forecasts/scored")).toBe(false);
    expect(isCacheableForecastApiPath("/api/forecasts/scored")).toBe(true);
    expect(isCacheableForecastApiPath("/api/beaches")).toBe(false);
  });

  it("keeps every API response out of the Workbox image cache", async () => {
    const { isCacheableRuntimeImage } = await import(
      "../../config/forecast-api-cache-rules.mjs"
    );

    expect(isCacheableRuntimeImage("/api/forecasts/update-enhanced", "image"))
      .toBe(false);
    expect(isCacheableRuntimeImage("/api/beaches/photo", "image")).toBe(false);
    expect(isCacheableRuntimeImage("/images/surf.jpg", "image")).toBe(true);
    expect(isCacheableRuntimeImage("/images/surf.jpg", "document")).toBe(false);
  });
});
