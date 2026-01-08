import {
  dateUtils,
  formatTimeInBeachTimezone,
  formatBeachDateTime,
  formatBeachTimeRange,
  formatBestAtLabel,
} from "@/lib/utils/date-utils";

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

describe("formatTimeInBeachTimezone", () => {
  it("formats UTC time in specified timezone", () => {
    // 2025-01-15T18:00:00Z is 10:00 AM Pacific (UTC-8 in winter)
    const result = formatTimeInBeachTimezone(
      "2025-01-15T18:00:00Z",
      "America/Los_Angeles"
    );
    expect(result).toBe("10:00 AM");
  });

  it("handles Date objects", () => {
    const date = new Date("2025-01-15T18:00:00Z");
    const result = formatTimeInBeachTimezone(date, "America/Los_Angeles");
    expect(result).toBe("10:00 AM");
  });

  it("uses default timezone when none provided", () => {
    // Default is America/Los_Angeles
    const result = formatTimeInBeachTimezone("2025-01-15T18:00:00Z");
    expect(result).toBe("10:00 AM");
  });
});

describe("formatBeachDateTime", () => {
  const testDate = new Date("2025-01-15T18:00:00Z"); // 10:00 AM Pacific

  it("formats EEE pattern (short weekday)", () => {
    const result = formatBeachDateTime(testDate, "America/Los_Angeles", "EEE");
    expect(result).toBe("Wed");
  });

  it("formats EEE h:mm a pattern", () => {
    const result = formatBeachDateTime(
      testDate,
      "America/Los_Angeles",
      "EEE h:mm a"
    );
    expect(result).toBe("Wed 10:00 AM");
  });

  it("formats EEE, MMM d pattern", () => {
    const result = formatBeachDateTime(
      testDate,
      "America/Los_Angeles",
      "EEE, MMM d"
    );
    expect(result).toBe("Wed, Jan 15");
  });

  it("formats h:mm a pattern", () => {
    const result = formatBeachDateTime(
      testDate,
      "America/Los_Angeles",
      "h:mm a"
    );
    expect(result).toBe("10:00 AM");
  });

  it("formats ha pattern", () => {
    const result = formatBeachDateTime(testDate, "America/Los_Angeles", "ha");
    expect(result).toBe("10AM");
  });

  it("formats H pattern (24-hour)", () => {
    const result = formatBeachDateTime(testDate, "America/Los_Angeles", "H");
    expect(result).toBe("10");
  });

  it("formats m pattern (minutes)", () => {
    const result = formatBeachDateTime(testDate, "America/Los_Angeles", "m");
    expect(result).toBe("0");
  });

  it("handles different timezones correctly", () => {
    // 2025-01-15T18:00:00Z is:
    // - 10:00 AM Pacific (UTC-8)
    // - 1:00 PM Eastern (UTC-5)
    // - 8:00 AM Hawaii (UTC-10)
    expect(
      formatBeachDateTime(testDate, "America/Los_Angeles", "h:mm a")
    ).toBe("10:00 AM");
    expect(formatBeachDateTime(testDate, "America/New_York", "h:mm a")).toBe(
      "1:00 PM"
    );
    expect(formatBeachDateTime(testDate, "Pacific/Honolulu", "h:mm a")).toBe(
      "8:00 AM"
    );
  });
});

describe("formatBeachTimeRange", () => {
  it("formats time range on same day", () => {
    const start = new Date("2025-01-15T18:00:00Z"); // 10:00 AM Pacific
    const end = new Date("2025-01-15T21:00:00Z"); // 1:00 PM Pacific
    const result = formatBeachTimeRange(start, end, "America/Los_Angeles");
    expect(result).toBe("Wed 10:00 AM - 1:00 PM");
  });

  it("formats time range crossing midnight", () => {
    const start = new Date("2025-01-16T07:00:00Z"); // 11:00 PM Pacific Jan 15
    const end = new Date("2025-01-16T10:00:00Z"); // 2:00 AM Pacific Jan 16
    const result = formatBeachTimeRange(start, end, "America/Los_Angeles");
    expect(result).toBe("Wed 11:00 PM - Thu 2:00 AM");
  });
});

describe("formatBestAtLabel", () => {
  it("formats compact time range with shared AM/PM", () => {
    const start = new Date("2025-01-15T18:00:00Z"); // 10:00 AM Pacific
    const end = new Date("2025-01-15T21:00:00Z"); // 1:00 PM Pacific
    const result = formatBestAtLabel(start, end, "America/Los_Angeles");
    // Both are in different periods (AM/PM), so format should be "Best Wed 10am-1pm"
    expect(result).toBe("Best Wed 10am-1pm");
  });

  it("formats compact time range within same period", () => {
    const start = new Date("2025-01-15T15:00:00Z"); // 7:00 AM Pacific
    const end = new Date("2025-01-15T18:00:00Z"); // 10:00 AM Pacific
    const result = formatBestAtLabel(start, end, "America/Los_Angeles");
    // Both are AM, so should share suffix: "Best Wed 7-10am"
    expect(result).toBe("Best Wed 7-10am");
  });
});
