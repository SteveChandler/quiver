import { normalizeIanaTimezone } from "@/lib/utils/iana-timezone";

describe("normalizeIanaTimezone", () => {
  it.each([
    "Asia/Kolkata",
    "Europe/Kyiv",
    "America/Argentina/Buenos_Aires",
    "Asia/Calcutta",
    "Etc/UTC",
    "Etc/GMT+8",
    "UTC",
    "America/Los_Angeles",
  ])("accepts %s", (timezone) => {
    expect(normalizeIanaTimezone(timezone)).toBe(timezone);
  });

  it.each(["+05:30", "-0800", "Mars/Base", "", "   ", "a".repeat(101)])(
    "rejects %s",
    (timezone) => {
      expect(normalizeIanaTimezone(timezone)).toBeNull();
    },
  );

  it.each([null, undefined, 42, {}, ["UTC"]])("rejects non-string %p", (value) => {
    expect(normalizeIanaTimezone(value)).toBeNull();
  });

  it("trims surrounding whitespace without canonicalizing", () => {
    expect(normalizeIanaTimezone("  Asia/Kolkata  ")).toBe("Asia/Kolkata");
  });
});
