import {
  formatPeriodSeconds,
  formatWaveFeet,
  formatFeet,
  metersToFeetString,
  extractWindSpeed,
} from "@/lib/formatters/surf-data";

describe("formatPeriodSeconds", () => {
  it("returns null for null input", () => {
    expect(formatPeriodSeconds(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatPeriodSeconds(undefined)).toBeNull();
  });

  it("formats valid number with s suffix", () => {
    // formatPeriodSeconds delegates to formatSwellPeriod which rounds: round(12.5)=13
    expect(formatPeriodSeconds(12.5)).toBe("13s");
  });

  it("parses string input", () => {
    // formatSwellPeriod rounds: round(14.2)=14
    expect(formatPeriodSeconds("14.2")).toBe("14s");
  });

  it("rejects periods below 4s as invalid", () => {
    expect(formatPeriodSeconds(3.5)).toBeNull();
  });

  it("rejects periods above 25s as invalid", () => {
    expect(formatPeriodSeconds(26)).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(formatPeriodSeconds(Infinity)).toBeNull();
    expect(formatPeriodSeconds(NaN)).toBeNull();
  });
});

describe("formatWaveFeet", () => {
  it("returns null for null input", () => {
    expect(formatWaveFeet(null)).toBeNull();
  });

  it("converts meters to feet with ft suffix", () => {
    expect(formatWaveFeet(1)).toBe("3.3 ft");
  });

  it("rejects negative values", () => {
    expect(formatWaveFeet(-1)).toBeNull();
  });

  it("rejects values over 10 meters as sensor glitch", () => {
    expect(formatWaveFeet(11)).toBeNull();
  });
});

describe("formatFeet", () => {
  it("returns null for null input", () => {
    expect(formatFeet(null)).toBeNull();
  });

  it("formats feet value with ft suffix", () => {
    expect(formatFeet(4.5)).toBe("4.5 ft");
  });

  it("rejects negative values", () => {
    expect(formatFeet(-1)).toBeNull();
  });
});

describe("metersToFeetString", () => {
  it("converts meters to feet string", () => {
    expect(metersToFeetString(1)).toBe("3.3 ft");
  });

  it("handles sub-foot values with decimal", () => {
    expect(metersToFeetString(0.2)).toBe("0.7 ft");
  });
});

describe("extractWindSpeed", () => {
  it("extracts number from wind speed string", () => {
    expect(extractWindSpeed("15 mph")).toBe("15 mph");
  });

  it("returns default for empty string", () => {
    expect(extractWindSpeed("")).toBe("10 mph");
  });

  it("returns default for null input", () => {
    expect(extractWindSpeed(null as any)).toBe("10 mph");
  });
});
