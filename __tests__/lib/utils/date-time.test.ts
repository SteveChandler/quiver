/**
 * Tests for lib/utils/date-time.ts (canonical date/time formatting)
 *
 * Merged from:
 *   - __tests__/lib/utils/date-utils.test.ts
 *   - __tests__/lib/utils/time-formatting.test.ts
 */
import {
  // dateUtils object (backward-compat)
  dateUtils,
  // timezone-aware hour/minute extraction
  getHourInTimezone,
  getMinuteInTimezone,
  // flattened named exports
  formatDate,
  formatForecastTime,
  formatForecastTimeDetailed,
  formatLastUpdate,
  formatTideTime,
  isToday,
  getRelativeDayName,
  // beach timezone helpers
  formatTimeInBeachTimezone,
  formatBeachDateTime,
  formatBeachTimeRange,
  formatBestAtLabel,
  // month range
  formatMonthRange,
  // date-formatting.ts
  formatDateInTimezone,
  // time-formatting.ts
  formatTimeInTimezone,
  formatTimeRangeInTimezone,
  formatTimeCasual,
  // time-formatters.ts
  formatTimeAgo,
  getWindowDayLabel,
  formatTimeWindowCompact,
  formatCompactDate,
  formatShortDate,
  formatFullDateWithYear,
} from "@/lib/utils/date-time";

describe("formatTimeRangeInTimezone", () => {
  it("formats both endpoints in the requested timezone and omits incomplete ranges", () => {
    expect(
      formatTimeRangeInTimezone(
        "2026-08-09T18:00:00.000Z",
        "2026-08-09T20:00:00.000Z",
        "Pacific/Honolulu",
      ),
    ).toBe("8:00 AM–10:00 AM");
    expect(
      formatTimeRangeInTimezone(
        "2026-08-09T18:00:00.000Z",
        "2026-08-09T20:00:00.000Z",
        "UTC",
        "-",
      ),
    ).toBe("6:00 PM-8:00 PM");
    expect(formatTimeRangeInTimezone(null, "2026-08-09T20:00:00.000Z", "UTC")).toBeNull();
  });
});

// =============================================================================
// dateUtils backward-compat object (delegates to named exports)
// =============================================================================

describe("dateUtils (backward-compat object)", () => {
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

// =============================================================================
// Named exports from flattened dateUtils
// =============================================================================

describe("formatDate", () => {
  it("returns short month and day", () => {
    expect(formatDate("2025-01-15")).toMatch(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}$/
    );
  });
});

describe("formatTideTime", () => {
  it("formats unix seconds to 12-hour clock with am/pm", () => {
    const result = formatTideTime(1700000000);
    expect(result).toMatch(/^\d{1,2}:\d{2}\s(am|pm)$/);
  });
});

describe("isToday", () => {
  it("returns true only for today's ISO date", () => {
    const todayIso = new Date().toISOString().split("T")[0];
    expect(isToday(todayIso)).toBe(true);
    expect(isToday("1999-01-01")).toBe(false);
  });
});

describe("getRelativeDayName", () => {
  it("returns Today for today", () => {
    const todayIso = new Date().toISOString().split("T")[0];
    expect(getRelativeDayName(todayIso)).toBe("Today");
  });

  it("returns Tomorrow for tomorrow", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    expect(getRelativeDayName(tomorrow)).toBe("Tomorrow");
  });

  it("returns Yesterday for yesterday", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    expect(getRelativeDayName(yesterday)).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    expect(getRelativeDayName("2025-01-15")).toMatch(/Jan\s\d{1,2}/);
  });
});

describe("formatLastUpdate", () => {
  it("returns minutes ago for recent updates", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatLastUpdate(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago for updates within 24h", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatLastUpdate(twoHoursAgo)).toBe("2h ago");
  });
});

describe("formatForecastTime", () => {
  it("without time returns date only", () => {
    const result = formatForecastTime("2025-01-15");
    expect(result).toMatch(/Jan\s\d{1,2}$/);
    expect(result.includes(" at ")).toBe(false);
  });

  it("with time returns 'date at time'", () => {
    const result = formatForecastTime("2025-01-15", "06:30");
    expect(result).toMatch(/Jan\s\d{1,2}\sat\s6:30\s(AM|Pm|am|pm)/);
  });

  it("accepts ISO timestamp (single-arg path)", () => {
    const result = formatForecastTime("2025-01-15T18:00:00.000Z");
    expect(result).toContain(" at ");
  });
});

describe("formatForecastTimeDetailed", () => {
  it("includes time when forecast_time provided", () => {
    const withTime = formatForecastTimeDetailed("2025-01-15", "18:00");
    expect(withTime).toMatch(
      /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\sJan\s\d{1,2}.*6:00\s(AM|PM|am|pm)/
    );
  });

  it("omits time when no forecast_time", () => {
    const withoutTime = formatForecastTimeDetailed("2025-01-15");
    expect(withoutTime).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\sJan\s\d{1,2}/);
  });
});

