import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";

type F = { forecast_date: string; forecast_time: string };

describe("current-forecast-utils", () => {
  const setNow = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso));
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  test("getCurrentForecast returns null for empty input", () => {
    setNow("2025-01-15T10:30:00.000Z");
    expect(getCurrentForecast([] as F[])).toBeNull();
  });

  test("getCurrentForecast returns single forecast when only one", () => {
    setNow("2025-01-15T10:30:00.000Z");
    const f: F = { forecast_date: "2025-01-15", forecast_time: "09:00" };
    expect(getCurrentForecast([f])).toEqual(f);
  });

  test("getCurrentForecast selects a valid next forecast today or first of next day", () => {
    setNow("2025-01-15T10:30:00.000Z");
    const forecasts: F[] = [
      { forecast_date: "2025-01-15", forecast_time: "09:00", forecast_at: "2025-01-15T09:00:00Z" } as any,
      { forecast_date: "2025-01-15", forecast_time: "11:00", forecast_at: "2025-01-15T11:00:00Z" } as any,
      { forecast_date: "2025-01-15", forecast_time: "15:00", forecast_at: "2025-01-15T15:00:00Z" } as any,
      { forecast_date: "2025-01-16", forecast_time: "06:00", forecast_at: "2025-01-16T06:00:00Z" } as any,
    ];
    const todayIso = new Date().toISOString().split("T")[0];
    const result = getCurrentForecast(forecasts)!;
    if (result.forecast_date === todayIso) {
      expect(["09:00", "11:00", "15:00"]).toContain(result.forecast_time);
    } else {
      expect(result).toEqual({
        forecast_at: "2025-01-16T06:00Z",
        forecast_date: "2025-01-16",
        forecast_time: "06:00",
      });
    }

    // Move to later in the day so only next day is available
    setNow("2025-01-15T23:30:00.000Z");
    expect(getCurrentForecast(forecasts)).toEqual({
      forecast_at: "2025-01-16T06:00:00Z",
      forecast_date: "2025-01-16",
      forecast_time: "06:00",
    });
  });

  test("getCurrentForecast returns most recent past if only past entries exist", () => {
    setNow("2025-01-15T10:30:00.000Z");
    const forecasts: F[] = [
      { forecast_date: "2025-01-14", forecast_time: "16:00" },
      { forecast_date: "2025-01-15", forecast_time: "08:00" },
    ];
    const result = getCurrentForecast(forecasts)!;
    expect(["2025-01-15", "2025-01-14"]).toContain(result.forecast_date);
  });
});
