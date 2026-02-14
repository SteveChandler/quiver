import {
  getCurrentForecast,
  isForecastInFuture,
} from "@/lib/utils/current-forecast-utils";

describe("getCurrentForecast with forecast_at", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("selects the next future forecast when forecast_at is present", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    const oneHourFromNow = new Date(now.getTime() + 3600000).toISOString();
    const twoHoursFromNow = new Date(now.getTime() + 7200000).toISOString();

    const forecasts = [
      { forecast_at: oneHourAgo, forecast_date: "", forecast_time: "" },
      { forecast_at: oneHourFromNow, forecast_date: "", forecast_time: "" },
      { forecast_at: twoHoursFromNow, forecast_date: "", forecast_time: "" },
    ];
    const result = getCurrentForecast(forecasts);
    expect(result?.forecast_at).toBe(oneHourFromNow);
  });

  it("falls back to legacy fields when forecast_at is absent", () => {
    const forecasts = [
      { forecast_date: "2025-06-15", forecast_time: "09:00" },
      { forecast_date: "2025-06-15", forecast_time: "15:00" },
    ];
    // With fake time at 12:00 UTC, local time determines which is "future"
    const result = getCurrentForecast(forecasts);
    expect(result).not.toBeNull();
    expect(result!.forecast_date).toBe("2025-06-15");
  });

  it("returns the most recent past forecast when all are in the past", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 7200000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();

    const forecasts = [
      { forecast_at: twoHoursAgo, forecast_date: "", forecast_time: "" },
      { forecast_at: oneHourAgo, forecast_date: "", forecast_time: "" },
    ];
    const result = getCurrentForecast(forecasts);
    expect(result?.forecast_at).toBe(oneHourAgo);
  });

  it("handles a mix of forecast_at and legacy forecasts", () => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 3600000).toISOString();

    const forecasts = [
      { forecast_at: oneHourFromNow, forecast_date: "", forecast_time: "" },
      { forecast_date: "2025-06-15", forecast_time: "15:00" },
    ];
    const result = getCurrentForecast(forecasts);
    // Should still return a valid result
    expect(result).not.toBeNull();
  });
});

describe("isForecastInFuture with forecast_at", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns true for future forecast_at", () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(
      isForecastInFuture({
        forecast_at: future,
        forecast_date: "",
        forecast_time: "",
      })
    ).toBe(true);
  });

  it("returns false for past forecast_at", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(
      isForecastInFuture({
        forecast_at: past,
        forecast_date: "",
        forecast_time: "",
      })
    ).toBe(false);
  });

  it("still works with legacy fields when forecast_at is absent", () => {
    expect(
      isForecastInFuture({
        forecast_date: "2025-06-16",
        forecast_time: "12:00",
      })
    ).toBe(true);
    expect(
      isForecastInFuture({
        forecast_date: "2025-06-14",
        forecast_time: "12:00",
      })
    ).toBe(false);
  });
});
