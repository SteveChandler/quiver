import {
  resolveForecastTime,
  localDateTimeToUTC,
} from "@/lib/utils/forecast-time-resolver";
import type { EnhancedForecastEntity } from "@/types/forecast";

/**
 * Minimal forecast entity factory. Only fields consumed by resolveForecastTime
 * are required — the rest are null to satisfy the type.
 */
function makeForecast(
  overrides: Pick<
    EnhancedForecastEntity,
    "forecast_at" | "forecast_date" | "forecast_time"
  >
): EnhancedForecastEntity {
  return {
    id: "test-id",
    beach_id: "beach-id",
    wave_height: null,
    water_temp: null,
    ...overrides,
  } as EnhancedForecastEntity;
}

describe("localDateTimeToUTC", () => {
  it("converts a Pacific Standard Time local datetime to UTC", () => {
    // 15:00 PST (UTC-8) = 23:00 UTC — use a January date to guarantee PST, not PDT
    const result = localDateTimeToUTC("2026-01-13", "15:00:00", "America/Los_Angeles");
    expect(result.toISOString()).toBe("2026-01-13T23:00:00.000Z");
  });

  it("converts a Pacific Daylight Time local datetime to UTC", () => {
    // 08:00 PDT (UTC-7) = 15:00 UTC  (DST active in March 2026)
    const result = localDateTimeToUTC("2026-03-13", "08:00:00", "America/Los_Angeles");
    expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
  });

  it("converts a Hawaii time local datetime to UTC", () => {
    // 10:00 HST (UTC-10) = 20:00 UTC
    const result = localDateTimeToUTC("2026-03-13", "10:00:00", "Pacific/Honolulu");
    expect(result.toISOString()).toBe("2026-03-13T20:00:00.000Z");
  });
});

/**
 * The uncached algorithm as it was before memoisation. The cache must be
 * indistinguishable from it, including around DST transitions.
 */
function referenceLocalDateTimeToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const naiveUtc = new Date(`${dateStr}T${timeStr}Z`);
  const utcRepr = naiveUtc.toLocaleString("en-US", { timeZone: "UTC" });
  const localRepr = naiveUtc.toLocaleString("en-US", { timeZone: tz });
  const offsetMs = new Date(utcRepr).getTime() - new Date(localRepr).getTime();
  return new Date(naiveUtc.getTime() + offsetMs);
}

const PARITY_ZONES = [
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
  "America/New_York",
  "UTC",
] as const;

