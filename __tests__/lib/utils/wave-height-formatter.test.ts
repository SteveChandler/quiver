import {
  parseWaveHeight,
  formatWaveHeight,
  getWaveHeightValue,
} from "@/lib/utils/wave-height-formatter";

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
});
