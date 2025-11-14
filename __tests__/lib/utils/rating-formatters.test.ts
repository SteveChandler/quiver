import {
  formatRating,
  formatRatingOutOf5,
  formatRatingSimple,
  type RatingFormatOptions,
} from "@/lib/utils/rating-formatters";

describe("Rating Formatters", () => {
  describe("formatRating", () => {
    describe("Valid numeric inputs", () => {
      it("should format positive decimal rating with default 1 decimal place", () => {
        expect(formatRating(4.567)).toBe("4.6");
        expect(formatRating(3.14159)).toBe("3.1");
        expect(formatRating(2.95)).toBe("3.0");
      });

      it("should format integer rating", () => {
        expect(formatRating(4)).toBe("4.0");
        expect(formatRating(5)).toBe("5.0");
        expect(formatRating(1)).toBe("1.0");
      });

      it("should format rating with custom decimal places", () => {
        expect(formatRating(4.567, { decimals: 0 })).toBe("5");
        expect(formatRating(4.567, { decimals: 2 })).toBe("4.57");
        expect(formatRating(4.567, { decimals: 3 })).toBe("4.567");
      });

      it("should format very small decimal values", () => {
        expect(formatRating(0.1)).toBe("0.1");
        expect(formatRating(0.05)).toBe("0.1");
        expect(formatRating(0.01)).toBe("0.0");
      });

      it("should format large numbers", () => {
        expect(formatRating(100.567)).toBe("100.6");
        expect(formatRating(999.999)).toBe("1000.0");
      });

      it("should handle zero correctly", () => {
        expect(formatRating(0)).toBe("--"); // 0 is falsy, should return fallback
      });

      it("should handle negative numbers", () => {
        expect(formatRating(-1.5)).toBe("-1.5");
        expect(formatRating(-4.567, { decimals: 2 })).toBe("-4.57");
      });

      it("should handle maxValue suffix", () => {
        expect(formatRating(4.5, { maxValue: 5 })).toBe("4.5/5");
        expect(formatRating(8.7, { maxValue: 10 })).toBe("8.7/10");
        expect(formatRating(3, { maxValue: 5 })).toBe("3.0/5");
      });

      it("should combine decimals and maxValue options", () => {
        expect(formatRating(4.567, { decimals: 2, maxValue: 5 })).toBe("4.57/5");
        expect(formatRating(7.8, { decimals: 0, maxValue: 10 })).toBe("8/10");
      });

      it("should handle rounding edge cases", () => {
        expect(formatRating(4.44, { decimals: 1 })).toBe("4.4");
        expect(formatRating(4.45, { decimals: 1 })).toBe("4.5");
        // Note: JavaScript toFixed uses banker's rounding (round half to even)
        // so 4.55 rounds down to 4.5 instead of up to 4.6
        expect(formatRating(4.55, { decimals: 1 })).toBe("4.5");
        expect(formatRating(4.56, { decimals: 1 })).toBe("4.6");
      });
    });

    describe("Invalid/missing inputs", () => {
      it("should return default fallback for null", () => {
        expect(formatRating(null)).toBe("--");
      });

      it("should return default fallback for undefined", () => {
        expect(formatRating(undefined)).toBe("--");
      });

      it("should return default fallback for NaN", () => {
        expect(formatRating(NaN)).toBe("--");
      });

      it("should return default fallback for Infinity", () => {
        expect(formatRating(Infinity)).toBe("--");
        expect(formatRating(-Infinity)).toBe("--");
      });

      it("should return custom fallback for null", () => {
        expect(formatRating(null, { fallback: "N/A" })).toBe("N/A");
        expect(formatRating(null, { fallback: "TBD" })).toBe("TBD");
        expect(formatRating(null, { fallback: "" })).toBe("");
      });

      it("should return custom fallback for undefined", () => {
        expect(formatRating(undefined, { fallback: "No rating" })).toBe("No rating");
      });

      it("should return custom fallback for NaN", () => {
        expect(formatRating(NaN, { fallback: "Invalid" })).toBe("Invalid");
      });

      it("should preserve maxValue in options but still use fallback", () => {
        expect(formatRating(null, { maxValue: 5, fallback: "N/A" })).toBe("N/A");
      });
    });

    describe("Options combinations", () => {
      it("should work with empty options object", () => {
        expect(formatRating(4.5, {})).toBe("4.5");
      });

      it("should work with all options specified", () => {
        const options: RatingFormatOptions = {
          decimals: 2,
          maxValue: 10,
          fallback: "None",
        };
        expect(formatRating(7.856, options)).toBe("7.86/10");
        expect(formatRating(null, options)).toBe("None");
      });

      it("should handle zero decimals with maxValue", () => {
        expect(formatRating(4.9, { decimals: 0, maxValue: 5 })).toBe("5/5");
      });

      it("should handle high decimal precision", () => {
        expect(formatRating(3.141592653, { decimals: 5 })).toBe("3.14159");
      });
    });

    describe("Real-world use cases", () => {
      it("should format surf quality rating out of 10", () => {
        expect(formatRating(7.8, { maxValue: 10, decimals: 1 })).toBe("7.8/10");
      });

      it("should format wave quality with default formatting", () => {
        expect(formatRating(8.5)).toBe("8.5");
      });

      it("should handle missing crowd rating", () => {
        expect(formatRating(null, { fallback: "Not rated" })).toBe("Not rated");
      });

      it("should format parking ease rating", () => {
        expect(formatRating(4.2, { maxValue: 5, decimals: 1 })).toBe("4.2/5");
      });
    });
  });

  describe("formatRatingOutOf5", () => {
    it("should format valid rating with /5 suffix", () => {
      expect(formatRatingOutOf5(4.5)).toBe("4.5/5");
      expect(formatRatingOutOf5(3.7)).toBe("3.7/5");
      expect(formatRatingOutOf5(5.0)).toBe("5.0/5");
    });

    it("should use default N/A fallback for null", () => {
      expect(formatRatingOutOf5(null)).toBe("N/A");
    });

    it("should use default N/A fallback for undefined", () => {
      expect(formatRatingOutOf5(undefined)).toBe("N/A");
    });

    it("should use default N/A fallback for NaN", () => {
      expect(formatRatingOutOf5(NaN)).toBe("N/A");
    });

    it("should use custom fallback when provided", () => {
      expect(formatRatingOutOf5(null, "No rating")).toBe("No rating");
      expect(formatRatingOutOf5(undefined, "--")).toBe("--");
      expect(formatRatingOutOf5(NaN, "TBD")).toBe("TBD");
    });

    it("should format integers correctly", () => {
      expect(formatRatingOutOf5(4)).toBe("4.0/5");
      expect(formatRatingOutOf5(5)).toBe("5.0/5");
      expect(formatRatingOutOf5(1)).toBe("1.0/5");
    });

    it("should handle edge case ratings", () => {
      expect(formatRatingOutOf5(0.1)).toBe("0.1/5");
      expect(formatRatingOutOf5(4.95)).toBe("5.0/5");
      expect(formatRatingOutOf5(4.94)).toBe("4.9/5");
    });

    it("should handle negative ratings (unusual but valid)", () => {
      expect(formatRatingOutOf5(-1)).toBe("-1.0/5");
    });

    it("should handle ratings above 5 (unusual but valid)", () => {
      expect(formatRatingOutOf5(6.5)).toBe("6.5/5");
    });

    it("should handle very small decimals", () => {
      expect(formatRatingOutOf5(0.05)).toBe("0.1/5");
      expect(formatRatingOutOf5(0.04)).toBe("0.0/5");
    });
  });

  describe("formatRatingSimple", () => {
    it("should format valid rating without suffix", () => {
      expect(formatRatingSimple(4.567)).toBe("4.6");
      expect(formatRatingSimple(3.14)).toBe("3.1");
      expect(formatRatingSimple(2.0)).toBe("2.0");
    });

    it("should use default -- fallback for null", () => {
      expect(formatRatingSimple(null)).toBe("--");
    });

    it("should use default -- fallback for undefined", () => {
      expect(formatRatingSimple(undefined)).toBe("--");
    });

    it("should use default -- fallback for NaN", () => {
      expect(formatRatingSimple(NaN)).toBe("--");
    });

    it("should use custom fallback when provided", () => {
      expect(formatRatingSimple(null, "N/A")).toBe("N/A");
      expect(formatRatingSimple(undefined, "Unknown")).toBe("Unknown");
      expect(formatRatingSimple(NaN, "Error")).toBe("Error");
    });

    it("should format integers correctly", () => {
      expect(formatRatingSimple(8)).toBe("8.0");
      expect(formatRatingSimple(10)).toBe("10.0");
    });

    it("should handle decimals with default 1 decimal place", () => {
      expect(formatRatingSimple(7.89)).toBe("7.9");
      expect(formatRatingSimple(4.444)).toBe("4.4");
      expect(formatRatingSimple(4.555)).toBe("4.6");
    });

    it("should handle very small numbers", () => {
      expect(formatRatingSimple(0.1)).toBe("0.1");
      expect(formatRatingSimple(0.05)).toBe("0.1");
      expect(formatRatingSimple(0.001)).toBe("0.0");
    });

    it("should handle large numbers", () => {
      expect(formatRatingSimple(100.5)).toBe("100.5");
      expect(formatRatingSimple(999.99)).toBe("1000.0");
    });

    it("should handle negative numbers", () => {
      expect(formatRatingSimple(-5.5)).toBe("-5.5");
      expect(formatRatingSimple(-0.5)).toBe("-0.5");
    });

    it("should handle zero as falsy (returns fallback)", () => {
      expect(formatRatingSimple(0)).toBe("--");
      expect(formatRatingSimple(0, "Zero")).toBe("Zero");
    });
  });

  describe("Cross-function consistency", () => {
    it("should maintain consistent formatting across all functions", () => {
      const rating = 4.567;

      // All should format to same decimal precision
      expect(formatRatingSimple(rating)).toBe("4.6");
      expect(formatRating(rating)).toBe("4.6");
      expect(formatRatingOutOf5(rating)).toBe("4.6/5");
    });

    it("should maintain consistent fallback handling", () => {
      expect(formatRating(null, { fallback: "Missing" })).toBe("Missing");
      expect(formatRatingSimple(null, "Missing")).toBe("Missing");
      expect(formatRatingOutOf5(null, "Missing")).toBe("Missing");
    });

    it("should handle NaN consistently", () => {
      expect(formatRating(NaN)).toBe("--");
      expect(formatRatingSimple(NaN)).toBe("--");
      expect(formatRatingOutOf5(NaN)).toBe("N/A"); // Different default fallback
    });

    it("should handle undefined consistently", () => {
      expect(formatRating(undefined)).toBe("--");
      expect(formatRatingSimple(undefined)).toBe("--");
      expect(formatRatingOutOf5(undefined)).toBe("N/A"); // Different default fallback
    });
  });

  describe("Type safety", () => {
    it("should accept all valid number types", () => {
      expect(() => formatRating(4.5)).not.toThrow();
      expect(() => formatRating(4)).not.toThrow();
      expect(() => formatRating(-1)).not.toThrow();
    });

    it("should accept null and undefined", () => {
      expect(() => formatRating(null)).not.toThrow();
      expect(() => formatRating(undefined)).not.toThrow();
    });

    it("should handle options object properly", () => {
      const options: RatingFormatOptions = {
        decimals: 2,
        maxValue: 10,
        fallback: "N/A",
      };
      expect(() => formatRating(5.5, options)).not.toThrow();
    });

    it("should work with partial options", () => {
      expect(() => formatRating(5.5, { decimals: 2 })).not.toThrow();
      expect(() => formatRating(5.5, { maxValue: 10 })).not.toThrow();
      expect(() => formatRating(5.5, { fallback: "N/A" })).not.toThrow();
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle extremely large numbers", () => {
      expect(formatRating(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991.0");
    });

    it("should handle extremely small positive numbers", () => {
      expect(formatRating(Number.MIN_VALUE)).toBe("0.0");
    });

    it("should handle Infinity as invalid", () => {
      expect(formatRating(Infinity)).toBe("--");
      expect(formatRating(-Infinity)).toBe("--");
    });

    it("should handle maximum decimal precision", () => {
      expect(formatRating(Math.PI, { decimals: 10 })).toBe("3.1415926536");
    });

    it("should handle zero decimals without fractional part", () => {
      expect(formatRating(4.9, { decimals: 0 })).toBe("5");
      expect(formatRating(4.1, { decimals: 0 })).toBe("4");
    });
  });
});
