import {
  applyBeachHeightOffset,
  formatDisplayHeightFt,
  parseDisplayHeightFt,
} from "../apply-beach-height-offset";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

describe("parseDisplayHeightFt", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("null / empty / whitespace inputs", () => {
    it("returns nulls for null input", () => {
      expect(parseDisplayHeightFt(null)).toEqual({
        numericFt: null,
        rangeSpread: null,
      });
    });

    it("returns nulls for undefined input", () => {
      expect(parseDisplayHeightFt(undefined)).toEqual({
        numericFt: null,
        rangeSpread: null,
      });
    });

    it("returns nulls for empty string", () => {
      expect(parseDisplayHeightFt("")).toEqual({
        numericFt: null,
        rangeSpread: null,
      });
    });

    it("returns nulls for whitespace-only string", () => {
      expect(parseDisplayHeightFt("   ")).toEqual({
        numericFt: null,
        rangeSpread: null,
      });
    });

    it("does not warn for null/empty inputs", () => {
      parseDisplayHeightFt(null);
      parseDisplayHeightFt("");
      parseDisplayHeightFt("   ");
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("flat inputs", () => {
    it("parses 'Flat' as 0", () => {
      expect(parseDisplayHeightFt("Flat")).toEqual({
        numericFt: 0,
        rangeSpread: null,
      });
    });

    it("parses 'flat' lowercase as 0", () => {
      expect(parseDisplayHeightFt("flat")).toEqual({
        numericFt: 0,
        rangeSpread: null,
      });
    });

    it("parses 'FLAT' uppercase as 0", () => {
      expect(parseDisplayHeightFt("FLAT")).toEqual({
        numericFt: 0,
        rangeSpread: null,
      });
    });

    it("parses '  Flat  ' with whitespace as 0", () => {
      expect(parseDisplayHeightFt("  Flat  ")).toEqual({
        numericFt: 0,
        rangeSpread: null,
      });
    });
  });

  describe("single-value inputs", () => {
    it("parses '3ft'", () => {
      expect(parseDisplayHeightFt("3ft")).toEqual({
        numericFt: 3,
        rangeSpread: null,
      });
    });

    it("parses '3 ft'", () => {
      expect(parseDisplayHeightFt("3 ft")).toEqual({
        numericFt: 3,
        rangeSpread: null,
      });
    });

    it("parses bare number '3'", () => {
      expect(parseDisplayHeightFt("3")).toEqual({
        numericFt: 3,
        rangeSpread: null,
      });
    });

    it("parses decimal '2.5ft'", () => {
      expect(parseDisplayHeightFt("2.5ft")).toEqual({
        numericFt: 2.5,
        rangeSpread: null,
      });
    });

    it("parses decimal '2.5 ft'", () => {
      expect(parseDisplayHeightFt("2.5 ft")).toEqual({
        numericFt: 2.5,
        rangeSpread: null,
      });
    });

    it("tolerates leading and trailing whitespace", () => {
      expect(parseDisplayHeightFt("  3ft  ")).toEqual({
        numericFt: 3,
        rangeSpread: null,
      });
    });
  });

  describe("range inputs", () => {
    it("parses '3-4ft' as midpoint 3.5 with spread 1", () => {
      expect(parseDisplayHeightFt("3-4ft")).toEqual({
        numericFt: 3.5,
        rangeSpread: 1,
      });
    });

    it("parses '3-4 ft'", () => {
      expect(parseDisplayHeightFt("3-4 ft")).toEqual({
        numericFt: 3.5,
        rangeSpread: 1,
      });
    });

    it("parses '3 - 4 ft' with spaces around dash", () => {
      expect(parseDisplayHeightFt("3 - 4 ft")).toEqual({
        numericFt: 3.5,
        rangeSpread: 1,
      });
    });

    it("parses '3 to 4 ft' word form", () => {
      expect(parseDisplayHeightFt("3 to 4 ft")).toEqual({
        numericFt: 3.5,
        rangeSpread: 1,
      });
    });
  });

  describe("malformed inputs", () => {
    it("returns nulls and warns for 'junk'", () => {
      const result = parseDisplayHeightFt("junk");
      expect(result).toEqual({ numericFt: null, rangeSpread: null });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("[apply-beach-height-offset]");
      expect(warnSpy.mock.calls[0][0]).toContain("junk");
    });

    it("returns nulls and warns for 'abc-def'", () => {
      const result = parseDisplayHeightFt("abc-def");
      expect(result).toEqual({ numericFt: null, rangeSpread: null });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("[apply-beach-height-offset]");
    });

    it("warns at most once per call", () => {
      parseDisplayHeightFt("junk");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe("formatDisplayHeightFt", () => {
  describe("flat / non-finite", () => {
    it("returns 'Flat' for numericFt = 0", () => {
      expect(formatDisplayHeightFt({ numericFt: 0, rangeSpread: null })).toBe(
        "Flat"
      );
    });

    it("returns 'Flat' for negative numericFt", () => {
      expect(
        formatDisplayHeightFt({ numericFt: -1, rangeSpread: null })
      ).toBe("Flat");
    });

    it("returns 'Flat' for NaN numericFt", () => {
      expect(
        formatDisplayHeightFt({ numericFt: Number.NaN, rangeSpread: null })
      ).toBe("Flat");
    });

    it("returns 'Flat' for Infinity numericFt", () => {
      expect(
        formatDisplayHeightFt({
          numericFt: Number.POSITIVE_INFINITY,
          rangeSpread: null,
        })
      ).toBe("Flat");
    });
  });

  describe("single-value (rangeSpread null)", () => {
    it("delegates to formatWaveHeightRange for integer height", () => {
      expect(
        formatDisplayHeightFt({ numericFt: 3, rangeSpread: null })
      ).toBe("3ft");
    });

    it("delegates to formatWaveHeightRange for fractional height", () => {
      // 2.5 -> floor=2, ceil=3 -> "2-3ft" per formatWaveHeightRange
      expect(
        formatDisplayHeightFt({ numericFt: 2.5, rangeSpread: null })
      ).toBe("2-3ft");
    });
  });

  describe("range (rangeSpread provided)", () => {
    it("preserves range shape: midpoint 3.5, spread 1 -> '3-4ft'", () => {
      // low = 3, high = 4, floor=3, ceil=4
      expect(
        formatDisplayHeightFt({ numericFt: 3.5, rangeSpread: 1 })
      ).toBe("3-4ft");
    });

    it("preserves range shape after correction: midpoint 3.0, spread 1 -> '2-4ft'", () => {
      // low = 2.5, high = 3.5, floor=2, ceil=4
      expect(
        formatDisplayHeightFt({ numericFt: 3.0, rangeSpread: 1 })
      ).toBe("2-4ft");
    });

    it("clamps low at 0 when midpoint - spread/2 < 0", () => {
      // midpoint 0.5, spread 1 -> low = max(0, 0) = 0, high = 1 -> "0-1ft"
      expect(
        formatDisplayHeightFt({ numericFt: 0.5, rangeSpread: 1 })
      ).toBe("0-1ft");
    });

    it("returns 'Flat' for non-positive midpoint regardless of spread", () => {
      // midpoint <= 0 short-circuits to Flat
      expect(
        formatDisplayHeightFt({ numericFt: 0, rangeSpread: 2 })
      ).toBe("Flat");
    });
  });
});

describe("applyBeachHeightOffset", () => {
  const baseArgs = {
    heightFt: 5,
    offsetM: 0.3,
    sampleCount: 50,
    enabled: true,
    forecastHorizonHours: 48,
    computedAt: new Date("2026-05-01T00:00:00Z"),
    maeBeforeM: 0.45,
    maeAfterM: 0.18,
    now: new Date("2026-05-01T12:00:00Z"),
  };

  describe("happy path", () => {
    it("applies positive offset of 0.3m to heightFt 5", () => {
      const result = applyBeachHeightOffset(baseArgs);
      const expected = 5 - 0.3 * METERS_TO_FEET;
      expect(result).toBeCloseTo(expected, 5);
    });

    it("negative offset raises forecast", () => {
      const result = applyBeachHeightOffset({ ...baseArgs, offsetM: -0.2 });
      const expected = 5 - -0.2 * METERS_TO_FEET;
      expect(result).toBeCloseTo(expected, 5);
      expect(result).toBeGreaterThan(5);
    });

    it("clamps to 0 when offset > heightFt", () => {
      const result = applyBeachHeightOffset({
        ...baseArgs,
        heightFt: 0.5,
        offsetM: 1.0, // ~3.28 ft, way more than 0.5 ft heightFt
      });
      expect(result).toBe(0);
    });
  });

  describe("gates - return original heightFt", () => {
    it("disabled flag returns original", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, enabled: false })
      ).toBe(5);
    });

    it("offsetM null returns original", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, offsetM: null })
      ).toBe(5);
    });

    it("offsetM undefined returns original", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, offsetM: undefined })
      ).toBe(5);
    });

    it("offsetM NaN returns original", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, offsetM: Number.NaN })
      ).toBe(5);
    });

    it("offsetM Infinity returns original", () => {
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          offsetM: Number.POSITIVE_INFINITY,
        })
      ).toBe(5);
    });

    it("sampleCount null returns original", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, sampleCount: null })
      ).toBe(5);
    });

    it("sampleCount below default min (30) returns original", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, sampleCount: 29 })
      ).toBe(5);
    });

    it("sampleCount below custom minSampleCount returns original", () => {
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          sampleCount: 49,
          minSampleCount: 50,
        })
      ).toBe(5);
    });

    it("forecastHorizonHours below default (24) returns original (Gap #4)", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, forecastHorizonHours: 12 })
      ).toBe(5);
    });

    it("forecastHorizonHours below custom minHorizonHours returns original", () => {
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          forecastHorizonHours: 36,
          minHorizonHours: 48,
        })
      ).toBe(5);
    });

    it("computedAt null returns original (Gap #3)", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, computedAt: null })
      ).toBe(5);
    });

    it("computedAt older than maxOffsetAgeDays returns original (Gap #3)", () => {
      // Default maxOffsetAgeDays = 14; set computedAt 15 days before now
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          computedAt: new Date("2026-04-15T00:00:00Z"),
          now: new Date("2026-05-01T00:00:00Z"),
        })
      ).toBe(5);
    });

    it("computedAt within maxOffsetAgeDays does NOT trigger gate", () => {
      // 13 days old - within 14d default
      const result = applyBeachHeightOffset({
        ...baseArgs,
        computedAt: new Date("2026-04-18T00:00:00Z"),
        now: new Date("2026-05-01T00:00:00Z"),
      });
      // Should apply offset (not return 5 unchanged)
      expect(result).not.toBe(5);
    });

    it("custom maxOffsetAgeDays gate", () => {
      // 8 days old, custom max 7
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          computedAt: new Date("2026-04-23T00:00:00Z"),
          now: new Date("2026-05-01T00:00:00Z"),
          maxOffsetAgeDays: 7,
        })
      ).toBe(5);
    });

    it("computedAt as ISO string is supported", () => {
      const result = applyBeachHeightOffset({
        ...baseArgs,
        computedAt: "2026-04-30T00:00:00Z",
        now: new Date("2026-05-01T00:00:00Z"),
      });
      expect(result).not.toBe(5); // gate passed, offset applied
    });

    it("maeBeforeM null returns original (Gap #3)", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, maeBeforeM: null })
      ).toBe(5);
    });

    it("maeAfterM null returns original (Gap #3)", () => {
      expect(
        applyBeachHeightOffset({ ...baseArgs, maeAfterM: null })
      ).toBe(5);
    });

    it("maeAfterM equal to maeBeforeM (no improvement) returns original", () => {
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          maeBeforeM: 0.3,
          maeAfterM: 0.3,
        })
      ).toBe(5);
    });

    it("maeAfterM greater than maeBeforeM (regression) returns original", () => {
      expect(
        applyBeachHeightOffset({
          ...baseArgs,
          maeBeforeM: 0.2,
          maeAfterM: 0.3,
        })
      ).toBe(5);
    });
  });

  describe("non-finite heightFt passthrough", () => {
    it("NaN heightFt returns NaN unchanged", () => {
      const result = applyBeachHeightOffset({
        ...baseArgs,
        heightFt: Number.NaN,
      });
      expect(result).toBeNaN();
    });

    it("Infinity heightFt returns Infinity unchanged", () => {
      const result = applyBeachHeightOffset({
        ...baseArgs,
        heightFt: Number.POSITIVE_INFINITY,
      });
      expect(result).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe("parser/formatter round-trip", () => {
    it("'3-4ft' input with 0.5ft-equivalent offset rounds to '2-4ft'", () => {
      // parser: "3-4ft" -> midpoint 3.5, spread 1
      const parsed = parseDisplayHeightFt("3-4ft");
      expect(parsed).toEqual({ numericFt: 3.5, rangeSpread: 1 });

      // apply offset: 0.5/METERS_TO_FEET ~= 0.1524 m so corrected mid = 3.5 - 0.5 = 3.0
      const offsetM = 0.5 / METERS_TO_FEET;
      const correctedMid = applyBeachHeightOffset({
        ...baseArgs,
        heightFt: parsed.numericFt!,
        offsetM,
      });
      expect(correctedMid).toBeCloseTo(3.0, 5);

      // re-emit: midpoint 3.0, spread 1 -> low = 2.5, high = 3.5 -> floor 2, ceil 4
      const formatted = formatDisplayHeightFt({
        numericFt: correctedMid,
        rangeSpread: parsed.rangeSpread,
      });
      expect(formatted).toBe("2-4ft");
    });
  });
});
