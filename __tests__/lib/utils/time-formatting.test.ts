import { formatTimeInTimezone } from "@/lib/utils/time-formatting";

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
