import { extractForecastDate, extractForecastTime, extractLocalHour } from "@/lib/utils/forecast-at-adapter";

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




});
