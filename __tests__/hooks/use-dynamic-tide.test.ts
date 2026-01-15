import { renderHook } from "@testing-library/react";
import { useDynamicTide } from "@/hooks/use-dynamic-tide";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Helper to create mock forecast with tide_schedule
function createMockForecast(
  tideSchedule?: Array<{ time: number; height: number; type: "high" | "low" }>
): EnhancedForecastEntity {
  return {
    id: "test-1",
    beach_id: "beach-1",
    forecast_date: "2026-01-14",
    forecast_time: "12:00",
    wave_height: "3 ft",
    wave_period: "12s",
    wave_direction: "W",
    water_temp: "60°F",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_forecast: tideSchedule ? { tide_schedule: tideSchedule } : null,
  } as EnhancedForecastEntity;
}

describe("useDynamicTide", () => {
  it("returns null values when forecasts array is empty", () => {
    const { result } = renderHook(() => useDynamicTide([]));

    expect(result.current.nextTide).toBeNull();
    expect(result.current.nextHigh).toBeNull();
    expect(result.current.nextLow).toBeNull();
    expect(result.current.minutesUntil).toBeNull();
    expect(result.current.usingFallback).toBe(true);
  });
});

describe("useDynamicTide - schedule extraction", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-14T17:00:00Z")); // 5 PM UTC
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("extracts tide_schedule from raw_forecast", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const forecasts = [
      createMockForecast([
        { time: futureTime, height: 5.2, type: "high" },
        { time: futureTime + 7200, height: 0.5, type: "low" },
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.usingFallback).toBe(false);
    expect(result.current.nextHigh).not.toBeNull();
    expect(result.current.nextHigh?.height).toBe(5.2);
  });

  it("finds tide_schedule across multiple forecasts", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const forecasts = [
      createMockForecast(), // No schedule
      createMockForecast([{ time: futureTime, height: 4.8, type: "low" }]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.usingFallback).toBe(false);
    expect(result.current.nextLow?.height).toBe(4.8);
  });

  it("returns fallback when no tide_schedule found", () => {
    const forecasts = [createMockForecast(), createMockForecast()];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.usingFallback).toBe(true);
    expect(result.current.nextTide).toBeNull();
  });

  it("correctly identifies which tide comes next", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const forecasts = [
      createMockForecast([
        { time: futureTime + 7200, height: 5.0, type: "high" }, // 2 hours
        { time: futureTime, height: 1.0, type: "low" }, // 1 hour (sooner)
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.nextTide?.type).toBe("low");
    expect(result.current.nextTide?.height).toBe(1.0);
  });

  it("calculates minutes until tides correctly", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour = 60 minutes
    const forecasts = [
      createMockForecast([{ time: futureTime, height: 5.0, type: "high" }]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.minutesUntil).toBe(60);
    expect(result.current.minutesToHigh).toBe(60);
  });

  it("ignores past tides", () => {
    const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const forecasts = [
      createMockForecast([
        { time: pastTime, height: 4.0, type: "high" }, // Past - should be ignored
        { time: futureTime, height: 5.0, type: "low" }, // Future - should be found
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.nextHigh).toBeNull(); // Past high is ignored
    expect(result.current.nextLow?.height).toBe(5.0);
    expect(result.current.nextTide?.type).toBe("low");
  });
});
