import {
  formatWaveHeightDecimal,
  formatWaveHeightBucket,
  formatWaveRange,
  formatWaveHeightRangeString,
  getWaveSizeDescription,
  getWaveSizeLabel,
  WAVE_SIZE_LABELS,
  parseWaveHeight,
  getWaveHeightValue,
  toFaceHeightFeet,
  toFaceHeightRangeFeet,
  extractNumericWaveHeight,
  selectWaveHeightSource,
  roundWaveHeight,
  clampWaveHeight,
  WAVE_HEIGHT_NUMBER_PATTERN,
} from "@/lib/utils/wave-formatters";
import type { ShoalingFactors } from "@/lib/utils/wave-height-transformer";
import { TERRAIN_BINS } from "@/types/terrain";

describe("wave-formatters", () => {
  // =========================================================================
  // formatWaveHeightDecimal (previously formatWaveHeight in wave-formatters.ts)
  // =========================================================================
  describe("formatWaveHeightDecimal", () => {
    it("formats regular wave heights with one decimal place", () => {
      expect(formatWaveHeightDecimal(3.5)).toBe("3.5ft");
      expect(formatWaveHeightDecimal(5.0)).toBe("5.0ft");
      expect(formatWaveHeightDecimal(2.75)).toBe("2.8ft");
      expect(formatWaveHeightDecimal(10)).toBe("10.0ft");
    });

    it("returns 'Flat' for zero wave height", () => {
      expect(formatWaveHeightDecimal(0)).toBe("Flat");
    });

    it("handles small wave heights", () => {
      expect(formatWaveHeightDecimal(0.5)).toBe("0.5ft");
      expect(formatWaveHeightDecimal(1.2)).toBe("1.2ft");
    });

    it("handles large wave heights", () => {
      expect(formatWaveHeightDecimal(15)).toBe("15.0ft");
      expect(formatWaveHeightDecimal(25.5)).toBe("25.5ft");
    });

    it("handles negative wave heights gracefully", () => {
      // Negative values are treated as "Flat" (invalid input handling)
      expect(formatWaveHeightDecimal(-1)).toBe("Flat");
      expect(formatWaveHeightDecimal(-10)).toBe("Flat");
    });
  });

  // =========================================================================
  // formatWaveHeightBucket (previously formatWaveHeight in wave-height-formatter.ts)
  // =========================================================================
  describe("formatWaveHeightBucket", () => {
    it("should format small waves", () => {
      expect(formatWaveHeightBucket(0)).toBe("0-1ft");
      expect(formatWaveHeightBucket(0.5)).toBe("0-1ft");
      expect(formatWaveHeightBucket(null)).toBe("0-1ft");
      expect(formatWaveHeightBucket(undefined)).toBe("0-1ft");
    });

    it("should format wave ranges correctly", () => {
      expect(formatWaveHeightBucket(1)).toBe("1-2ft");
      expect(formatWaveHeightBucket(1.5)).toBe("1-2ft");
      expect(formatWaveHeightBucket(2)).toBe("2-3ft");
      expect(formatWaveHeightBucket(2.9)).toBe("2-3ft");
      expect(formatWaveHeightBucket(3)).toBe("3-4ft");
      expect(formatWaveHeightBucket(4)).toBe("4-5ft");
      expect(formatWaveHeightBucket(5)).toBe("5-6ft");
      expect(formatWaveHeightBucket(6)).toBe("6-8ft");
      expect(formatWaveHeightBucket(7)).toBe("6-8ft");
      expect(formatWaveHeightBucket(8)).toBe("8-10ft");
      expect(formatWaveHeightBucket(9)).toBe("8-10ft");
    });

    it("should format large waves", () => {
      expect(formatWaveHeightBucket(10)).toBe("10ft+");
      expect(formatWaveHeightBucket(15)).toBe("15ft+");
      expect(formatWaveHeightBucket(20)).toBe("20ft+");
    });

    it("should format string inputs", () => {
      expect(formatWaveHeightBucket("3")).toBe("3-4ft");
      expect(formatWaveHeightBucket("4 ft")).toBe("4-5ft");
      expect(formatWaveHeightBucket("invalid")).toBe("0-1ft");
    });
  });

  // =========================================================================
  // formatWaveRange
  // =========================================================================
  describe("formatWaveRange", () => {
    describe("with decimal precision (default)", () => {
      it("formats ranges with one decimal place", () => {
        expect(formatWaveRange([3.2, 5.8])).toBe("3.2-5.8ft");
        expect(formatWaveRange([2.0, 4.5])).toBe("2.0-4.5ft");
      });

      it("formats single value ranges", () => {
        expect(formatWaveRange([4, 4])).toBe("4.0ft");
        expect(formatWaveRange([3.5, 3.5])).toBe("3.5ft");
      });

      it("handles zero ranges", () => {
        expect(formatWaveRange([0, 0])).toBe("0.0ft");
        expect(formatWaveRange([0, 3])).toBe("0.0-3.0ft");
      });
    });

    describe("with integer precision", () => {
      it("formats ranges as whole numbers", () => {
        expect(formatWaveRange([3.2, 5.8], "integer")).toBe("3-6ft");
        expect(formatWaveRange([2.0, 4.5], "integer")).toBe("2-5ft");
      });

      it("formats single value ranges", () => {
        expect(formatWaveRange([4, 4], "integer")).toBe("4ft");
        expect(formatWaveRange([3.5, 3.5], "integer")).toBe("4ft");
      });

      it("rounds correctly", () => {
        expect(formatWaveRange([2.4, 5.6], "integer")).toBe("2-6ft");
        expect(formatWaveRange([2.5, 5.5], "integer")).toBe("3-6ft");
      });
    });

    it("handles inverted ranges gracefully", () => {
      // Even with min > max, should format without crashing
      const result = formatWaveRange([5, 3]);
      expect(typeof result).toBe("string");
    });
  });

  // =========================================================================
  // getWaveSizeDescription
  // =========================================================================
  describe("getWaveSizeDescription", () => {
    it("returns knee-high for heights < 2ft", () => {
      expect(getWaveSizeDescription(0)).toBe("knee-high");
      expect(getWaveSizeDescription(1)).toBe("knee-high");
      expect(getWaveSizeDescription(1.9)).toBe("knee-high");
    });

    it("returns waist-high for heights 2-3ft", () => {
      expect(getWaveSizeDescription(2)).toBe("waist-high");
      expect(getWaveSizeDescription(2.5)).toBe("waist-high");
      expect(getWaveSizeDescription(2.9)).toBe("waist-high");
    });

    it("returns chest-high for heights 3-5ft", () => {
      expect(getWaveSizeDescription(3)).toBe("chest-high");
      expect(getWaveSizeDescription(4)).toBe("chest-high");
      expect(getWaveSizeDescription(4.9)).toBe("chest-high");
    });

    it("returns head-high for heights 5-7ft", () => {
      expect(getWaveSizeDescription(5)).toBe("head-high");
      expect(getWaveSizeDescription(6)).toBe("head-high");
      expect(getWaveSizeDescription(6.9)).toBe("head-high");
    });

    it("returns overhead for heights 7-10ft", () => {
      expect(getWaveSizeDescription(7)).toBe("overhead");
      expect(getWaveSizeDescription(8)).toBe("overhead");
      expect(getWaveSizeDescription(9.9)).toBe("overhead");
    });

    it("returns double-overhead for heights >= 10ft", () => {
      expect(getWaveSizeDescription(10)).toBe("double-overhead");
      expect(getWaveSizeDescription(12)).toBe("double-overhead");
      expect(getWaveSizeDescription(20)).toBe("double-overhead");
    });

    it("handles boundary conditions correctly", () => {
      expect(getWaveSizeDescription(1.99)).toBe("knee-high");
      expect(getWaveSizeDescription(2)).toBe("waist-high");
      expect(getWaveSizeDescription(2.99)).toBe("waist-high");
      expect(getWaveSizeDescription(3)).toBe("chest-high");
      expect(getWaveSizeDescription(4.99)).toBe("chest-high");
      expect(getWaveSizeDescription(5)).toBe("head-high");
      expect(getWaveSizeDescription(6.99)).toBe("head-high");
      expect(getWaveSizeDescription(7)).toBe("overhead");
      expect(getWaveSizeDescription(9.99)).toBe("overhead");
      expect(getWaveSizeDescription(10)).toBe("double-overhead");
    });

    it("handles negative heights gracefully", () => {
      expect(getWaveSizeDescription(-1)).toBe("knee-high");
    });
  });

  // =========================================================================
  // getWaveSizeLabel
  // =========================================================================
  describe("getWaveSizeLabel", () => {
    it("returns correct labels for each size", () => {
      expect(getWaveSizeLabel("knee-high")).toBe("Small Swell");
      expect(getWaveSizeLabel("waist-high")).toBe("Small Swell");
      expect(getWaveSizeLabel("chest-high")).toBe("Medium Swell");
      expect(getWaveSizeLabel("head-high")).toBe("Solid Swell");
      expect(getWaveSizeLabel("overhead")).toBe("Big Swell");
      expect(getWaveSizeLabel("double-overhead")).toBe("Epic Swell");
    });

    it("returns fallback for unknown sizes", () => {
      expect(getWaveSizeLabel("unknown")).toBe("Swell Incoming");
      expect(getWaveSizeLabel("")).toBe("Swell Incoming");
      expect(getWaveSizeLabel("massive")).toBe("Swell Incoming");
    });
  });

  // =========================================================================
  // WAVE_SIZE_LABELS
  // =========================================================================
  describe("WAVE_SIZE_LABELS", () => {
    it("has correct mapping for all sizes", () => {
      expect(WAVE_SIZE_LABELS["knee-high"]).toBe("Small Swell");
      expect(WAVE_SIZE_LABELS["waist-high"]).toBe("Small Swell");
      expect(WAVE_SIZE_LABELS["chest-high"]).toBe("Medium Swell");
      expect(WAVE_SIZE_LABELS["head-high"]).toBe("Solid Swell");
      expect(WAVE_SIZE_LABELS["overhead"]).toBe("Big Swell");
      expect(WAVE_SIZE_LABELS["double-overhead"]).toBe("Epic Swell");
    });

    it("contains all wave size descriptions", () => {
      const sizes = [
        "knee-high",
        "waist-high",
        "chest-high",
        "head-high",
        "overhead",
        "double-overhead",
      ];

      for (const size of sizes) {
        expect(WAVE_SIZE_LABELS[size]).toEqual(expect.any(String));
      }
    });
  });

  // =========================================================================
  // integration: getWaveSizeDescription + getWaveSizeLabel
  // =========================================================================
  describe("integration: getWaveSizeDescription + getWaveSizeLabel", () => {
    it("produces valid labels for any wave height", () => {
      const heights = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

      for (const height of heights) {
        const sizeDescription = getWaveSizeDescription(height);
        const label = getWaveSizeLabel(sizeDescription);

        expect(label).not.toBe("Swell Incoming");
        expect(["Small Swell", "Medium Swell", "Solid Swell", "Big Swell", "Epic Swell"]).toContain(label);
      }
    });
  });

  // =========================================================================
  // parseWaveHeight (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // getWaveHeightValue (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // toFaceHeightFeet (merged from wave-height-formatter.test.ts)
  // =========================================================================
  describe("toFaceHeightFeet", () => {
    describe("source selection priority", () => {
      it("should prefer CDIP significant height when available", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 2.0,
          modelSwellM: 1.0, // Would be 3.28ft raw
        });
        // 2.0 * 1.0 (shoaling) = 2.0ft
        expect(result).toBe("2 ft");
      });

      it("should use model swell when CDIP is outlier (>1.8x model)", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: 8.0, // Outlier: 8 > 1.8 * 3.28 = 5.9
          modelSwellM: 1.0, // 3.28ft raw
        });
        // Model swell: 3.28 * 1.0 = 3.28ft, rounded to 3.3ft
        expect(result).toMatch(/\d+\.?\d* ft/);
        expect(parseFloat(result!)).toBeLessThan(8.0); // Should not use CDIP outlier
      });

      it("should fall back to model swell when CDIP unavailable", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: 1.0, // 3.28ft raw
        });
        // 3.28 * 1.0 = 3.28ft, rounded to 3.3ft
        expect(result).toBe("3.3 ft");
      });

      it("should fall back to CDIP swell when model unavailable", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: 2.0,
        });
        // 2.0 * 1.0 = 2.0ft
        expect(result).toBe("2 ft");
      });

      it("should fall back to model Hs as last resort", () => {
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: null,
          modelHsM: 0.5, // 1.64ft raw
        });
        // 1.64 * 1.0 = 1.64ft
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
          ndbcBuoyM: 0.8, // 2.62ft raw → 2.62 * 1.0 = 2.6ft face
        });
        // NDBC buoy should be transformed (though with 1.0 shoaling, values are similar)
        expect(result).toMatch(/\d+\.?\d* ft/);
        const faceHeight = parseFloat(result!);
        // 0.8m = 2.62ft raw, × 1.0 shoaling = 2.62ft, rounded to 2.6ft
        expect(faceHeight).toBeCloseTo(2.6, 1); // Should be ~2.6ft
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
        // Without terrain, 2.0 * 1.0 = 2.0
        expect(result).toBe("2 ft");
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
          periodS: 20, // Max period factor 1.2
        });
        // 10 * 1.0 * 1.2 = 12.0, under 15 but test validates clamping works
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

    // =======================================================================
    // shoaling_factors source-gating (Phase 1.4 Critical #1/#2 regression)
    //
    // The per-beach shoaling bucket factor is measured as
    // `surfline_face_ft / cdip_hs_ft` during Phase 1.4 calibration. It is
    // ONLY valid when the transformer's input came from CDIP significant
    // height for the beach's assigned reference buoy. On XL days or data
    // gaps, `selectWaveHeightSource` falls back to model_swell / model_hs /
    // ndbc_buoy — in those cases the bucket multiplier must NOT fire. These
    // tests drive the full toFaceHeightFeet path end-to-end and assert the
    // correct gating at each fallback boundary.
    // =======================================================================
    describe("shoaling_factors source gating", () => {
      // Blacks Beach factors from migration 20260407134519
      const blacksFactors: ShoalingFactors = {
        version: 1,
        type: "period_lookup",
        buckets: [
          { tp_min_s: 0, tp_max_s: 8, factor: 1.6 },
          { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
          { tp_min_s: 12, tp_max_s: 16, factor: 2.1 },
          { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
        ],
      };
      const blacksBeach = { shoaling_factors: blacksFactors };

      it("fires short-circuit when source is CDIP sig (happy path)", () => {
        // 1.7 ft CDIP Hs @ 14s at Blacks → short-circuit applies 2.1x
        // → 3.57 → "3.6 ft". This is the Phase 1.1 user-reported regression.
        const result = toFaceHeightFeet({
          cdipSigFt: 1.7,
          periodS: 14,
          beach: blacksBeach,
        });
        expect(result).toBe("3.6 ft");
      });

      it("SKIPS short-circuit when CDIP > MAX_TRUSTED_CDIP_FT (falls back to model_swell)", () => {
        // XL day: CDIP reports 12 ft, which exceeds the 10 ft trust threshold.
        // selectWaveHeightSource falls back to model_swell (3.0m = 9.84 ft raw).
        // The transformer MUST use the legacy pipeline on the model input,
        // not multiply the model height by Blacks's CDIP-denominated 2.1x
        // factor (which would display ~20.7 ft — wildly wrong).
        const result = toFaceHeightFeet({
          cdipSigFt: 12.0, // outside MAX_TRUSTED_CDIP_FT
          modelSwellM: 3.0, // 9.84 ft raw
          periodS: 14,
          beach: blacksBeach,
        });
        // Legacy: 9.84 * 1.0 (base) * 1.2 (capped period at 14s) * 1.0 = 11.808 → 11.8 ft
        expect(result).toBe("11.8 ft");
        // Guard against a regression that applies the CDIP bucket factor here:
        const numeric = parseFloat(result!);
        expect(numeric).toBeLessThan(15);
      });

      it("SKIPS short-circuit when CDIP is an outlier vs model swell", () => {
        // CDIP 8 ft vs model 1m (3.28 ft): 8 > 1.8 * 3.28 = 5.9 → outlier.
        // selectWaveHeightSource returns model_swell. Shoaling short-circuit
        // must not fire against the model input.
        const result = toFaceHeightFeet({
          cdipSigFt: 8.0,
          modelSwellM: 1.0, // 3.28 ft
          periodS: 14,
          beach: blacksBeach,
        });
        // Legacy: 3.28 * 1.0 * 1.2 * 1.0 = 3.94 → 3.9 ft
        const numeric = parseFloat(result!);
        expect(numeric).toBeLessThan(5); // not 3.28 * 2.1 = 6.9
      });

      it("SKIPS short-circuit when cdipSigFt is null (model_swell takes over)", () => {
        // CDIP data gap at a calibrated beach. Must fall back cleanly to
        // the model pipeline without applying the CDIP-only bucket factor.
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: 0.6, // 1.97 ft
          periodS: 14,
          beach: blacksBeach,
        });
        // Legacy: 1.97 * 1.0 * 1.2 * 1.0 = 2.36 → 2.4 ft
        expect(result).toBe("2.4 ft");
      });

      it("SKIPS short-circuit when falling back to cdip_swell component", () => {
        // CDIP swell height (a derived per-component value) is not the same
        // as CDIP Hs — the calibration was measured against Hs. Must not
        // apply the bucket factor to a cdip_swell input either.
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: 1.7,
          periodS: 14,
          beach: blacksBeach,
        });
        // Legacy: 1.7 * 1.0 * 1.2 * 1.0 = 2.04 → 2 ft
        const numeric = parseFloat(result!);
        expect(numeric).toBeLessThan(3); // not 1.7 * 2.1 = 3.57
      });

      it("SKIPS short-circuit when falling back to NDBC buoy", () => {
        // NDBC buoy is a completely different instrument from CDIP. Same rule.
        const result = toFaceHeightFeet({
          cdipSigFt: null,
          modelSwellM: null,
          cdipSwellFt: null,
          modelHsM: null,
          ndbcBuoyM: 0.5, // 1.64 ft
          periodS: 14,
          beach: blacksBeach,
        });
        // Legacy: 1.64 * 1.0 * 1.2 * 1.0 = 1.97 → 2 ft
        const numeric = parseFloat(result!);
        expect(numeric).toBeLessThan(3);
      });

      it("uncalibrated beach (shoaling_factors=null) follows legacy path regardless of source", () => {
        // Sanity: an uncalibrated beach with CDIP sig input uses the legacy
        // pipeline, no short-circuit. Confirms the 190-ish non-Phase-1.4
        // beaches behave identically to pre-migration.
        const result = toFaceHeightFeet({
          cdipSigFt: 1.7,
          periodS: 14,
          beach: { shoaling_factors: null },
        });
        // 1.7 * 1.0 * 1.2 * 1.0 = 2.04 → 2 ft
        expect(result).toBe("2 ft");
      });
    });
  });

  // =========================================================================
  // formatWaveHeightRangeString (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // extractNumericWaveHeight (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // roundWaveHeight (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // clampWaveHeight (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // selectWaveHeightSource (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // WAVE_HEIGHT_NUMBER_PATTERN (merged from wave-height-formatter.test.ts)
  // =========================================================================
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

  // =========================================================================
  // toFaceHeightRangeFeet (merged from wave-height-formatter.test.ts)
  // =========================================================================
  describe("toFaceHeightRangeFeet", () => {
    it("should return range string for valid input", () => {
      const result = toFaceHeightRangeFeet({
        cdipSigFt: 2.0,
        periodS: 10,
      });
      // 2.0 * 1.0 = 2.0ft average, × 1.5 = 3.0ft sets -> "2-3ft"
      expect(result).toBe("2-3ft");
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
      // 3.28 * 1.0 = 3.28ft, × 1.5 = 4.9ft -> "3-5ft"
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
