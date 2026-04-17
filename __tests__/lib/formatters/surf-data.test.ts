/**
 * Unit tests for lib/formatters/surf-data.ts
 *
 * Contract under test
 * -------------------
 * formatWaveHeightRange(ft)  – delegates to formatWaveHeightRangeString with SET_WAVE_VARIANCE
 * formatWindSpeed(mph)       – rounds to nearest integer, appends ' mph'
 * formatSwellPeriod(s)       – rounds to nearest integer, appends 's'
 * formatTideHeight(ft)       – formats to 1 decimal place, appends 'ft'
 * formatWaterTemp(°F)        – rounds to nearest integer, appends '°F'
 * formatPeriodSeconds(value) – validates range 4–25s and delegates to formatSwellPeriod
 * formatWaveFeet(meters)     – converts meters→feet, validates range 0–10m
 * formatFeet(feet)           – formats feet value with ft suffix
 * metersToFeetString(meters) – converts meters to feet string
 * extractWindSpeed(str)      – extracts numeric wind speed from string
 */

import { describe, it, expect } from "@jest/globals";
import {
  formatWaveHeightRange,
  formatWindSpeed,
  formatSwellPeriod,
  formatTideHeight,
  formatWaterTemp,
  formatPeriodSeconds,
  formatWaveFeet,
  formatFeet,
  metersToFeetString,
  extractWindSpeed,
} from "@/lib/formatters/surf-data";

// ---------------------------------------------------------------------------
// formatWaveHeightRange (previously formatWaveHeight)
// ---------------------------------------------------------------------------

describe("formatWaveHeightRange", () => {
  describe("flat / non-positive values", () => {
    it("returns 'Flat' for zero", () => {
      expect(formatWaveHeightRange(0)).toBe("Flat");
    });

    it("returns 'Flat' for negative values", () => {
      expect(formatWaveHeightRange(-1)).toBe("Flat");
    });

    it("returns 'Flat' for large negative values", () => {
      expect(formatWaveHeightRange(-10)).toBe("Flat");
    });
  });

  describe("NaN and Infinity guards", () => {
    it("returns 'Flat' for NaN", () => {
      expect(formatWaveHeightRange(NaN)).toBe("Flat");
    });

    it("returns 'Flat' for Infinity", () => {
      expect(formatWaveHeightRange(Infinity)).toBe("Flat");
    });

    it("returns 'Flat' for -Infinity", () => {
      expect(formatWaveHeightRange(-Infinity)).toBe("Flat");
    });
  });

  describe("small ranges that collapse to a single value", () => {
    it("collapses 0.5ft (set=0.75) to a single value '1ft'", () => {
      // low=0.5 rounds to 1, high=0.75 rounds to 1 → same → "1ft"
      expect(formatWaveHeightRange(0.5)).toBe("1ft");
    });
  });

  describe("standard ranges", () => {
    it("formats 1ft as '1-2ft sets' (1 * 1.5 = 1.5, rounds to 2)", () => {
      expect(formatWaveHeightRange(1)).toBe("1-2ft sets");
    });

    it("formats 3ft as '3-5ft sets' (3 * 1.5 = 4.5, rounds to 5)", () => {
      expect(formatWaveHeightRange(3)).toBe("3-5ft sets");
    });

    it("formats 6ft as '6-9ft sets' (6 * 1.5 = 9.0)", () => {
      expect(formatWaveHeightRange(6)).toBe("6-9ft sets");
    });

    it("formats 10ft as '10-15ft sets' (10 * 1.5 = 15.0)", () => {
      expect(formatWaveHeightRange(10)).toBe("10-15ft sets");
    });
  });

  describe("return type", () => {
    it("always returns a string", () => {
      expect(typeof formatWaveHeightRange(0)).toBe("string");
      expect(typeof formatWaveHeightRange(3)).toBe("string");
      expect(typeof formatWaveHeightRange(10)).toBe("string");
    });

    it("returned string ends with 'ft' or 'ft sets' for positive heights", () => {
      expect(formatWaveHeightRange(3)).toMatch(/ft( sets)?$/);
      expect(formatWaveHeightRange(6)).toMatch(/ft( sets)?$/);
    });
  });
});

// ---------------------------------------------------------------------------
// formatWindSpeed
// ---------------------------------------------------------------------------

