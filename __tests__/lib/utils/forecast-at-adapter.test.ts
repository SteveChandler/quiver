import {
  extractForecastDate,
  extractForecastTime,
  extractLocalHour,
  toForecastAt,
  sortByForecastAt,
  groupByForecastDate,
  isForecastAtInFuture,
} from "@/lib/utils/forecast-at-adapter";

describe("forecastAtAdapter", () => {
  describe("extractForecastDate", () => {
    it("extracts YYYY-MM-DD from ISO 8601 timestamptz", () => {
      expect(extractForecastDate("2026-02-14T14:00:00Z")).toBe("2026-02-14");
    });

    it("extracts date from timestamptz with offset", () => {
      expect(extractForecastDate("2026-02-14T06:00:00-08:00")).toBe("2026-02-14");
    });

    it("extracts local date when timezone provided", () => {
      // 2026-02-15T02:00:00Z = Feb 14 at 6 PM PST
      expect(extractForecastDate("2026-02-15T02:00:00Z", "America/Los_Angeles")).toBe("2026-02-14");
    });
  });

  describe("extractForecastTime", () => {
    it("extracts HH:MM:SS from ISO 8601", () => {
      expect(extractForecastTime("2026-02-14T14:00:00Z")).toBe("14:00:00");
    });

    it("extracts local time when timezone provided", () => {
      // 14:00 UTC = 06:00 PST
      expect(extractForecastTime("2026-02-14T14:00:00Z", "America/Los_Angeles")).toBe("06:00:00");
    });
  });

  describe("extractLocalHour", () => {
    it("returns UTC hour when no timezone", () => {
      expect(extractLocalHour("2026-02-14T14:00:00Z")).toBe(14);
    });

    it("returns local hour when timezone provided", () => {
      expect(extractLocalHour("2026-02-14T14:00:00Z", "America/Los_Angeles")).toBe(6);
    });
  });

  describe("toForecastAt", () => {
    it("combines forecast_date + forecast_time into ISO 8601 UTC", () => {
      const result = toForecastAt("2026-02-14", "06:00:00");
      expect(result).toBe("2026-02-14T06:00:00Z");
    });
  });

  describe("sortByForecastAt", () => {
    it("sorts forecasts chronologically", () => {
      const forecasts = [
        { forecast_at: "2026-02-14T12:00:00Z", id: "b" },
        { forecast_at: "2026-02-14T06:00:00Z", id: "a" },
        { forecast_at: "2026-02-14T18:00:00Z", id: "c" },
      ];
      const sorted = sortByForecastAt(forecasts);
      expect(sorted.map((f) => f.id)).toEqual(["a", "b", "c"]);
    });
  });

  describe("groupByForecastDate", () => {
    it("groups forecasts by local date in given timezone", () => {
      const forecasts = [
        { forecast_at: "2026-02-14T14:00:00Z" }, // Feb 14 6AM PST
        { forecast_at: "2026-02-15T02:00:00Z" }, // Feb 14 6PM PST
        { forecast_at: "2026-02-15T14:00:00Z" }, // Feb 15 6AM PST
      ];
      const grouped = groupByForecastDate(forecasts, "America/Los_Angeles");
      expect(Object.keys(grouped)).toEqual(["2026-02-14", "2026-02-15"]);
      expect(grouped["2026-02-14"]).toHaveLength(2);
      expect(grouped["2026-02-15"]).toHaveLength(1);
    });
  });

  describe("isForecastAtInFuture", () => {
    it("returns true for future timestamps", () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      expect(isForecastAtInFuture(future)).toBe(true);
    });

    it("returns false for past timestamps", () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      expect(isForecastAtInFuture(past)).toBe(false);
    });
  });
});
