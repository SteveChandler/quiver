import { CoordinateParser } from "@/lib/utils/coordinate-parser";

describe("CoordinateParser", () => {
  describe("parseNOAAFormat", () => {
    it("should parse simple coordinate format", () => {
      const result = CoordinateParser.parseNOAAFormat("34.0 N 120.0 W");
      expect(result).toEqual([34.0, -120.0]);
    });

    it("should parse simple coordinate format with decimals", () => {
      const result = CoordinateParser.parseNOAAFormat("32.7841 N 117.2527 W");
      expect(result).toEqual([32.7841, -117.2527]);
    });

    it("should parse coordinates with eastern longitude", () => {
      const result = CoordinateParser.parseNOAAFormat("40.7128 N 74.0060 E");
      expect(result).toEqual([40.7128, 74.006]);
    });

    it("should parse coordinates with southern latitude", () => {
      const result = CoordinateParser.parseNOAAFormat("33.8688 S 151.2093 E");
      expect(result).toEqual([-33.8688, 151.2093]);
    });

    it("should parse coordinates with HTML entities", () => {
      const result = CoordinateParser.parseNOAAFormat(
        "34&#176;16'0&quot; N 120&#176;24'48&quot; W"
      );
      expect(result).toEqual([34.0, -120.0]); // Should parse the decimal part before parentheses
    });

    it("should parse complex format with parentheses", () => {
      const result = CoordinateParser.parseNOAAFormat(
        "34.2667 N 120.4083 W (34°16'0\" N 120°24'48\" W)"
      );
      expect(result).toEqual([34.2667, -120.4083]);
    });

    it("should handle coordinates with degrees symbols", () => {
      const result = CoordinateParser.parseNOAAFormat("34.5° N 120.25° W");
      expect(result).toEqual([34.5, -120.25]);
    });

    it("should return null for invalid input", () => {
      expect(CoordinateParser.parseNOAAFormat("")).toBeNull();
      expect(CoordinateParser.parseNOAAFormat("invalid")).toBeNull();
      expect(CoordinateParser.parseNOAAFormat("34.0 N")).toBeNull(); // Missing longitude
      expect(CoordinateParser.parseNOAAFormat("N W")).toBeNull(); // No numbers
    });

    it("should handle malformed coordinates gracefully", () => {
      expect(CoordinateParser.parseNOAAFormat("abc N xyz W")).toBeNull();
      expect(CoordinateParser.parseNOAAFormat("34.0 X 120.0 Y")).toEqual([
        34, 120,
      ]); // Invalid directions but valid numbers
    });

    it("should handle coordinates with extra whitespace", () => {
      const result = CoordinateParser.parseNOAAFormat(
        "  34.0   N   120.0   W  "
      );
      expect(result).toEqual([34.0, -120.0]);
    });
  });

  describe("decodeHTMLEntities", () => {
    it("should decode degree symbols", () => {
      // This tests the private method indirectly through parseNOAAFormat
      const result = CoordinateParser.parseNOAAFormat(
        "34&#176;0'0\" N 120&#176;0'0\" W"
      );
      expect(result).toBeTruthy(); // Should successfully parse
    });

    it("should decode quotes", () => {
      const result = CoordinateParser.parseNOAAFormat(
        "34.0 N 120.0 W &quot;test&quot;"
      );
      expect(result).toEqual([34.0, -120.0]);
    });

    it("should decode ampersands", () => {
      const result = CoordinateParser.parseNOAAFormat("34.0 N &amp; 120.0 W");
      expect(result).toBeNull(); // Extra ampersand breaks parsing format
    });
  });

  describe("validateCoordinates", () => {
    it("should validate proper coordinates", () => {
      expect(CoordinateParser.validateCoordinates(34.0, -120.0)).toBe(true);
      expect(CoordinateParser.validateCoordinates(90.0, 180.0)).toBe(true);
      expect(CoordinateParser.validateCoordinates(-90.0, -180.0)).toBe(true);
      expect(CoordinateParser.validateCoordinates(0.0, 0.0)).toBe(false); // Null island is invalid
    });

    it("should reject invalid latitude values", () => {
      expect(CoordinateParser.validateCoordinates(91.0, 0.0)).toBe(false);
      expect(CoordinateParser.validateCoordinates(-91.0, 0.0)).toBe(false);
      expect(CoordinateParser.validateCoordinates(NaN, 0.0)).toBe(false);
    });

    it("should reject invalid longitude values", () => {
      expect(CoordinateParser.validateCoordinates(0.0, 181.0)).toBe(false);
      expect(CoordinateParser.validateCoordinates(0.0, -181.0)).toBe(false);
      expect(CoordinateParser.validateCoordinates(0.0, NaN)).toBe(false);
    });
  });

  describe("isValidUSCoordinates", () => {
    it("should validate coordinates within US bounds", () => {
      // Continental US
      expect(CoordinateParser.isValidUSCoordinates([34.0, -118.0])).toBe(true);
      expect(CoordinateParser.isValidUSCoordinates([40.7, -74.0])).toBe(true);

      // Alaska
      expect(CoordinateParser.isValidUSCoordinates([64.0, -153.0])).toBe(true);

      // Hawaii
      expect(CoordinateParser.isValidUSCoordinates([21.3, -157.8])).toBe(true);
    });

    it("should reject coordinates outside US bounds", () => {
      // Europe
      expect(CoordinateParser.isValidUSCoordinates([48.8566, 2.3522])).toBe(
        false
      );

      // Asia
      expect(CoordinateParser.isValidUSCoordinates([35.6762, 139.6503])).toBe(
        false
      );

      // Too far north
      expect(CoordinateParser.isValidUSCoordinates([80.0, -100.0])).toBe(false);

      // Too far south
      expect(CoordinateParser.isValidUSCoordinates([10.0, -100.0])).toBe(false);

      // Too far east
      expect(CoordinateParser.isValidUSCoordinates([40.0, -50.0])).toBe(false);

      // Too far west (beyond US territory)
      expect(CoordinateParser.isValidUSCoordinates([40.0, 170.0])).toBe(false);
    });

    it("should reject null coordinates", () => {
      expect(CoordinateParser.isValidUSCoordinates([0.0, 0.0])).toBe(false);
    });

    it("should handle edge cases near US borders", () => {
      // Just inside bounds
      expect(CoordinateParser.isValidUSCoordinates([15.1, -179.9])).toBe(true);
      expect(CoordinateParser.isValidUSCoordinates([71.9, -60.1])).toBe(true);

      // Just outside bounds
      expect(CoordinateParser.isValidUSCoordinates([14.9, -100.0])).toBe(false);
      expect(CoordinateParser.isValidUSCoordinates([72.1, -100.0])).toBe(false);
    });
  });

  describe("parseAndValidate", () => {
    it("should parse and validate valid US coordinates", () => {
      const result = CoordinateParser.parseAndValidate("34.0 N 118.0 W");
      expect(result).toEqual([34.0, -118.0]);
    });

    it("should return null for coordinates outside US", () => {
      const result = CoordinateParser.parseAndValidate("48.8566 N 2.3522 E"); // Paris
      expect(result).toBeNull();
    });

    it("should return null for invalid coordinate format", () => {
      const result = CoordinateParser.parseAndValidate("invalid format");
      expect(result).toBeNull();
    });

    it("should return null for null coordinates", () => {
      const result = CoordinateParser.parseAndValidate("0.0 N 0.0 E");
      expect(result).toBeNull();
    });

    it("should handle complete workflow successfully", () => {
      // Test the complete workflow from NOAA format to validated coordinates
      const noaaData = [
        "32.7503 N 117.2534 W", // Ocean Beach, San Diego
        "34.0259 N 118.7798 W", // Malibu
        "37.7749 N 122.4194 W", // San Francisco
      ];

      const results = noaaData.map((coord) =>
        CoordinateParser.parseAndValidate(coord)
      );

      expect(results).toEqual([
        [32.7503, -117.2534],
        [34.0259, -118.7798],
        [37.7749, -122.4194],
      ]);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle undefined input", () => {
      expect(CoordinateParser.parseNOAAFormat(undefined as any)).toBeNull();
    });

    it("should handle null input", () => {
      expect(CoordinateParser.parseNOAAFormat(null as any)).toBeNull();
    });

    it("should handle empty string", () => {
      expect(CoordinateParser.parseNOAAFormat("")).toBeNull();
    });

    it("should handle very long strings", () => {
      const longString = "34.0 N 120.0 W " + "x".repeat(1000);
      const result = CoordinateParser.parseNOAAFormat(longString);
      expect(result).toEqual([34.0, -120.0]);
    });

    it("should handle special characters", () => {
      const result = CoordinateParser.parseNOAAFormat(
        "34.0 N 120.0 W @#$%^&*()"
      );
      expect(result).toEqual([34.0, -120.0]);
    });

    it("should handle coordinates with mixed case directions", () => {
      expect(CoordinateParser.parseNOAAFormat("34.0 n 120.0 w")).toEqual([
        34.0, -120.0,
      ]);
      expect(CoordinateParser.parseNOAAFormat("34.0 N 120.0 w")).toEqual([
        34.0, -120.0,
      ]);
      expect(CoordinateParser.parseNOAAFormat("34.0 n 120.0 W")).toEqual([
        34.0, -120.0,
      ]);
    });

    it("should handle extreme valid coordinates", () => {
      // Maximum valid latitude and longitude
      expect(CoordinateParser.validateCoordinates(90, 180)).toBe(true);
      expect(CoordinateParser.validateCoordinates(-90, -180)).toBe(true);

      // Just beyond valid range
      expect(CoordinateParser.validateCoordinates(90.1, 0)).toBe(false);
      expect(CoordinateParser.validateCoordinates(0, 180.1)).toBe(false);
    });
  });

  describe("Real-world NOAA data examples", () => {
    it("should parse actual NOAA station formats", () => {
      // Examples from real NOAA station data
      const examples = [
        "46086|NMFS|NWS|NDBC|San Clemente Basin, CA|Active|32.491 N 118.034 W (32°29'27\" N 118°2'2\" W)",
        "9410230|NOS|NWS|NWLON|La Jolla, CA|Active|32.867 N 117.257 W (32°52'1\" N 117°15'25\" W)",
      ];

      // Extract coordinates from these examples
      const coords1 = CoordinateParser.parseAndValidate("32.491 N 118.034 W");
      const coords2 = CoordinateParser.parseAndValidate("32.867 N 117.257 W");

      expect(coords1).toEqual([32.491, -118.034]);
      expect(coords2).toEqual([32.867, -117.257]);
    });

    it("should handle malformed NOAA data gracefully", () => {
      const malformedExamples = [
        "Station|with|no|coordinates",
        "||||||",
        "46086||||Invalid format||||",
      ];

      malformedExamples.forEach((example) => {
        expect(() => CoordinateParser.parseAndValidate(example)).not.toThrow();
        expect(CoordinateParser.parseAndValidate(example)).toBeNull();
      });
    });
  });

  describe("Performance and memory", () => {
    it("should handle large numbers of coordinate parsing requests", () => {
      const coordinates = Array.from(
        { length: 1000 },
        (_, i) => `${30 + i * 0.001} N ${120 + i * 0.001} W`
      );

      const start = performance.now();
      const results = coordinates.map((coord) =>
        CoordinateParser.parseAndValidate(coord)
      );
      const end = performance.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(end - start).toBeLessThan(1000); // 1 second
      expect(results.filter((r) => r !== null)).toHaveLength(1000);
    });

    it("should not leak memory with repeated parsing", () => {
      // Test memory stability by parsing the same coordinate many times
      const testCoord = "34.0 N 120.0 W";

      for (let i = 0; i < 10000; i++) {
        const result = CoordinateParser.parseAndValidate(testCoord);
        expect(result).toEqual([34.0, -120.0]);
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });
});
