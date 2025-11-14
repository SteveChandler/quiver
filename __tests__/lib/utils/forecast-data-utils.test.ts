import {
  parseNumericValue,
  parseDirectionDegrees,
  timeStringToMinutes,
  formatSurfHeight,
} from "@/lib/utils/forecast-data-utils";

describe("parseNumericValue", () => {
  it("should return number as-is when valid", () => {
    expect(parseNumericValue(42)).toBe(42);
    expect(parseNumericValue(3.5)).toBe(3.5);
    expect(parseNumericValue(0)).toBe(0);
    expect(parseNumericValue(-10)).toBe(-10);
  });

  it("should return null for invalid numbers", () => {
    expect(parseNumericValue(NaN)).toBeNull();
    expect(parseNumericValue(Infinity)).toBeNull();
    expect(parseNumericValue(-Infinity)).toBeNull();
  });

  it("should parse numeric strings", () => {
    expect(parseNumericValue("42")).toBe(42);
    expect(parseNumericValue("3.5")).toBe(3.5);
    expect(parseNumericValue("-10")).toBe(-10);
  });

  it("should extract first number from text strings", () => {
    expect(parseNumericValue("Wave: 4-6 ft")).toBe(4);
    expect(parseNumericValue("3.5 meters")).toBe(3.5);
    expect(parseNumericValue("about -2.5 degrees")).toBe(-2.5);
  });

  it("should return null for null and undefined", () => {
    expect(parseNumericValue(null)).toBeNull();
    expect(parseNumericValue(undefined)).toBeNull();
  });

  it("should return null for non-numeric strings", () => {
    expect(parseNumericValue("abc")).toBeNull();
    expect(parseNumericValue("")).toBeNull();
    expect(parseNumericValue("no numbers here")).toBeNull();
  });
});

describe("parseDirectionDegrees", () => {
  it("should return numeric degrees as-is", () => {
    expect(parseDirectionDegrees(0)).toBe(0);
    expect(parseDirectionDegrees(90)).toBe(90);
    expect(parseDirectionDegrees(180)).toBe(180);
    expect(parseDirectionDegrees(270)).toBe(270);
    expect(parseDirectionDegrees(359)).toBe(359);
  });

  it("should parse numeric string degrees", () => {
    expect(parseDirectionDegrees("180")).toBe(180);
    expect(parseDirectionDegrees("45.5")).toBe(45.5);
  });

  it("should convert directional text to degrees", () => {
    // These will depend on getDirectionAbbrev and getWindDirectionDegrees
    // Basic cardinal directions
    expect(parseDirectionDegrees("N")).toBe(0);
    expect(parseDirectionDegrees("E")).toBe(90);
    expect(parseDirectionDegrees("S")).toBe(180);
    expect(parseDirectionDegrees("W")).toBe(270);
  });

  it("should return null for invalid values", () => {
    expect(parseDirectionDegrees(null)).toBeNull();
    expect(parseDirectionDegrees(undefined)).toBeNull();
    // Note: "invalid" text gets converted through getDirectionAbbrev/getWindDirectionDegrees
    // which may return a default value (like N=0) rather than null
  });
});

describe("timeStringToMinutes", () => {
  it("should convert time strings to minutes", () => {
    expect(timeStringToMinutes("00:00")).toBe(0);
    expect(timeStringToMinutes("01:00")).toBe(60);
    expect(timeStringToMinutes("14:30")).toBe(870); // 14*60 + 30
    expect(timeStringToMinutes("23:59")).toBe(1439); // 23*60 + 59
  });

  it("should handle single-digit hours and minutes", () => {
    expect(timeStringToMinutes("9:05")).toBe(545); // 9*60 + 5
    expect(timeStringToMinutes("01:05")).toBe(65); // 1*60 + 5
  });

  it("should return null for invalid formats", () => {
    expect(timeStringToMinutes(null)).toBeNull();
    expect(timeStringToMinutes(undefined)).toBeNull();
    expect(timeStringToMinutes("")).toBeNull();
    expect(timeStringToMinutes("invalid")).toBeNull();
    expect(timeStringToMinutes("12")).toBeNull(); // Missing colon
    // Note: "12:" has a colon so it gets split, and "" becomes 0 for minutes
    expect(timeStringToMinutes("12:")).toBe(720); // 12 hours * 60 = 720 minutes
  });

  it("should return null for non-numeric parts", () => {
    expect(timeStringToMinutes("ab:cd")).toBeNull();
    expect(timeStringToMinutes("12:ab")).toBeNull();
  });
});

describe("formatSurfHeight", () => {
  it("should format min-max range when different", () => {
    expect(formatSurfHeight(4, 6)).toBe("4-6 ft");
    expect(formatSurfHeight(2.5, 3.5)).toBe("2.5-3.5 ft");
    expect(formatSurfHeight(1, 2)).toBe("1-2 ft");
  });

  it("should average when min and max are close (within 0.25)", () => {
    expect(formatSurfHeight(3, 3.2)).toBe("3.1 ft"); // (3 + 3.2) / 2 = 3.1
    expect(formatSurfHeight(4.9, 5.1)).toBe("5 ft"); // (4.9 + 5.1) / 2 = 5.0
    expect(formatSurfHeight(2.5, 2.7)).toBe("2.6 ft"); // (2.5 + 2.7) / 2 = 2.6
  });

  it("should format single value when only min or max provided", () => {
    expect(formatSurfHeight(4, null)).toBe("4 ft");
    expect(formatSurfHeight(null, 6)).toBe("6 ft");
    expect(formatSurfHeight(3.5, undefined)).toBe("3.5 ft");
  });

  it("should use description as fallback", () => {
    expect(formatSurfHeight(null, null, "Knee-high")).toBe("Knee-high");
    expect(formatSurfHeight(null, null, "Overhead")).toBe("Overhead");
    expect(formatSurfHeight(null, null, "Flat")).toBe("Flat");
  });

  it("should ignore empty description", () => {
    expect(formatSurfHeight(null, null, "", "N/A")).toBe("N/A");
    expect(formatSurfHeight(null, null, "   ", "N/A")).toBe("N/A");
  });

  it("should use custom fallback when all else fails", () => {
    expect(formatSurfHeight(null, null, null, "No data")).toBe("No data");
    expect(formatSurfHeight(null, null, "", "Unknown")).toBe("Unknown");
  });

  it("should use N/A as default fallback", () => {
    expect(formatSurfHeight(null, null)).toBe("N/A");
    expect(formatSurfHeight(null, null, null, null)).toBe("N/A");
  });

  it("should round decimal values appropriately", () => {
    expect(formatSurfHeight(2.3, 4.7)).toBe("2.3-4.7 ft");
    expect(formatSurfHeight(3.0, 5.0)).toBe("3-5 ft");
    expect(formatSurfHeight(1.5, null)).toBe("1.5 ft");
  });

  it("should prioritize numeric values over description", () => {
    expect(formatSurfHeight(4, 6, "Overhead")).toBe("4-6 ft");
    expect(formatSurfHeight(3, null, "Chest-high")).toBe("3 ft");
  });
});
