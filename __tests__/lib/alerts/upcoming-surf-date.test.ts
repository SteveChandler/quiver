import { getUpcomingSurfDate } from "@/lib/alerts/timezone-utils";

describe("getUpcomingSurfDate", () => {
  it.each([
    ["America/Los_Angeles", "2026-10-09"],
    ["America/New_York", "2026-10-09"],
    ["America/Chicago", "2026-10-09"],
    ["America/Puerto_Rico", "2026-10-09"],
    ["Pacific/Honolulu", "2026-10-09"],
  ])("selects the upcoming surf day at 09:00 UTC in %s", (timezone, expected) => {
    expect(getUpcomingSurfDate(new Date("2026-10-09T09:00:00Z"), timezone)).toBe(expected);
  });

  it.each([
    ["America/Los_Angeles", "2026-03-07T23:59:00Z", "2026-03-07"],
    ["America/Los_Angeles", "2026-03-08T00:00:00Z", "2026-03-08"],
    ["America/Los_Angeles", "2026-03-08T22:59:00Z", "2026-03-08"],
    ["America/Los_Angeles", "2026-03-08T23:00:00Z", "2026-03-09"],
    ["America/Los_Angeles", "2026-10-31T22:59:00Z", "2026-10-31"],
    ["America/Los_Angeles", "2026-10-31T23:00:00Z", "2026-11-01"],
    ["America/Los_Angeles", "2026-11-01T23:59:00Z", "2026-11-01"],
    ["America/Los_Angeles", "2026-11-02T00:00:00Z", "2026-11-02"],
    ["Pacific/Honolulu", "2026-03-08T01:59:00Z", "2026-03-07"],
    ["Pacific/Honolulu", "2026-03-08T02:00:00Z", "2026-03-08"],
    ["Pacific/Honolulu", "2026-03-09T01:59:00Z", "2026-03-08"],
    ["Pacific/Honolulu", "2026-03-09T02:00:00Z", "2026-03-09"],
  ])("handles the 16:00 boundary in %s at %s", (timezone, now, expected) => {
    expect(getUpcomingSurfDate(new Date(now), timezone)).toBe(expected);
  });

  it.each([
    ["America/Los_Angeles", "2026-10-09T07:00:00Z", "2026-10-09"],
    ["Pacific/Honolulu", "2026-10-09T10:00:00Z", "2026-10-09"],
    ["Pacific/Honolulu", "2027-01-01T02:00:00Z", "2027-01-01"],
  ])("handles midnight and calendar rollover in %s at %s", (timezone, now, expected) => {
    expect(getUpcomingSurfDate(new Date(now), timezone)).toBe(expected);
  });
});
