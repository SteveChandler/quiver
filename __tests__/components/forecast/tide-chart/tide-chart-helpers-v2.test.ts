import { parseForecastDateTime } from "@/components/forecast/tide-chart/tide-chart-helpers";

describe("parseForecastDateTime with forecast_at", () => {
  it("parses forecast_at ISO string directly when called with one argument", () => {
    const result = parseForecastDateTime("2026-02-14T14:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(new Date("2026-02-14T14:00:00Z").getTime());
  });

  it("parses forecast_at ISO string with timezone offset", () => {
    const result = parseForecastDateTime("2026-02-14T06:00:00-08:00");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(
      new Date("2026-02-14T06:00:00-08:00").getTime()
    );
  });

  it("still works with two arguments (legacy)", () => {
    const result = parseForecastDateTime("2026-02-14", "14:00:00");
    expect(result).toBeInstanceOf(Date);
    // Should be a valid date
    expect(isNaN(result!.getTime())).toBe(false);
  });

  it("returns undefined for empty string with no time argument", () => {
    const result = parseForecastDateTime("");
    expect(result).toBeUndefined();
  });
});
