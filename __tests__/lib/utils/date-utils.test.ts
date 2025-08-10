import { dateUtils } from "@/lib/utils/date-utils";

describe("dateUtils", () => {
  test("formatDate returns short month and day", () => {
    expect(dateUtils.formatDate("2025-01-15")).toMatch(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}$/
    );
  });

  test("formatForecastTime without time returns date only", () => {
    const result = dateUtils.formatForecastTime("2025-01-15");
    // Avoid timezone assumptions: just ensure month-day shape exists
    expect(result).toMatch(/Jan\s\d{1,2}$/);
    expect(result.includes(" at ")).toBe(false);
  });

  test("formatForecastTime with time returns 'date at time'", () => {
    const result = dateUtils.formatForecastTime("2025-01-15", "06:30");
    expect(result).toMatch(/Jan\s\d{1,2}\sat\s6:30\s(AM|Pm|am|pm)/);
  });

  test("formatForecastTimeDetailed toggles hour/minute formatting", () => {
    const withTime = dateUtils.formatForecastTimeDetailed(
      "2025-01-15",
      "18:00"
    );
    expect(withTime).toMatch(
      /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\sJan\s\d{1,2}.*6:00\s(AM|PM|am|pm)/
    );

    const withoutTime = dateUtils.formatForecastTimeDetailed("2025-01-15");
    expect(withoutTime).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\sJan\s\d{1,2}/);
  });

  test("formatLastUpdate returns relative minutes and hours, else date", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(dateUtils.formatLastUpdate(fiveMinAgo)).toBe("5m ago");

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(dateUtils.formatLastUpdate(twoHoursAgo)).toBe("2h ago");
  });

  test("formatTideTime format unix seconds to 12-hour clock with am/pm", () => {
    // 1700000000 corresponds to a deterministic hour; we only test format shape
    const result = dateUtils.formatTideTime(1700000000);
    expect(result).toMatch(/^\d{1,2}:\d{2}\s(am|pm)$/);
  });

  test("isToday returns true only for today's ISO date", () => {
    const todayIso = new Date().toISOString().split("T")[0];
    expect(dateUtils.isToday(todayIso)).toBe(true);
    expect(dateUtils.isToday("1999-01-01")).toBe(false);
  });

  test("getRelativeDayName returns Today/Tomorrow/Yesterday or formatted date", () => {
    const todayIso = new Date().toISOString().split("T")[0];
    expect(dateUtils.getRelativeDayName(todayIso)).toBe("Today");

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    expect(dateUtils.getRelativeDayName(tomorrow)).toBe("Tomorrow");

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    expect(dateUtils.getRelativeDayName(yesterday)).toBe("Yesterday");

    expect(dateUtils.getRelativeDayName("2025-01-15")).toMatch(/Jan\s\d{1,2}/);
  });
});
