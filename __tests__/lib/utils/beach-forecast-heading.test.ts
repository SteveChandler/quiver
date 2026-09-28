/**
 * @jest-environment node
 */
import { beachForecastHeadingSuffix, formatForecastHeadingDate } from "@/lib/utils/beach-forecast-heading";

describe("beach forecast heading", () => {
  it("formats the forecast's local date in the beach's timezone", () => {
    expect(formatForecastHeadingDate("2026-09-27", "America/Los_Angeles")).toBe("Sunday, September 27, 2026");
    expect(formatForecastHeadingDate(null, "UTC")).toBeNull();
  });

  it("keeps today's H1 words, and drops the date for a selected window", () => {
    expect(beachForecastHeadingSuffix("Sunday, September 27, 2026", false)).toBe("Surf Forecast for Sunday, September 27, 2026");
    expect(beachForecastHeadingSuffix("Sunday, September 27, 2026", true)).toBe("Surf Forecast");
    expect(beachForecastHeadingSuffix(null, false)).toBe("Surf Forecast");
  });
});
