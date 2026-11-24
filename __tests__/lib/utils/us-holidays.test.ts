import { surfHoliday } from "@/lib/utils/us-holidays";

describe("surfHoliday", () => {
  it.each([
    ["2026-11-26", "Thanksgiving", "Thanksgiving Day"],
    ["2027-11-25", "Thanksgiving", "Thanksgiving Day"],
    ["2026-05-25", "Memorial Day", "Memorial Day"],
    ["2027-05-31", "Memorial Day", "Memorial Day"],
    ["2026-09-07", "Labor Day", "Labor Day"],
    ["2027-09-06", "Labor Day", "Labor Day"],
    ["2027-01-01", "New Year's Day", "New Year's Day"],
    ["2026-07-04", "July 4th", "July 4th"],
    ["2026-12-25", "Christmas", "Christmas Day"],
  ])("names %s", (date, name, day) => {
    expect(surfHoliday(date)).toEqual({ name, day });
  });

  it.each(["2026-11-19", "2026-11-27", "2026-05-18", "2026-09-14", "2026-12-24", "not-a-date"])("names no holiday on %s", (date) => {
    expect(surfHoliday(date)).toBeNull();
  });
});