describe("localDateTimeToUTC memoisation", () => {
  it("matches the uncached algorithm for every light bound across a year in each zone", () => {
    for (const tz of PARITY_ZONES) {
      for (let day = 0; day < 365; day += 1) {
        const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
        for (const time of ["06:00:00", "18:00:00"]) {
          expect(localDateTimeToUTC(date, time, tz).getTime()).toBe(
            referenceLocalDateTimeToUTC(date, time, tz).getTime(),
          );
        }
      }
    }
  });

  it.each([
    ["2026-03-08", "01:00:00"],
    ["2026-03-08", "01:59:00"],
    ["2026-03-08", "02:00:00"],
    ["2026-03-08", "02:30:00"],
    ["2026-03-08", "03:00:00"],
    ["2026-11-01", "00:00:00"],
    ["2026-11-01", "01:00:00"],
    ["2026-11-01", "01:30:00"],
    ["2026-11-01", "02:00:00"],
  ])("matches the uncached algorithm at the DST edge %s %s, on first and repeat calls", (date, time) => {
    const expected = referenceLocalDateTimeToUTC(date, time, "America/Los_Angeles").getTime();
    expect(localDateTimeToUTC(date, time, "America/Los_Angeles").getTime()).toBe(expected);
    expect(localDateTimeToUTC(date, time, "America/Los_Angeles").getTime()).toBe(expected);
  });

  it("does not recompute an instant it already resolved", () => {
    localDateTimeToUTC("2031-05-05", "06:00:00", "America/Los_Angeles");
    const spy = jest.spyOn(Date.prototype, "toLocaleString");
    try {
      localDateTimeToUTC("2031-05-05", "06:00:00", "America/Los_Angeles");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("hands out a fresh Date each call so a caller's mutation cannot leak into the next", () => {
    const first = localDateTimeToUTC("2031-06-06", "18:00:00", "America/Los_Angeles");
    const original = first.getTime();
    first.setUTCFullYear(1999);
    expect(localDateTimeToUTC("2031-06-06", "18:00:00", "America/Los_Angeles").getTime()).toBe(original);
  });

  it("keeps throwing for an invalid timezone instead of caching a result", () => {
    expect(() => localDateTimeToUTC("2026-01-13", "15:00:00", "Not/AZone")).toThrow(RangeError);
    expect(() => localDateTimeToUTC("2026-01-13", "15:00:00", "Not/AZone")).toThrow(RangeError);
  });

  it("stays correct after the cache fills and is cleared", () => {
    const dates: string[] = [];
    for (let day = 0; day < 5100; day += 1) {
      dates.push(new Date(Date.UTC(2000, 0, 1 + day)).toISOString().slice(0, 10));
    }
    for (const date of dates) localDateTimeToUTC(date, "06:00:00", "America/Los_Angeles");
    for (const date of [dates[0], dates[2500], dates[5099]]) {
      expect(localDateTimeToUTC(date, "06:00:00", "America/Los_Angeles").getTime()).toBe(
        referenceLocalDateTimeToUTC(date, "06:00:00", "America/Los_Angeles").getTime(),
      );
    }
  });
});

describe("resolveForecastTime", () => {
  // -------------------------------------------------------------------
  // Case 1: Proper UTC
  // forecast_at is real UTC; rendering in beach timezone matches forecast_time.
  // PDT is UTC-7, so 2026-03-13T15:00:00Z = 08:00 local.
  // forecast_time = "08:00:00" → localHour (8) === forecastTimeHour (8).
  // Expected: returns forecastAtDate directly (15:00 UTC).
  // -------------------------------------------------------------------
  describe("Case 1 — proper UTC: forecast_time matches local hour of forecast_at", () => {
    const forecast = makeForecast({
      forecast_at: "2026-03-13T15:00:00Z",
      forecast_date: "2026-03-13",
      forecast_time: "08:00:00", // 08:00 PDT = 15:00 UTC
    });

    it("returns forecast_at unchanged", () => {
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
    });

    it("is identical to parsing forecast_at directly", () => {
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      expect(result.getTime()).toBe(new Date(forecast.forecast_at).getTime());
    });
  });

  // -------------------------------------------------------------------
  // Case 2: UTC forecast_time — the OPEN_METEO scenario (NEW check)
  // forecast_at is proper UTC; forecast_time is stored in UTC, not local.
  // PDT is UTC-7, so:
  //   forecast_at "2026-03-13T15:00:00Z" → local hour = 8, UTC hour = 15
  //   forecast_time = "15:00:00" → forecastTimeHour = 15
  //   localHour (8) !== forecastTimeHour (15)  — first check fails
  //   utcHour  (15) === forecastTimeHour (15)  — second check passes
  // Expected: returns forecastAtDate directly (15:00 UTC), NOT treated as local.
  // -------------------------------------------------------------------
  describe("Case 2 — UTC forecast_time (OPEN_METEO): forecast_time matches UTC hour of forecast_at", () => {
    const forecast = makeForecast({
      forecast_at: "2026-03-13T15:00:00Z",
      forecast_date: "2026-03-13",
      forecast_time: "15:00:00", // UTC hour, not local
    });

    it("returns forecast_at unchanged (not treated as local time)", () => {
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
    });

    it("does NOT shift the time by the PDT offset (UTC-7)", () => {
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      // If the bug were present, "15:00:00" would be treated as 15:00 PDT
      // and converted to 22:00 UTC. Verify that does NOT happen.
      expect(result.toISOString()).not.toBe("2026-03-13T22:00:00.000Z");
    });

    it("works for Hawaii timezone (UTC-10)", () => {
      // forecast_at 2026-03-13T20:00:00Z → local hour = 10, UTC hour = 20
      // forecast_time "20:00:00" → UTC match → return forecast_at directly
      const hiForecast = makeForecast({
        forecast_at: "2026-03-13T20:00:00Z",
        forecast_date: "2026-03-13",
        forecast_time: "20:00:00",
      });
      const result = resolveForecastTime(hiForecast, "Pacific/Honolulu");
      expect(result.toISOString()).toBe("2026-03-13T20:00:00.000Z");
    });

    it("works at midnight UTC", () => {
      // forecast_at 2026-03-13T00:00:00Z → UTC hour = 0 → matches forecast_time "00:00:00"
      const midnightForecast = makeForecast({
        forecast_at: "2026-03-13T00:00:00Z",
        forecast_date: "2026-03-13",
        forecast_time: "00:00:00",
      });
      const result = resolveForecastTime(midnightForecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-03-13T00:00:00.000Z");
    });

    it("works in PST (non-DST, January) — UTC-8 offset", () => {
      // forecast_at 2026-01-15T18:00:00Z → local hour = 10 (PST), UTC hour = 18
      // forecast_time "18:00:00" → UTC match → return forecast_at directly
      const pstForecast = makeForecast({
        forecast_at: "2026-01-15T18:00:00Z",
        forecast_date: "2026-01-15",
        forecast_time: "18:00:00",
      });
      const result = resolveForecastTime(pstForecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-01-15T18:00:00.000Z");
    });

    it("works for UTC+0 timezone (Reykjavik) — both checks match, first fires", () => {
      // forecast_at 2026-03-13T15:00:00Z → local hour = 15 (UTC+0), UTC hour = 15
      // forecast_time "15:00:00" → local hour match (check a) fires first → returns forecast_at
      // Both conventions produce the same result for UTC+0, so this is trivially safe
      const utcForecast = makeForecast({
        forecast_at: "2026-03-13T15:00:00Z",
        forecast_date: "2026-03-13",
        forecast_time: "15:00:00",
      });
      const result = resolveForecastTime(utcForecast, "Atlantic/Reykjavik");
      expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------
  // Case 3: Legacy local-as-UTC
  // forecast_at encodes local time with a Z suffix. E.g., the ingestion
  // pipeline stored "15:00 PST" as "2026-01-14T15:00:00Z".
  // forecast_time = "15:00:00" (local)
  // forecast_at   = "2026-01-14T15:00:00Z" (legacy encoding)
  // PST = UTC-8, so local hour rendered from 15:00 UTC-fake = still 15 within
  // the naive UTC representation.
  //
  // In this scenario both local-hour check and UTC-hour check would agree
  // (both equal 15) — BUT this is the same value, so the first check
  // (localHour === forecastTimeHour) fires and returns forecast_at unchanged,
  // which is the correct behavior for legacy data too (forecast_at encodes
  // the right hours for display purposes, just not true UTC).
  //
  // The pure legacy-fallback (localDateTimeToUTC) path is exercised when
  // forecast_time is local but the UTC rendering of forecast_at does NOT
  // match. That happens when forecast_at IS proper UTC (real offset) but
  // forecast_time was incorrectly stored as local.
  // -------------------------------------------------------------------
  describe("Case 3 — legacy local-as-UTC fallback: neither hour matches → convert via localDateTimeToUTC", () => {
    it("converts local forecast_time to UTC when hours disagree", () => {
      // Simulate a malformed row: forecast_at is proper UTC (8 AM PDT = 15:00Z)
      // but forecast_time was stored as a DIFFERENT local hour, e.g. "10:00:00".
      // localHour of 15:00Z in PDT = 8  → 8 !== 10, first check fails
      // utcHour of 15:00Z            = 15 → 15 !== 10, second check fails
      // Fallback: treat forecast_time "10:00:00" as PDT local → 17:00 UTC
      const forecast = makeForecast({
        forecast_at: "2026-03-13T15:00:00Z",
        forecast_date: "2026-03-13",
        forecast_time: "10:00:00", // 10:00 PDT = 17:00 UTC
      });
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-03-13T17:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------
  // No-timezone / no-legacy-fields fallback
  // -------------------------------------------------------------------
  describe("no-timezone fallback", () => {
    it("returns forecast_at parsed as UTC when beachTz is omitted", () => {
      const forecast = makeForecast({
        forecast_at: "2026-03-13T15:00:00Z",
        forecast_date: "2026-03-13",
        forecast_time: "08:00:00",
      });
      const result = resolveForecastTime(forecast);
      expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
    });

    it("returns forecast_at parsed as UTC when forecast_date is missing", () => {
      const forecast = makeForecast({
        forecast_at: "2026-03-13T15:00:00Z",
        forecast_date: "",
        forecast_time: "08:00:00",
      });
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
    });

    it("returns forecast_at parsed as UTC when forecast_time is missing", () => {
      const forecast = makeForecast({
        forecast_at: "2026-03-13T15:00:00Z",
        forecast_date: "2026-03-13",
        forecast_time: "",
      });
      const result = resolveForecastTime(forecast, "America/Los_Angeles");
      expect(result.toISOString()).toBe("2026-03-13T15:00:00.000Z");
    });
  });
});

describe("resolveForecastTime parity with uncached formatting", () => {
  function referenceResolve(forecast: EnhancedForecastEntity, tz: string): Date {
    const at = new Date(forecast.forecast_at);
    const forecastHour = parseInt(String(forecast.forecast_time).split(":")[0], 10);
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(at),
      10,
    );
    if (localHour === forecastHour || at.getUTCHours() === forecastHour) return at;
    return referenceLocalDateTimeToUTC(String(forecast.forecast_date), String(forecast.forecast_time), tz);
  }

  it("resolves proper-UTC, UTC-hour and local-as-UTC rows exactly as before", () => {
    for (const tz of PARITY_ZONES) {
      for (let hour = 0; hour < 72; hour += 1) {
        const at = new Date(Date.UTC(2026, 2, 7, hour));
        const iso = at.toISOString();
        const localParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", hour12: false,
        }).formatToParts(at);
        const part = (type: string): string => localParts.find((p) => p.type === type)?.value ?? "00";
        const conventions = [
          // proper UTC: forecast_time is the local wall clock
          { forecast_date: `${part("year")}-${part("month")}-${part("day")}`, forecast_time: `${part("hour") === "24" ? "00" : part("hour")}:00:00` },
          // forecast_time holds the UTC hour
          { forecast_date: iso.slice(0, 10), forecast_time: `${String(at.getUTCHours()).padStart(2, "0")}:00:00` },
          // legacy: forecast_at encodes local time with a Z suffix
          { forecast_date: iso.slice(0, 10), forecast_time: `${String((hour + 5) % 24).padStart(2, "0")}:00:00` },
        ];
        for (const convention of conventions) {
          const forecast = makeForecast({ forecast_at: iso, ...convention });
          expect(resolveForecastTime(forecast, tz).getTime()).toBe(referenceResolve(forecast, tz).getTime());
        }
      }
    }
  });
});
