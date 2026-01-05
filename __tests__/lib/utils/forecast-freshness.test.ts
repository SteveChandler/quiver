import {
  calculateConfidenceLevel,
  calculateDataFreshness,
  calculateForecastAgeHours,
  combineFreshness,
} from "@/lib/utils/forecast-freshness";

describe("forecast-freshness", () => {
  describe("calculateDataFreshness", () => {
    it("returns missing for null timestamp", () => {
      expect(calculateDataFreshness(null)).toBe("missing");
    });

    it("returns current for timestamps within 3 hours", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const createdAt = new Date("2025-01-15T10:30:00Z").toISOString();
      expect(calculateDataFreshness(createdAt, now)).toBe("current");
    });

    it("returns stale for timestamps 3-12 hours old", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const createdAt = new Date("2025-01-15T04:00:00Z").toISOString();
      expect(calculateDataFreshness(createdAt, now)).toBe("stale");
    });

    it("returns outdated for timestamps older than 12 hours", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const createdAt = new Date("2025-01-14T20:00:00Z").toISOString();
      expect(calculateDataFreshness(createdAt, now)).toBe("outdated");
    });
  });

  describe("calculateForecastAgeHours", () => {
    it("returns null for null timestamp", () => {
      expect(calculateForecastAgeHours(null)).toBeNull();
    });

    it("returns rounded hours", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const createdAt = new Date("2025-01-15T03:00:00Z").toISOString();
      expect(calculateForecastAgeHours(createdAt, now)).toBe(9);
    });
  });

  describe("combineFreshness", () => {
    it("returns worst freshness across values", () => {
      expect(combineFreshness("current", "stale")).toBe("stale");
      expect(combineFreshness("current", "missing")).toBe("missing");
      expect(combineFreshness("stale", "outdated")).toBe("outdated");
    });
  });

  describe("calculateConfidenceLevel", () => {
    it("degrades confidence when freshness is outdated/missing", () => {
      expect(calculateConfidenceLevel(90, "outdated")).toBe("low");
      expect(calculateConfidenceLevel(90, "missing")).toBe("low");
    });

    it("returns high/medium/low based on score when current", () => {
      expect(calculateConfidenceLevel(80, "current")).toBe("high");
      expect(calculateConfidenceLevel(60, "current")).toBe("medium");
      expect(calculateConfidenceLevel(20, "current")).toBe("low");
    });

    it("caps stale data to medium at best", () => {
      expect(calculateConfidenceLevel(80, "stale")).toBe("medium");
      expect(calculateConfidenceLevel(60, "stale")).toBe("low");
    });
  });
});