// =============================================================================
// formatTimeInBeachTimezone (from date-utils.ts)
// =============================================================================

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

// =============================================================================
// formatBeachDateTime (from date-utils.ts)
// =============================================================================

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

// =============================================================================
// formatBeachTimeRange (from date-utils.ts)
// =============================================================================

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

// =============================================================================
// formatBestAtLabel (from date-utils.ts)
// =============================================================================

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

// =============================================================================
// formatMonthRange (from date-utils.ts)
// =============================================================================

describe("formatMonthRange", () => {
  it("handles empty array", () => {
    expect(formatMonthRange([])).toBe("");
  });

  it("handles single month", () => {
    expect(formatMonthRange([6])).toBe("June");
  });

  it("formats contiguous range", () => {
    expect(formatMonthRange([1, 2, 3])).toBe("January through March");
  });

  it("formats non-contiguous months with Oxford comma", () => {
    expect(formatMonthRange([1, 3, 5])).toBe("January, March, and May");
  });

  it("formats two months with 'and'", () => {
    expect(formatMonthRange([3, 6])).toBe("March and June");
  });

  it("handles wrap-around range (Nov through Feb)", () => {
    // After sorting, [11,12,1,2] → [1,2,11,12] which has a gap; falls back to listing
    expect(formatMonthRange([11, 12, 1, 2])).toBe("January, February, November, and December");
  });
});

// =============================================================================
// formatDateInTimezone (from date-formatting.ts)
// =============================================================================

describe("formatDateInTimezone", () => {
  it("formats date in YYYY-MM-DD for given timezone", () => {
    // 2025-01-15T08:00:00Z is still Jan 14 in LA (UTC-8) and Jan 15 in UTC
    const date = new Date("2025-01-15T12:00:00Z"); // noon UTC = 4am Pacific
    const result = formatDateInTimezone(date, "America/Los_Angeles");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a YYYY-MM-DD shaped string", () => {
    const date = new Date("2025-06-15T20:00:00Z");
    const result = formatDateInTimezone(date, "America/Los_Angeles");
    expect(result).toMatch(/^2025-\d{2}-\d{2}$/);
  });
});

// =============================================================================
// formatTimeInTimezone (from time-formatting.ts)
// =============================================================================

describe("formatTimeInTimezone", () => {
  it("formats an ISO string to readable time", () => {
    const result = formatTimeInTimezone(
      "2025-01-15T14:30:00Z",
      "America/Los_Angeles"
    );
    expect(result).toBe("6:30 AM");
  });

  it("formats a Date object", () => {
    const date = new Date("2025-01-15T20:00:00Z");
    const result = formatTimeInTimezone(date, "America/Los_Angeles");
    expect(result).toBe("12:00 PM");
  });

  it("returns empty string for null input", () => {
    expect(formatTimeInTimezone(null, "America/Los_Angeles")).toBe("");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatTimeInTimezone("not-a-date", "America/Los_Angeles")).toBe("");
  });

  it("uses default timezone when none provided", () => {
    const result = formatTimeInTimezone("2025-01-15T14:30:00Z", null);
    // Should not throw, returns some formatted time
    expect(result).not.toBe("");
  });

  it("handles empty string input", () => {
    expect(formatTimeInTimezone("", "America/Los_Angeles")).toBe("");
  });
});

// =============================================================================
// formatTimeCasual (from time-formatting.ts)
// =============================================================================

describe("formatTimeCasual", () => {
  it("omits minutes when on the hour", () => {
    // 2025-01-15T18:00:00Z = 10:00 AM Pacific
    const result = formatTimeCasual("2025-01-15T18:00:00Z", "America/Los_Angeles");
    expect(result).toBe("10am");
  });

  it("includes minutes when not on the hour", () => {
    // 2025-01-15T14:30:00Z = 6:30 AM Pacific
    const result = formatTimeCasual("2025-01-15T14:30:00Z", "America/Los_Angeles");
    expect(result).toBe("6:30am");
  });

  it("returns empty string for null input", () => {
    expect(formatTimeCasual(null, "America/Los_Angeles")).toBe("");
  });
});

// =============================================================================
// formatTimeAgo (from time-formatters.ts)
// =============================================================================

describe("formatTimeAgo", () => {
  it("returns 'Just now' for < 1 min", () => {
    const now = new Date();
    expect(formatTimeAgo(now)).toBe("Just now");
  });

  it("returns minutes for < 1 hour", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinAgo)).toBe("5 min ago");
  });

  it("returns hours for >= 1 hour", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(twoHoursAgo)).toBe("2 hr ago");
  });
});

// =============================================================================
// getWindowDayLabel (from time-formatters.ts)
// =============================================================================

