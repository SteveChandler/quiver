import { calculateStreak } from "@/lib/progression/streak-calculator";

// Tests run in UTC (see jest.tz-setup.js). All "today" references use a fixed
// date so tests are deterministic regardless of when they run.
const TODAY = "2026-03-01";
const YESTERDAY = "2026-02-28";
const TWO_DAYS_AGO = "2026-02-27";
const THREE_DAYS_AGO = "2026-02-26";

// Helper: convert a YYYY-MM-DD string to a UTC ISO timestamp the way
// arrival_time values look in the database.
function toISO(date: string, hour = 8): string {
  return `${date}T0${hour}:00:00.000Z`;
}

describe("calculateStreak", () => {
  it("returns 0s for empty dates array", () => {
    const result = calculateStreak([], TODAY);
    expect(result).toEqual({
      currentStreak: 0,
      bestStreak: 0,
      lastSessionDate: null,
    });
  });

  it("returns 1 for single session today", () => {
    const result = calculateStreak([toISO(TODAY)], TODAY);
    expect(result).toEqual({
      currentStreak: 1,
      bestStreak: 1,
      lastSessionDate: TODAY,
    });
  });

  it("returns 1 for single session yesterday (streak still active)", () => {
    const result = calculateStreak([toISO(YESTERDAY)], TODAY);
    expect(result).toEqual({
      currentStreak: 1,
      bestStreak: 1,
      lastSessionDate: YESTERDAY,
    });
  });

  it("counts consecutive days correctly", () => {
    const dates = [
      toISO(THREE_DAYS_AGO),
      toISO(TWO_DAYS_AGO),
      toISO(YESTERDAY),
      toISO(TODAY),
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(4);
    expect(result.bestStreak).toBe(4);
    expect(result.lastSessionDate).toBe(TODAY);
  });

  it("gap breaks current streak", () => {
    // Sessions on today and yesterday but then a gap, plus older run
    const dates = [
      toISO("2026-01-01"),
      toISO("2026-01-02"),
      toISO("2026-01-03"),
      // gap
      toISO(YESTERDAY),
      toISO(TODAY),
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(3);
    expect(result.lastSessionDate).toBe(TODAY);
  });

  it("tracks best streak separately from current", () => {
    // Historical run of 5, current run of only 2
    const dates = [
      toISO("2025-12-01"),
      toISO("2025-12-02"),
      toISO("2025-12-03"),
      toISO("2025-12-04"),
      toISO("2025-12-05"),
      // gap
      toISO(YESTERDAY),
      toISO(TODAY),
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(5);
  });

  it("multiple sessions on same day count as 1", () => {
    // Three sessions on the same day should not inflate the streak
    const dates = [
      toISO(TODAY, 6),
      toISO(TODAY, 9),
      toISO(TODAY, 14),
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("current streak resets to 0 if last session was more than 1 day ago", () => {
    // Last session two days ago — streak is broken (not today or yesterday)
    const dates = [toISO(TWO_DAYS_AGO), toISO(THREE_DAYS_AGO)];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(2);
    expect(result.lastSessionDate).toBe(TWO_DAYS_AGO);
  });

  it("returns null lastSessionDate for empty array", () => {
    const result = calculateStreak([], TODAY);
    expect(result.lastSessionDate).toBeNull();
  });

  it("handles unsorted input dates", () => {
    // Feed dates out of order — result should be identical to sorted input
    const dates = [
      toISO(TODAY),
      toISO(THREE_DAYS_AGO),
      toISO(YESTERDAY),
      toISO(TWO_DAYS_AGO),
    ];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(4);
    expect(result.bestStreak).toBe(4);
    expect(result.lastSessionDate).toBe(TODAY);
  });

  it("single old session yields 0 current streak, 1 best streak", () => {
    const dates = [toISO("2025-06-15")];
    const result = calculateStreak(dates, TODAY);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(1);
    expect(result.lastSessionDate).toBe("2025-06-15");
  });
});
