import {
  parseWaveHeight,
  formatWaveHeight,
  getWaveHeightValue,
  toFaceHeightFeet,
  formatWaveHeightRangeString,
  toFaceHeightRangeFeet,
  extractNumericWaveHeight,
  selectWaveHeightSource,
  roundWaveHeight,
  clampWaveHeight,
  WAVE_HEIGHT_NUMBER_PATTERN,
} from "@/lib/utils/wave-height-formatter";
import { TERRAIN_BINS } from "@/types/terrain";

describe("Wave Height Formatter", () => {
  describe("parseWaveHeight", () => {
    it("should parse numeric values", () => {
      expect(parseWaveHeight(2.5)).toBe(2.5);
      expect(parseWaveHeight(0)).toBe(0);
      expect(parseWaveHeight(10)).toBe(10);
    });

    it("should parse string values", () => {
      expect(parseWaveHeight("4")).toBe(4);
      expect(parseWaveHeight("2.5")).toBe(2.5);
      expect(parseWaveHeight("4 ft")).toBe(4);
      expect(parseWaveHeight("4ft")).toBe(4);
      expect(parseWaveHeight("4.5 ft")).toBe(4.5);
      expect(parseWaveHeight("4-5 ft")).toBe(4); // Gets first number
    });

    it("should handle null/undefined values", () => {
      expect(parseWaveHeight(null)).toBeUndefined();
      expect(parseWaveHeight(undefined)).toBeUndefined();
      expect(parseWaveHeight("")).toBeUndefined();
    });

    it("should handle invalid strings", () => {
      expect(parseWaveHeight("abc")).toBeUndefined();
      expect(parseWaveHeight("no numbers")).toBeUndefined();
      expect(parseWaveHeight("ft")).toBeUndefined();
    });

    it("should handle edge cases", () => {
      expect(parseWaveHeight("0.1")).toBe(0.1);
      expect(parseWaveHeight("15.75")).toBe(15.75);
      expect(parseWaveHeight("  4.5  ")).toBe(4.5);
    });
  });

  describe("formatWaveHeight", () => {
    it("should format small waves", () => {
      expect(formatWaveHeight(0)).toBe("0-1ft");
      expect(formatWaveHeight(0.5)).toBe("0-1ft");
      expect(formatWaveHeight(null)).toBe("0-1ft");
      expect(formatWaveHeight(undefined)).toBe("0-1ft");
    });

    it("should format wave ranges correctly", () => {
      expect(formatWaveHeight(1)).toBe("1-2ft");
      expect(formatWaveHeight(1.5)).toBe("1-2ft");
      expect(formatWaveHeight(2)).toBe("2-3ft");
      expect(formatWaveHeight(2.9)).toBe("2-3ft");
      expect(formatWaveHeight(3)).toBe("3-4ft");
      expect(formatWaveHeight(4)).toBe("4-5ft");
      expect(formatWaveHeight(5)).toBe("5-6ft");
      expect(formatWaveHeight(6)).toBe("6-8ft");
      expect(formatWaveHeight(7)).toBe("6-8ft");
      expect(formatWaveHeight(8)).toBe("8-10ft");
      expect(formatWaveHeight(9)).toBe("8-10ft");
    });

    it("should format large waves", () => {
      expect(formatWaveHeight(10)).toBe("10ft+");
      expect(formatWaveHeight(15)).toBe("15ft+");
      expect(formatWaveHeight(20)).toBe("20ft+");
    });

    it("should format string inputs", () => {
      expect(formatWaveHeight("3")).toBe("3-4ft");
      expect(formatWaveHeight("4 ft")).toBe("4-5ft");
      expect(formatWaveHeight("invalid")).toBe("0-1ft");
    });
  });

  describe("getWaveHeightValue", () => {
    it("should return numeric values from various formats", () => {
      expect(getWaveHeightValue(4)).toBe(4);
      expect(getWaveHeightValue("3.5")).toBe(3.5);
      expect(getWaveHeightValue("4 ft")).toBe(4);
      expect(getWaveHeightValue(null)).toBeUndefined();
      expect(getWaveHeightValue("invalid")).toBeUndefined();
    });

    it("should be consistent with parseWaveHeight", () => {
      const testValues = [2.5, "4", "3.5 ft", null, undefined, "abc"];

      testValues.forEach((value) => {
        expect(getWaveHeightValue(value)).toBe(parseWaveHeight(value));
      });
    });
  });

  describe("toFaceHeightFeet", () => {
    describe("source selection priority", () => {
      it("should prefer CDIP significant height when available", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 2.0,
          modelSwellM: 1.0, // Would be 3.28ft raw
        });
        // 2.0 * 1.6 (shoaling) = 3.2ft
        expect(result).toBe("3.2 ft");
      });

      it("should use model swell when CDIP is outlier (>1.8x model)", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 8.0, // Outlier: 8 > 1.8 * 3.28 = 5.9
          modelSwellM: 1.0, // 3.28ft raw
        });
        // Model swell: 3.28 * 1.6 = 5.25ft, clamped/rounded
        expect(result).toMatch(/\d+\.?\d* ft/);
        expect(parseFloat(result!)).toBeLessThan(8.0); // Should not use CDIP outlier
      });

      it("should fall back to model swell when CDIP unavailable", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: 1.0, // 3.28ft raw
        });
        // 3.28 * 1.6 = 5.25ft
        expect(result).toBe("5.2 ft");
      });

      it("should fall back to CDIP swell when model unavailable", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: 2.0,
        });
        // 2.0 * 1.6 = 3.2ft
        expect(result).toBe("3.2 ft");
      });

      it("should fall back to model Hs as last resort", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: null,
          modelHsM: 0.5, // 1.64ft raw
        });
        // 1.64 * 1.6 = 2.62ft
        expect(result).toMatch(/\d+\.?\d* ft/);
      });

      it("should return null when no sources available", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: null,
          modelHsM: null,
        });
        expect(result).toBeNull();
      });

      it("should use NDBC buoy as final fallback with transformation", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: null,
          modelHsM: null,
          ndbcBuoyM: 0.8, // 2.62ft raw → 2.62 * 1.6 = 4.2ft face
        });
        // NDBC buoy should be transformed, not returned raw
        expect(result).toMatch(/\d+\.?\d* ft/);
        const faceHeight = parseFloat(result!);
        // 0.8m = 2.62ft raw, × 1.6 shoaling = 4.2ft
        expect(faceHeight).toBeGreaterThan(2.62); // Must be transformed
        expect(faceHeight).toBeCloseTo(4.2, 0); // Should be ~4.2ft
      });
    });

    describe("transformation with period", () => {
      it("should amplify for long period swells", () => {
        const shortPeriod = toFaceHeightFeet({
          cdipSigFt: 2.0,
          periodS: 8,
        });
        const longPeriod = toFaceHeightFeet({
          cdipSigFt: 2.0,
          periodS: 16,
        });
        // Long period should produce higher face height
        expect(parseFloat(longPeriod!)).toBeGreaterThan(parseFloat(shortPeriod!));
      });
    });

    describe("transformation with beach terrain", () => {
      const createMockBeach = (accessValue: number) => ({
        terrain_enabled: true,
        swell_access_factors: Array(TERRAIN_BINS).fill(accessValue),
      });

      it("should apply direction factor when terrain enabled", () => {
        const fullAccess = toFaceHeightFeet({
          cdipSigFt: 2.0,
          periodS: 10,
          swellDirectionDeg: 180,
          beach: createMockBeach(1.0),
        });
        const noAccess = toFaceHeightFeet({
          cdipSigFt: 2.0,
          periodS: 10,
          swellDirectionDeg: 180,
          beach: createMockBeach(0.0),
        });
        // Full access should produce higher face height
        expect(parseFloat(fullAccess!)).toBeGreaterThan(parseFloat(noAccess!));
      });

      it("should ignore terrain when not enabled", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 2.0,
          periodS: 10,
          swellDirectionDeg: 180,
          beach: {
            terrain_enabled: false,
            swell_access_factors: Array(TERRAIN_BINS).fill(0.0),
          },
        });
        // Without terrain, 2.0 * 1.6 = 3.2
        expect(result).toBe("3.2 ft");
      });
    });

    describe("clamping", () => {
      it("should clamp minimum to 0.5ft", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 0.1, // Would be 0.16ft after transform
        });
        expect(parseFloat(result!)).toBeGreaterThanOrEqual(0.5);
      });

      it("should clamp maximum to 15ft", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 10.0,
          periodS: 20, // Max period factor 1.4
        });
        // 10 * 1.6 * 1.4 = 22.4, clamped to 15
        expect(parseFloat(result!)).toBeLessThanOrEqual(15);
      });
    });

    describe("edge cases", () => {
      it("should handle NaN inputs gracefully", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: NaN,
          modelSwellM: 1.0,
        });
        // Should fall back to model swell
        expect(result).toMatch(/\d+\.?\d* ft/);
      });

      it("should handle Infinity inputs gracefully", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: Infinity,
          modelSwellM: 1.0,
        });
        // Should fall back to model swell (Infinity fails isFinite check)
        expect(result).toMatch(/\d+\.?\d* ft/);
      });
    });
  });

  describe("formatWaveHeightRangeString", () => {
    it("should format typical wave ranges with integers", () => {
      // 3.2ft avg, 4.8ft sets -> "3-5ft"
      expect(formatWaveHeightRangeString(3.2, 4.8)).toBe("3-5ft");
      // 2.0ft avg, 3.0ft sets -> "2-3ft"
      expect(formatWaveHeightRangeString(2.0, 3.0)).toBe("2-3ft");
      // 4.5ft avg, 6.75ft sets -> "5-7ft"
      expect(formatWaveHeightRangeString(4.5, 6.75)).toBe("5-7ft");
    });

    it("should use half-foot precision for small ranges", () => {
      // When range < 1ft, use half-foot precision
      // 1.2 rounds to 1, 1.8 rounds to 2
      expect(formatWaveHeightRangeString(1.2, 1.8)).toBe("1-2ft");
      // 0.8 and 1.2 both round to 1, so single value
      expect(formatWaveHeightRangeString(0.8, 1.2)).toBe("1ft");
    });

    it("should return single value when low and high round to same", () => {
      // Both are exactly 2
      expect(formatWaveHeightRangeString(2.0, 2.0)).toBe("2ft");
      // 1.8 rounds to 2, 2.2 rounds to 2
      expect(formatWaveHeightRangeString(1.8, 2.2)).toBe("2ft");
    });

    it("should handle small waves with half-foot precision", () => {
      // 0.5 stays 0.5, 0.75 rounds to 1
      expect(formatWaveHeightRangeString(0.5, 0.75)).toBe("0.5-1ft");
      // 1.0 stays 1, 1.5 stays 1.5
      expect(formatWaveHeightRangeString(1.0, 1.5)).toBe("1-1.5ft");
    });

    it("should handle large waves with integers", () => {
      // 8ft avg, 12ft sets -> "8-12ft"
      expect(formatWaveHeightRangeString(8, 12)).toBe("8-12ft");
      // 10ft avg, 15ft sets -> "10-15ft"
      expect(formatWaveHeightRangeString(10, 15)).toBe("10-15ft");
    });

    it("should handle realistic Surfline-style ranges", () => {
      // Real example: 3.2ft average × 1.5 = 4.8ft sets
      expect(formatWaveHeightRangeString(3.2, 3.2 * 1.5)).toBe("3-5ft");
      // 2.5ft average × 1.5 = 3.75ft sets
      expect(formatWaveHeightRangeString(2.5, 2.5 * 1.5)).toBe("3-4ft");
      // 5ft average × 1.5 = 7.5ft sets
      expect(formatWaveHeightRangeString(5, 5 * 1.5)).toBe("5-8ft");
    });
  });

  describe("extractNumericWaveHeight", () => {
    it("should extract integers from strings", () => {
      expect(extractNumericWaveHeight("4")).toBe(4);
      expect(extractNumericWaveHeight("10ft")).toBe(10);
      expect(extractNumericWaveHeight("5 ft")).toBe(5);
    });

    it("should extract decimals from strings", () => {
      expect(extractNumericWaveHeight("3.5")).toBe(3.5);
      expect(extractNumericWaveHeight("2.75 ft")).toBe(2.75);
      expect(extractNumericWaveHeight("0.5ft")).toBe(0.5);
    });

    it("should extract first number from range strings", () => {
      expect(extractNumericWaveHeight("3-5ft")).toBe(3);
      expect(extractNumericWaveHeight("2.5-4ft")).toBe(2.5);
    });

    it("should return null for strings without numbers", () => {
      expect(extractNumericWaveHeight("abc")).toBeNull();
      expect(extractNumericWaveHeight("ft")).toBeNull();
      expect(extractNumericWaveHeight("")).toBeNull();
    });

    it("should handle edge cases", () => {
      expect(extractNumericWaveHeight("  4.5  ")).toBe(4.5);
      expect(extractNumericWaveHeight("test 3.2 value")).toBe(3.2);
    });
  });

  describe("roundWaveHeight", () => {
    it("should round to 1 decimal place", () => {
      expect(roundWaveHeight(3.24)).toBe(3.2);
      expect(roundWaveHeight(3.25)).toBe(3.3);
      expect(roundWaveHeight(3.26)).toBe(3.3);
    });

    it("should handle whole numbers", () => {
      expect(roundWaveHeight(5.0)).toBe(5);
      expect(roundWaveHeight(10)).toBe(10);
    });

    it("should handle small values", () => {
      expect(roundWaveHeight(0.14)).toBe(0.1);
      expect(roundWaveHeight(0.15)).toBe(0.2);
      expect(roundWaveHeight(0.16)).toBe(0.2);
    });
  });

  describe("clampWaveHeight", () => {
    it("should clamp values below minimum (0.5ft)", () => {
      expect(clampWaveHeight(0.1)).toBe(0.5);
      expect(clampWaveHeight(0.3)).toBe(0.5);
      expect(clampWaveHeight(0)).toBe(0.5);
      expect(clampWaveHeight(-1)).toBe(0.5);
    });

    it("should clamp values above maximum (15ft)", () => {
      expect(clampWaveHeight(16)).toBe(15);
      expect(clampWaveHeight(20)).toBe(15);
      expect(clampWaveHeight(100)).toBe(15);
    });

    it("should not clamp values within range", () => {
      expect(clampWaveHeight(0.5)).toBe(0.5);
      expect(clampWaveHeight(5)).toBe(5);
      expect(clampWaveHeight(15)).toBe(15);
    });
  });

  describe("selectWaveHeightSource", () => {
    it("should prefer CDIP significant height", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: 3.0,
        cdipSwellFt: 2.0,
        modelSwellM: 1.0,
        modelHsM: 0.5,
      });
      expect(result).toEqual({ heightFt: 3.0, source: "cdip_sig" });
    });

    it("should fall back to model swell when CDIP unavailable", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: 1.0, // 3.28ft
      });
      expect(result?.source).toBe("model_swell");
      expect(result?.heightFt).toBeCloseTo(3.28, 1);
    });

    it("should use model swell when CDIP is outlier", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: 10.0, // > 1.8 * 3.28 = 5.9
        modelSwellM: 1.0,
      });
      expect(result?.source).toBe("model_swell");
    });

    it("should reject untrusted high CDIP values", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: 12.0, // > 10ft threshold
        modelSwellM: 2.0,
      });
      expect(result?.source).toBe("model_swell");
    });

    it("should fall back to CDIP swell when model unavailable", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: 2.5,
      });
      expect(result).toEqual({ heightFt: 2.5, source: "cdip_swell" });
    });

    it("should fall back to model Hs as last resort", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: null,
        modelHsM: 0.5, // 1.64ft
      });
      expect(result?.source).toBe("model_hs");
      expect(result?.heightFt).toBeCloseTo(1.64, 1);
    });

    it("should return null when no sources available", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: null,
        modelHsM: null,
      });
      expect(result).toBeNull();
    });

    it("should handle NaN and invalid values", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: NaN,
        modelSwellM: 1.0,
      });
      expect(result?.source).toBe("model_swell");
    });

    it("should fall back to NDBC buoy when all other sources unavailable", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: null,
        modelHsM: null,
        ndbcBuoyM: 0.8, // 2.62ft
      });
      expect(result?.source).toBe("ndbc_buoy");
      expect(result?.heightFt).toBeCloseTo(2.62, 1);
    });

    it("should prefer model Hs over NDBC buoy", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: null,
        modelHsM: 0.5, // 1.64ft
        ndbcBuoyM: 0.8, // 2.62ft
      });
      expect(result?.source).toBe("model_hs");
    });

    it("should return null when no sources including NDBC are available", () => {
      const result = selectWaveHeightSource({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: null,
        modelHsM: null,
        ndbcBuoyM: null,
      });
      expect(result).toBeNull();
    });
  });

  describe("WAVE_HEIGHT_NUMBER_PATTERN", () => {
    it("should match integers", () => {
      expect("4".match(WAVE_HEIGHT_NUMBER_PATTERN)?.[1]).toBe("4");
      expect("10ft".match(WAVE_HEIGHT_NUMBER_PATTERN)?.[1]).toBe("10");
    });

    it("should match decimals", () => {
      expect("3.5".match(WAVE_HEIGHT_NUMBER_PATTERN)?.[1]).toBe("3.5");
      expect("2.75 ft".match(WAVE_HEIGHT_NUMBER_PATTERN)?.[1]).toBe("2.75");
    });

    it("should not match non-numeric strings", () => {
      expect("abc".match(WAVE_HEIGHT_NUMBER_PATTERN)).toBeNull();
      expect("ft".match(WAVE_HEIGHT_NUMBER_PATTERN)).toBeNull();
    });
  });

  describe("toFaceHeightRangeFeet", () => {
    it("should return range string for valid input", () => {
      const result = toFaceHeightRangeFeet({
        cdipSigFt: 2.0,
        periodS: 10,
      });
      // 2.0 * 1.6 = 3.2ft average, × 1.5 = 4.8ft sets -> "3-5ft"
      expect(result).toBe("3-5ft");
    });

    it("should return null when no data available", () => {
      const result = toFaceHeightRangeFeet({
        cdipSigFt: null,
        modelSwellM: null,
        cdipSwellFt: null,
        modelHsM: null,
      });
      expect(result).toBeNull();
    });

    it("should apply period amplification to range", () => {
      const shortPeriod = toFaceHeightRangeFeet({
        cdipSigFt: 2.0,
        periodS: 8,
      });
      const longPeriod = toFaceHeightRangeFeet({
        cdipSigFt: 2.0,
        periodS: 16,
      });
      // Long period should produce larger range
      expect(shortPeriod).not.toBe(longPeriod);
    });

    it("should use model swell when CDIP unavailable", () => {
      const result = toFaceHeightRangeFeet({
        cdipSigFt: null,
        modelSwellM: 1.0, // 3.28ft raw
        periodS: 10,
      });
      // 3.28 * 1.6 = 5.25ft, × 1.5 = 7.87ft -> "5-8ft"
      expect(result).toMatch(/\d+-\d+ft/);
    });

    it("should apply beach terrain direction factor", () => {
      const fullAccess = toFaceHeightRangeFeet({
        cdipSigFt: 2.0,
        periodS: 10,
        swellDirectionDeg: 180,
        beach: {
          terrain_enabled: true,
          swell_access_factors: Array(72).fill(1.0),
        },
      });
      const noAccess = toFaceHeightRangeFeet({
        cdipSigFt: 2.0,
        periodS: 10,
        swellDirectionDeg: 180,
        beach: {
          terrain_enabled: true,
          swell_access_factors: Array(72).fill(0.0),
        },
      });
      // Full access should produce larger range
      expect(fullAccess).not.toBe(noAccess);
    });
  });
});