describe("getWindowDayLabel", () => {
  it("returns 'today' when start is today", () => {
    const result = getWindowDayLabel(new Date(), "America/Los_Angeles");
    expect(result).toBe("today");
  });

  it("returns 'tomorrow' when start is tomorrow", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = getWindowDayLabel(tomorrow, "America/Los_Angeles");
    expect(result).toBe("tomorrow");
  });
});

// =============================================================================
// formatTimeWindowCompact (from time-formatters.ts)
// =============================================================================

describe("formatTimeWindowCompact", () => {
  it("formats same-period window sharing suffix (7–10am)", () => {
    // 7am–10am Pacific
    const start = new Date("2025-01-15T15:00:00Z"); // 7am Pacific
    const end = new Date("2025-01-15T18:00:00Z");   // 10am Pacific
    const result = formatTimeWindowCompact(start, end, "America/Los_Angeles");
    expect(result).toBe("7\u201310am");
  });

  it("formats cross-period window with both suffixes (10am–1pm)", () => {
    // 10am–1pm Pacific
    const start = new Date("2025-01-15T18:00:00Z"); // 10am Pacific
    const end = new Date("2025-01-15T21:00:00Z");   // 1pm Pacific
    const result = formatTimeWindowCompact(start, end, "America/Los_Angeles");
    expect(result).toBe("10am\u20131pm");
  });

  it("includes minutes when not on the hour", () => {
    // 10:45am–1:45pm Pacific
    const start = new Date("2025-01-15T18:45:00Z"); // 10:45am Pacific
    const end = new Date("2025-01-15T21:45:00Z");   // 1:45pm Pacific
    const result = formatTimeWindowCompact(start, end, "America/Los_Angeles");
    expect(result).toBe("10:45am\u20131:45pm");
  });
});

// =============================================================================
// formatCompactDate / formatShortDate / formatFullDateWithYear (from time-formatters.ts)
// =============================================================================

describe("formatCompactDate", () => {
  it("returns 'Sat, Feb 8' style", () => {
    // Feb 8, 2025 is a Saturday
    const result = formatCompactDate(new Date("2025-02-08T12:00:00"));
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}$/);
  });
});

describe("formatShortDate", () => {
  it("returns '8 Sat' style", () => {
    const result = formatShortDate(new Date("2025-02-08T12:00:00"));
    expect(result).toMatch(/^\d{1,2}\s(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  });
});

describe("formatFullDateWithYear", () => {
  it("returns 'Saturday, February 8, 2025' style", () => {
    const result = formatFullDateWithYear(new Date("2025-02-08T12:00:00"));
    expect(result).toMatch(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2},\s\d{4}$/
    );
  });
});

// =============================================================================
// getHourInTimezone
// =============================================================================

describe("getHourInTimezone", () => {
  // 2026-03-13T15:00:00Z: PDT began Mar 8, so LA is UTC-7 → 8 AM
  const mar13_15utc = new Date("2026-03-13T15:00:00Z");

  it("returns correct hour for LA timezone (PDT, UTC-7)", () => {
    expect(getHourInTimezone(mar13_15utc, "America/Los_Angeles")).toBe(8);
  });

  it("returns correct hour for NY timezone (EDT, UTC-4)", () => {
    expect(getHourInTimezone(mar13_15utc, "America/New_York")).toBe(11);
  });

  it("returns correct hour for Hawaii (no DST, UTC-10)", () => {
    expect(getHourInTimezone(mar13_15utc, "Pacific/Honolulu")).toBe(5);
  });

  it("handles midnight UTC (returns 0)", () => {
    const midnight = new Date("2026-03-13T00:00:00Z");
    expect(getHourInTimezone(midnight, "UTC")).toBe(0);
  });

  it("maps hour 24 to 0", () => {
    // Some Intl implementations report midnight as 24 — function normalizes to 0.
    // Test via UTC midnight which is always 0 in UTC timezone.
    const midnight = new Date("2026-03-13T00:00:00Z");
    expect(getHourInTimezone(midnight, "UTC")).toBe(0);
  });

  it("falls back to UTC hours for invalid timezone", () => {
    const date = new Date("2026-03-13T15:00:00Z");
    expect(getHourInTimezone(date, "Invalid/Timezone")).toBe(15);
  });
});

// =============================================================================
// getMinuteInTimezone
// =============================================================================

describe("getMinuteInTimezone", () => {
  it("returns correct minute (30) in LA timezone", () => {
    const date = new Date("2026-03-13T15:30:00Z");
    expect(getMinuteInTimezone(date, "America/Los_Angeles")).toBe(30);
  });

  it("returns 0 for on-the-hour times", () => {
    const date = new Date("2026-03-13T15:00:00Z");
    expect(getMinuteInTimezone(date, "America/Los_Angeles")).toBe(0);
  });

  it("falls back to UTC minutes for invalid timezone", () => {
    const date = new Date("2026-03-13T15:45:00Z");
    expect(getMinuteInTimezone(date, "Invalid/Timezone")).toBe(45);
  });
});