describe("formatWindSpeed", () => {
  describe("integer inputs", () => {
    it("formats 0 mph", () => {
      expect(formatWindSpeed(0)).toBe("0 mph");
    });

    it("formats 12 mph", () => {
      expect(formatWindSpeed(12)).toBe("12 mph");
    });

    it("formats 25 mph", () => {
      expect(formatWindSpeed(25)).toBe("25 mph");
    });
  });

  describe("decimal inputs – rounds to nearest integer", () => {
    it("rounds 12.7 up to 13", () => {
      expect(formatWindSpeed(12.7)).toBe("13 mph");
    });

    it("rounds 12.4 down to 12", () => {
      expect(formatWindSpeed(12.4)).toBe("12 mph");
    });

    it("rounds 0.5 up to 1", () => {
      expect(formatWindSpeed(0.5)).toBe("1 mph");
    });

    it("rounds 9.9 up to 10", () => {
      expect(formatWindSpeed(9.9)).toBe("10 mph");
    });
  });

  describe("edge cases", () => {
    it("formats exactly 0 as '0 mph'", () => {
      expect(formatWindSpeed(0)).toBe("0 mph");
    });

    it("formats large wind speed", () => {
      expect(formatWindSpeed(55)).toBe("55 mph");
    });
  });

  describe("NaN and Infinity guards", () => {
    it("returns '-- mph' for NaN", () => {
      expect(formatWindSpeed(NaN)).toBe("-- mph");
    });

    it("returns '-- mph' for Infinity", () => {
      expect(formatWindSpeed(Infinity)).toBe("-- mph");
    });

    it("returns '-- mph' for -Infinity", () => {
      expect(formatWindSpeed(-Infinity)).toBe("-- mph");
    });
  });

  describe("return type and format", () => {
    it("always returns a string", () => {
      expect(typeof formatWindSpeed(12)).toBe("string");
    });

    it("returned string ends with ' mph'", () => {
      expect(formatWindSpeed(12)).toMatch(/ mph$/);
      expect(formatWindSpeed(0)).toMatch(/ mph$/);
    });

    it("integer portion is a whole number (no decimal in output)", () => {
      expect(formatWindSpeed(12.7)).not.toContain(".");
    });
  });
});

// ---------------------------------------------------------------------------
// formatSwellPeriod
// ---------------------------------------------------------------------------

describe("formatSwellPeriod", () => {
  describe("integer inputs", () => {
    it("formats 14 seconds", () => {
      expect(formatSwellPeriod(14)).toBe("14s");
    });

    it("formats 9 seconds", () => {
      expect(formatSwellPeriod(9)).toBe("9s");
    });

    it("formats 7 seconds", () => {
      expect(formatSwellPeriod(7)).toBe("7s");
    });
  });

  describe("decimal inputs – rounds to nearest integer", () => {
    it("rounds 13.6 up to 14", () => {
      expect(formatSwellPeriod(13.6)).toBe("14s");
    });

    it("rounds 9.2 down to 9", () => {
      expect(formatSwellPeriod(9.2)).toBe("9s");
    });

    it("rounds 7.5 up to 8", () => {
      expect(formatSwellPeriod(7.5)).toBe("8s");
    });

    it("rounds 6.4 down to 6", () => {
      expect(formatSwellPeriod(6.4)).toBe("6s");
    });
  });

  describe("return type and format", () => {
    it("always returns a string", () => {
      expect(typeof formatSwellPeriod(14)).toBe("string");
    });

    it("returned string ends with 's'", () => {
      expect(formatSwellPeriod(14)).toMatch(/s$/);
      expect(formatSwellPeriod(9)).toMatch(/s$/);
    });

    it("no decimal in output", () => {
      expect(formatSwellPeriod(13.6)).not.toContain(".");
    });
  });

  describe("NaN and Infinity guards", () => {
    it("returns '--s' for NaN", () => {
      expect(formatSwellPeriod(NaN)).toBe("--s");
    });

    it("returns '--s' for Infinity", () => {
      expect(formatSwellPeriod(Infinity)).toBe("--s");
    });

    it("returns '--s' for -Infinity", () => {
      expect(formatSwellPeriod(-Infinity)).toBe("--s");
    });
  });
});

// ---------------------------------------------------------------------------
// formatTideHeight
// ---------------------------------------------------------------------------

