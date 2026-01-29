import {
  parseWaveHeight,
  formatWaveHeight,
  getWaveHeightValue,
  toFaceHeightFeet,
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
});
