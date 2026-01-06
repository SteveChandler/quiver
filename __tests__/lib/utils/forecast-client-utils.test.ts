import {
  isDataStale,
  getStalenessDetails,
  getLatestUpdatedAt,
} from "@/lib/utils/forecast-client-utils";

describe("forecast-client-utils", () => {
  describe("getLatestUpdatedAt", () => {
    it("returns null for empty array", () => {
      expect(getLatestUpdatedAt([])).toBeNull();
    });

    it("returns null when all forecasts have null updated_at", () => {
      const forecasts = [
        { updated_at: null },
        { updated_at: null },
        { updated_at: undefined },
      ];
      expect(getLatestUpdatedAt(forecasts)).toBeNull();
    });

    it("returns the single timestamp when array has one element", () => {
      const forecasts = [{ updated_at: "2025-01-06T12:00:00Z" }];
      expect(getLatestUpdatedAt(forecasts)).toBe("2025-01-06T12:00:00Z");
    });

    it("returns the latest timestamp from multiple forecasts", () => {
      // Simulates the bug scenario: forecasts sorted by forecast_date ASC
      // where forecasts[0] has an older updated_at (yesterday's lookback data)
      const forecasts = [
        { updated_at: "2025-01-04T10:00:00Z" }, // Old lookback row
        { updated_at: "2025-01-05T08:00:00Z" }, // Intermediate row
        { updated_at: "2025-01-06T12:00:00Z" }, // Most recently written
        { updated_at: "2025-01-05T15:00:00Z" }, // Older write
      ];
      expect(getLatestUpdatedAt(forecasts)).toBe("2025-01-06T12:00:00Z");
    });

    it("handles mixed null and valid timestamps", () => {
      const forecasts = [
        { updated_at: null },
        { updated_at: "2025-01-04T10:00:00Z" },
        { updated_at: undefined },
        { updated_at: "2025-01-06T12:00:00Z" },
        { updated_at: null },
      ];
      expect(getLatestUpdatedAt(forecasts)).toBe("2025-01-06T12:00:00Z");
    });

    it("correctly compares timestamps across different days", () => {
      const forecasts = [
        { updated_at: "2024-12-31T23:59:59Z" },
        { updated_at: "2025-01-01T00:00:01Z" },
      ];
      expect(getLatestUpdatedAt(forecasts)).toBe("2025-01-01T00:00:01Z");
    });

    it("correctly compares timestamps with same date but different times", () => {
      const forecasts = [
        { updated_at: "2025-01-06T08:00:00Z" },
        { updated_at: "2025-01-06T08:00:01Z" }, // Just 1 second later
        { updated_at: "2025-01-06T07:59:59Z" },
      ];
      expect(getLatestUpdatedAt(forecasts)).toBe("2025-01-06T08:00:01Z");
    });

    describe("performance", () => {
      it("handles large arrays efficiently", () => {
        // Generate 1000 forecasts with varying timestamps
        const largeArray = Array.from({ length: 1000 }, (_, i) => ({
          updated_at: new Date(Date.now() - i * 1000).toISOString(),
        }));

        const start = performance.now();
        const result = getLatestUpdatedAt(largeArray);
        const duration = performance.now() - start;

        // Should find the most recent timestamp (first element in this case)
        expect(result).toBe(largeArray[0].updated_at);
        // Should complete in well under 50ms even with 1000 elements
        expect(duration).toBeLessThan(50);
      });

      it("handles 10000 elements without significant slowdown", () => {
        const veryLargeArray = Array.from({ length: 10000 }, (_, i) => ({
          updated_at: new Date(Date.now() - i * 100).toISOString(),
        }));

        const start = performance.now();
        const result = getLatestUpdatedAt(veryLargeArray);
        const duration = performance.now() - start;

        expect(result).toBe(veryLargeArray[0].updated_at);
        // Should still complete quickly (< 100ms even for 10k elements)
        expect(duration).toBeLessThan(100);
      });
    });

    describe("regression tests for forecast freshness bug", () => {
      it("finds correct latest timestamp when old lookback row is first", () => {
        // This is the exact bug scenario: tide chart lookback includes
        // yesterday's data, sorted ASC, so forecasts[0] is old
        const forecasts = [
          // Yesterday's lookback data (wrote 2 days ago)
          { updated_at: "2025-01-04T10:00:00Z", forecast_date: "2025-01-05" },
          // Today's forecast (wrote just now)
          { updated_at: "2025-01-06T14:30:00Z", forecast_date: "2025-01-06" },
          // Tomorrow's forecast (wrote just now)
          { updated_at: "2025-01-06T14:30:00Z", forecast_date: "2025-01-07" },
        ];

        // Bug: Using forecasts[0].updated_at would return 2025-01-04T10:00:00Z
        // Fix: getLatestUpdatedAt returns 2025-01-06T14:30:00Z
        expect(getLatestUpdatedAt(forecasts)).toBe("2025-01-06T14:30:00Z");

        // Verify that forecasts[0] would have returned the wrong value
        expect(forecasts[0].updated_at).toBe("2025-01-04T10:00:00Z");
        expect(forecasts[0].updated_at).not.toBe(getLatestUpdatedAt(forecasts));
      });
    });
  });

  describe("isDataStale", () => {
    it("returns false for fresh CDIP data (< 1.5 hours)", () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      expect(isDataStale(oneHourAgo, "CDIP")).toBe(false);
    });

    it("returns true for stale CDIP data (> 1.5 hours)", () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      expect(isDataStale(twoHoursAgo, "CDIP")).toBe(true);
    });

    it("returns false for fresh NOAA data (< 12 hours)", () => {
      const now = Date.now();
      const tenHoursAgo = new Date(now - 10 * 60 * 60 * 1000).toISOString();
      expect(isDataStale(tenHoursAgo, "NOAA_NWS")).toBe(false);
    });

    it("returns true for stale NOAA data (> 12 hours)", () => {
      const now = Date.now();
      const thirteenHoursAgo = new Date(now - 13 * 60 * 60 * 1000).toISOString();
      expect(isDataStale(thirteenHoursAgo, "NOAA_NWS")).toBe(true);
    });
  });

  describe("getStalenessDetails", () => {
    it("returns correct staleness details", () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

      const details = getStalenessDetails(twoHoursAgo, "CDIP");

      expect(details.hoursSinceUpdate).toBeGreaterThan(1.9);
      expect(details.hoursSinceUpdate).toBeLessThan(2.1);
      expect(details.threshold).toBe(1.5); // CDIP threshold
      expect(details.isStale).toBe(true);
      expect(details.reason).toBe("Exceeded source-specific threshold");
    });

    it("returns within freshness window for fresh data", () => {
      const now = Date.now();
      const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();

      const details = getStalenessDetails(thirtyMinutesAgo, "CDIP");

      expect(details.isStale).toBe(false);
      expect(details.reason).toBe("Within freshness window");
    });
  });
});