describe("formatTideHeight", () => {
  describe("positive values", () => {
    it("formats 2.34 to one decimal place as '2.3ft'", () => {
      expect(formatTideHeight(2.34)).toBe("2.3ft");
    });

    it("formats 4.56 as '4.6ft'", () => {
      expect(formatTideHeight(4.56)).toBe("4.6ft");
    });

    it("formats 1.0 as '1.0ft'", () => {
      expect(formatTideHeight(1.0)).toBe("1.0ft");
    });

    it("formats 5.99 as '6.0ft' (rounds up)", () => {
      expect(formatTideHeight(5.99)).toBe("6.0ft");
    });
  });

  describe("zero", () => {
    it("formats 0 as '0.0ft'", () => {
      expect(formatTideHeight(0)).toBe("0.0ft");
    });
  });

  describe("negative values (low tide below MLLW)", () => {
    it("formats -1.5 as '-1.5ft'", () => {
      expect(formatTideHeight(-1.5)).toBe("-1.5ft");
    });

    it("formats -0.3 as '-0.3ft'", () => {
      expect(formatTideHeight(-0.3)).toBe("-0.3ft");
    });

    it("formats -2.78 as '-2.8ft' (rounds to 1 decimal)", () => {
      expect(formatTideHeight(-2.78)).toBe("-2.8ft");
    });
  });

  describe("return type and format", () => {
    it("always returns a string", () => {
      expect(typeof formatTideHeight(2.34)).toBe("string");
    });

    it("returned string ends with 'ft'", () => {
      expect(formatTideHeight(2.34)).toMatch(/ft$/);
      expect(formatTideHeight(-1.5)).toMatch(/ft$/);
      expect(formatTideHeight(0)).toMatch(/ft$/);
    });

    it("always contains exactly one decimal digit before 'ft'", () => {
      // e.g. "2.3ft" – one digit after the decimal point
      expect(formatTideHeight(2.34)).toMatch(/\.\dft$/);
      expect(formatTideHeight(0)).toMatch(/\.\dft$/);
    });
  });

  describe("NaN and Infinity guards", () => {
    it("returns '--ft' for NaN", () => {
      expect(formatTideHeight(NaN)).toBe("--ft");
    });

    it("returns '--ft' for Infinity", () => {
      expect(formatTideHeight(Infinity)).toBe("--ft");
    });

    it("returns '--ft' for -Infinity", () => {
      expect(formatTideHeight(-Infinity)).toBe("--ft");
    });
  });
});

// ---------------------------------------------------------------------------
// formatWaterTemp
// ---------------------------------------------------------------------------

describe("formatWaterTemp", () => {
  describe("decimal inputs – rounds to nearest integer", () => {
    it("rounds 64.8°F up to 65", () => {
      expect(formatWaterTemp(64.8)).toBe("65°F");
    });

    it("rounds 64.4°F down to 64", () => {
      expect(formatWaterTemp(64.4)).toBe("64°F");
    });
  });

  describe("integer inputs", () => {
    it("formats 52°F", () => {
      expect(formatWaterTemp(52)).toBe("52°F");
    });

    it("formats 68°F", () => {
      expect(formatWaterTemp(68)).toBe("68°F");
    });

    it("formats 32°F (freezing)", () => {
      expect(formatWaterTemp(32)).toBe("32°F");
    });
  });

  describe("edge cases", () => {
    it("formats 0°F", () => {
      expect(formatWaterTemp(0)).toBe("0°F");
    });

    it("formats 99.5°F up to 100", () => {
      expect(formatWaterTemp(99.5)).toBe("100°F");
    });
  });

  describe("return type and format", () => {
    it("always returns a string", () => {
      expect(typeof formatWaterTemp(64.8)).toBe("string");
    });

    it("returned string ends with '°F'", () => {
      expect(formatWaterTemp(64.8)).toMatch(/°F$/);
      expect(formatWaterTemp(52)).toMatch(/°F$/);
    });

    it("no decimal in the numeric portion", () => {
      expect(formatWaterTemp(64.8)).not.toContain(".");
    });
  });

  describe("NaN and Infinity guards", () => {
    it("returns '--°F' for NaN", () => {
      expect(formatWaterTemp(NaN)).toBe("--°F");
    });

    it("returns '--°F' for Infinity", () => {
      expect(formatWaterTemp(Infinity)).toBe("--°F");
    });

    it("returns '--°F' for -Infinity", () => {
      expect(formatWaterTemp(-Infinity)).toBe("--°F");
    });
  });
});

// ---------------------------------------------------------------------------
// formatPeriodSeconds (merged from format-utils.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// formatWaveFeet (merged from format-utils.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// formatFeet (merged from format-utils.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// metersToFeetString (merged from format-utils.ts)
// ---------------------------------------------------------------------------

describe("metersToFeetString", () => {
  it("converts meters to feet string", () => {
    expect(metersToFeetString(1)).toBe("3.3 ft");
  });

  it("handles sub-foot values with decimal", () => {
    expect(metersToFeetString(0.2)).toBe("0.7 ft");
  });
});

// ---------------------------------------------------------------------------
// extractWindSpeed (merged from format-utils.ts)
// ---------------------------------------------------------------------------

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
