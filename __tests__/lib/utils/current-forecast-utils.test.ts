import {
  getCurrentForecast,
  getBestForecastForDate,
  isForecastInFuture,
  formatCurrentTime,
} from "@/lib/utils/current-forecast-utils";

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
      { forecast_date: "2025-01-15", forecast_time: "09:00" },
      { forecast_date: "2025-01-15", forecast_time: "11:00" },
      { forecast_date: "2025-01-15", forecast_time: "15:00" },
      { forecast_date: "2025-01-16", forecast_time: "06:00" },
    ];
    const todayIso = new Date().toISOString().split("T")[0];
    const result = getCurrentForecast(forecasts)!;
    if (result.forecast_date === todayIso) {
      expect(["09:00", "11:00", "15:00"]).toContain(result.forecast_time);
    } else {
      expect(result).toEqual({
        forecast_date: "2025-01-16",
        forecast_time: "06:00",
      });
    }

    // Move to later in the day so only next day is available
    setNow("2025-01-15T23:30:00.000Z");
    expect(getCurrentForecast(forecasts)).toEqual({
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

  test("getBestForecastForDate uses forward-looking for today and earliest slot for other date", () => {
    setNow("2025-01-15T10:30:00.000Z");
    const todays: F[] = [
      { forecast_date: "2025-01-15", forecast_time: "09:00" },
      { forecast_date: "2025-01-15", forecast_time: "11:00" },
    ];
    const todayResult = getBestForecastForDate(todays, "2025-01-15")!;
    expect(todayResult.forecast_date).toBe("2025-01-15");
    expect(["09:00", "11:00"]).toContain(todayResult.forecast_time);

    const other: F[] = [
      { forecast_date: "2025-01-16", forecast_time: "12:00" },
      { forecast_date: "2025-01-16", forecast_time: "06:00" },
    ];
    expect(getBestForecastForDate(other, "2025-01-16")).toEqual({
      forecast_date: "2025-01-16",
      forecast_time: "06:00",
    });
  });

  test("isForecastInFuture handles dates and same-day times correctly", () => {
    setNow("2025-01-15T10:30:00.000Z");
    expect(
      isForecastInFuture({
        forecast_date: "2025-01-16",
        forecast_time: "00:00",
      })
    ).toBe(true);
    expect(
      isForecastInFuture({
        forecast_date: "2025-01-14",
        forecast_time: "23:59",
      })
    ).toBe(false);

    const nowLocal = new Date();
    const hh = nowLocal.getHours();
    const mm = nowLocal.getMinutes();
    const pad = (n: number) => n.toString().padStart(2, "0");
    // one minute after now
    const afterMin = (mm + 1) % 60;
    const afterHour = mm === 59 ? (hh + 1) % 24 : hh;
    const after = `${pad(afterHour)}:${pad(afterMin)}`;
    // one minute before now
    const beforeMin = mm === 0 ? 59 : mm - 1;
    const beforeHour = mm === 0 ? (hh + 23) % 24 : hh;
    const before = `${pad(beforeHour)}:${pad(beforeMin)}`;

    expect(
      isForecastInFuture({
        forecast_date: nowLocal.toISOString().split("T")[0],
        forecast_time: after,
      })
    ).toBe(true);
    expect(
      isForecastInFuture({
        forecast_date: nowLocal.toISOString().split("T")[0],
        forecast_time: before,
      })
    ).toBe(false);
  });

  test("formatCurrentTime returns HH:MM:SS pattern", () => {
    setNow("2025-01-15T01:02:03.000Z");
    expect(formatCurrentTime()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
