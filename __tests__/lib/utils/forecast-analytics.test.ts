import {
  extractNumericValue,
  calculateAccuracyScore,
  analyzeSessionAccuracy,
  calculateConfidenceCorrelation,
  assessDataQuality,
  generateRecommendations,
  calculateAccuracyTrends,
  calculateBeachAccuracyStats,
  compareDataSources,
} from "@/lib/utils/forecast-analytics";
import type { SessionForecastSnapshot } from "@/types/database";

describe("Forecast Analytics Utils", () => {
  describe("extractNumericValue", () => {
    it("extracts number from plain number", () => {
      expect(extractNumericValue(5)).toBe(5);
      expect(extractNumericValue(3.5)).toBe(3.5);
    });

    it("extracts number from simple string", () => {
      expect(extractNumericValue("10")).toBe(10);
      expect(extractNumericValue("3.5")).toBe(3.5);
    });

    it("extracts number from formatted strings", () => {
      expect(extractNumericValue("10 mph")).toBe(10);
      expect(extractNumericValue("72°F")).toBe(72);
      expect(extractNumericValue("3.5 ft")).toBe(3.5);
    });

    it("calculates average for ranges", () => {
      expect(extractNumericValue("3-4 ft")).toBe(3.5);
      expect(extractNumericValue("10-15 mph")).toBe(12.5);
      expect(extractNumericValue("2.5-3.5")).toBe(3);
    });

    it("handles empty or invalid input", () => {
      expect(extractNumericValue("")).toBe(0);
      expect(extractNumericValue("no numbers")).toBe(0);
      expect(extractNumericValue("abc")).toBe(0);
    });
  });

  describe("calculateAccuracyScore", () => {
    it("returns 100 for perfect accuracy", () => {
      expect(calculateAccuracyScore(5, 5)).toBe(100);
      expect(calculateAccuracyScore(10.5, 10.5)).toBe(100);
    });

    it("penalizes based on delta and tolerance", () => {
      // With default tolerance of 1.0, 0.5 delta should have 10% penalty (90% accuracy)
      expect(calculateAccuracyScore(5, 5.5)).toBe(90);
      expect(calculateAccuracyScore(10, 9.5)).toBe(90);
    });

    it("applies linear penalty within tolerance", () => {
      // 1.0 delta with 1.0 tolerance = 20% penalty (80% accuracy)
      expect(calculateAccuracyScore(5, 6, 1.0)).toBe(80);
      // 2.0 delta with 1.0 tolerance = 40% penalty (60% accuracy)
      expect(calculateAccuracyScore(5, 7, 1.0)).toBe(60);
    });

    it("respects custom tolerance", () => {
      // With tolerance of 2.0, 1.0 delta should have 10% penalty
      expect(calculateAccuracyScore(5, 6, 2.0)).toBe(90);
    });

    it("caps penalty at maximum", () => {
      // Very large delta should not exceed max penalty
      expect(calculateAccuracyScore(5, 15, 1.0, 100)).toBe(0);
    });

    it("returns 0 for scores below 0", () => {
      expect(calculateAccuracyScore(5, 20, 1.0)).toBe(0);
    });
  });

  describe("analyzeSessionAccuracy", () => {
    const mockSnapshot: SessionForecastSnapshot = {
      id: "snapshot-1",
      session_id: "session-1",
      user_id: "user-1",
      beach_id: "beach-1",
      forecast_snapshot: {
        wave_height: "3-4 ft",
        wind_speed: "10 mph",
        water_temp: "68°F",
        confidence_score: 85,
      },
      actual_conditions: {
        wave_height: "3.5",
        wind_speed: "12",
        water_temp: "70",
      },
      forecast_confidence_score: 85,
      data_source: "NOAA_NWS",
      session_date: "2024-01-15",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    it("analyzes complete session data correctly", () => {
      const analysis = analyzeSessionAccuracy(mockSnapshot);

      expect(analysis.metrics).toHaveLength(3);
      expect(analysis.overallAccuracy).toBeGreaterThan(0);
      expect(analysis.confidenceCorrelation).toBeGreaterThan(0);
      expect(analysis.dataQuality).toBe("high");
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it("handles partial data gracefully", () => {
      const partialSnapshot = {
        ...mockSnapshot,
        forecast_snapshot: { wave_height: "3 ft" },
        actual_conditions: { wave_height: "3.2" },
      };

      const analysis = analyzeSessionAccuracy(partialSnapshot);

      expect(analysis.metrics).toHaveLength(1);
      expect(analysis.metrics[0].name).toBe("wave_height");
    });

    it("calculates wave height accuracy correctly", () => {
      const analysis = analyzeSessionAccuracy(mockSnapshot);
      const waveMetric = analysis.metrics.find((m) => m.name === "wave_height");

      expect(waveMetric).toBeDefined();
      expect(waveMetric!.forecast).toBe(3.5); // Average of 3-4
      expect(waveMetric!.actual).toBe(3.5);
      expect(waveMetric!.delta).toBe(0);
      expect(waveMetric!.accuracy).toBe(100);
    });

    it("calculates wind speed accuracy correctly", () => {
      const analysis = analyzeSessionAccuracy(mockSnapshot);
      const windMetric = analysis.metrics.find((m) => m.name === "wind_speed");

      expect(windMetric).toBeDefined();
      expect(windMetric!.forecast).toBe(10);
      expect(windMetric!.actual).toBe(12);
      expect(windMetric!.delta).toBe(2);
      expect(windMetric!.accuracy).toBeGreaterThan(0);
    });

    it("handles missing forecast data", () => {
      const noForecastSnapshot = {
        ...mockSnapshot,
        forecast_snapshot: {},
        actual_conditions: { wave_height: "3.5" },
      };

      const analysis = analyzeSessionAccuracy(noForecastSnapshot);

      expect(analysis.metrics).toHaveLength(0);
      expect(analysis.overallAccuracy).toBe(0);
    });
  });

  describe("calculateConfidenceCorrelation", () => {
    it("returns 100 for perfect correlation", () => {
      expect(calculateConfidenceCorrelation(85, 85)).toBe(100);
      expect(calculateConfidenceCorrelation(70, 70)).toBe(100);
    });

    it("penalizes based on difference", () => {
      expect(calculateConfidenceCorrelation(85, 75)).toBe(90); // 10 point difference
      expect(calculateConfidenceCorrelation(70, 50)).toBe(80); // 20 point difference
    });

    it("returns 0 for very poor correlation", () => {
      expect(calculateConfidenceCorrelation(90, 10)).toBe(20); // 80 point difference
      expect(calculateConfidenceCorrelation(10, 90)).toBe(20);
    });

    it("handles edge cases", () => {
      expect(calculateConfidenceCorrelation(0, 100)).toBe(0);
      expect(calculateConfidenceCorrelation(100, 0)).toBe(0);
    });
  });

  describe("assessDataQuality", () => {
    it("returns high for complete data", () => {
      const metrics = [
        {
          name: "wave_height",
          forecast: 3,
          actual: 3.2,
          delta: 0.2,
          relativeError: 6.7,
          accuracy: 96,
        },
        {
          name: "wind_speed",
          forecast: 10,
          actual: 12,
          delta: 2,
          relativeError: 16.7,
          accuracy: 84,
        },
        {
          name: "water_temp",
          forecast: 68,
          actual: 70,
          delta: 2,
          relativeError: 2.9,
          accuracy: 87,
        },
      ];

      const snapshot = {
        forecast_confidence_score: 85,
        data_source: "NOAA_NWS",
      } as SessionForecastSnapshot;

      expect(assessDataQuality(metrics, snapshot)).toBe("high");
    });

    it("returns medium for partial data", () => {
      const metrics = [
        {
          name: "wave_height",
          forecast: 3,
          actual: 3.2,
          delta: 0.2,
          relativeError: 6.7,
          accuracy: 96,
        },
        {
          name: "wind_speed",
          forecast: 10,
          actual: 12,
          delta: 2,
          relativeError: 16.7,
          accuracy: 84,
        },
      ];

      const snapshot = {
        forecast_confidence_score: 75,
        data_source: "FALLBACK",
      } as SessionForecastSnapshot;

      expect(assessDataQuality(metrics, snapshot)).toBe("medium");
    });

    it("returns low for minimal data", () => {
      const metrics: any[] = [];
      const snapshot = {} as SessionForecastSnapshot;

      expect(assessDataQuality(metrics, snapshot)).toBe("low");
    });
  });

  describe("generateRecommendations", () => {
    it("recommends multiple sources for low accuracy", () => {
      const metrics: any[] = [];
      const recommendations = generateRecommendations(metrics, 60, 80);

      expect(recommendations).toContain(
        "Consider using multiple forecast sources for this location"
      );
    });

    it("acknowledges excellent accuracy", () => {
      const metrics: any[] = [];
      const recommendations = generateRecommendations(metrics, 90, 80);

      expect(recommendations).toContain(
        "Forecast quality is excellent for this spot"
      );
    });

    it("identifies poor wave height accuracy", () => {
      const metrics = [
        {
          name: "wave_height",
          forecast: 3,
          actual: 6,
          delta: 3,
          relativeError: 50,
          accuracy: 40,
        },
      ];

      const recommendations = generateRecommendations(metrics, 75, 80);

      expect(recommendations).toContain(
        "Wave height forecasts need improvement - consider local buoy data"
      );
    });

    it("identifies overestimated confidence", () => {
      const metrics: any[] = [];
      const recommendations = generateRecommendations(metrics, 60, 90);

      expect(recommendations).toContain(
        "Forecast confidence may be overestimated"
      );
    });

    it("identifies underestimated confidence", () => {
      const metrics: any[] = [];
      const recommendations = generateRecommendations(metrics, 85, 50);

      expect(recommendations).toContain(
        "Forecast confidence may be underestimated"
      );
    });
  });

  describe("calculateAccuracyTrends", () => {
    const mockSnapshots = [
      {
        id: "1",
        session_date: "2024-01-15",
        forecast_snapshot: { wave_height: "3 ft" },
        actual_conditions: { wave_height: "3.2" },
        forecast_confidence_score: 85,
      },
      {
        id: "2",
        session_date: "2024-01-15",
        forecast_snapshot: { wave_height: "4 ft" },
        actual_conditions: { wave_height: "3.8" },
        forecast_confidence_score: 80,
      },
      {
        id: "3",
        session_date: "2024-01-16",
        forecast_snapshot: { wave_height: "2 ft" },
        actual_conditions: { wave_height: "2.5" },
        forecast_confidence_score: 70,
      },
    ] as unknown as SessionForecastSnapshot[];

    it("groups sessions by date correctly", () => {
      const trends = calculateAccuracyTrends(mockSnapshots);

      expect(trends).toHaveLength(2);
      expect(trends[0].date).toBe("2024-01-15");
      expect(trends[1].date).toBe("2024-01-16");
    });

    it("calculates daily averages correctly", () => {
      const trends = calculateAccuracyTrends(mockSnapshots);

      expect(trends[0].sessionCount).toBe(2);
      expect(trends[1].sessionCount).toBe(1);
      expect(trends[0].avgConfidence).toBe(83); // (85 + 80) / 2
      expect(trends[1].avgConfidence).toBe(70);
    });

    it("sorts trends by date", () => {
      const unorderedSnapshots = [
        mockSnapshots[2],
        mockSnapshots[0],
        mockSnapshots[1],
      ];
      const trends = calculateAccuracyTrends(unorderedSnapshots);

      expect(trends[0].date).toBe("2024-01-15");
      expect(trends[1].date).toBe("2024-01-16");
    });
  });

  describe("calculateBeachAccuracyStats", () => {
    const now = new Date("2024-01-20T10:00:00Z");
    const mockSnapshots: SessionForecastSnapshot[] = [
      {
        id: "1",
        session_date: "2024-01-18", // 2 days ago
        forecast_snapshot: { wave_height: "3 ft", wind_speed: "10 mph" },
        actual_conditions: { wave_height: "3.2", wind_speed: "12 mph" },
      },
      {
        id: "2",
        session_date: "2024-01-15", // 5 days ago
        forecast_snapshot: { wave_height: "4 ft", wind_speed: "15 mph" },
        actual_conditions: { wave_height: "3.8", wind_speed: "13 mph" },
      },
      {
        id: "3",
        session_date: "2023-12-20", // 31 days ago
        forecast_snapshot: { wave_height: "2 ft", wind_speed: "8 mph" },
        actual_conditions: { wave_height: "2.5", wind_speed: "10 mph" },
      },
    ] as unknown as SessionForecastSnapshot[];

    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("calculates basic session counts correctly", () => {
      const stats = calculateBeachAccuracyStats(mockSnapshots);

      expect(stats.total_sessions_count).toBe(3);
      expect(stats.last_30_days_count).toBe(2); // Only first two sessions
      expect(stats.last_7_days_count).toBe(2); // Only first two sessions
    });

    it("calculates accuracy metrics", () => {
      const stats = calculateBeachAccuracyStats(mockSnapshots);

      expect(stats.overall_accuracy_score).toBeGreaterThan(0);
      expect(stats.wave_height_accuracy).toBeGreaterThan(0);
      expect(stats.wind_accuracy).toBeGreaterThan(0);
    });

    it("calculates average deltas", () => {
      const stats = calculateBeachAccuracyStats(mockSnapshots);

      expect(stats.avg_wave_height_delta).toBeGreaterThan(0);
      expect(stats.avg_wind_speed_delta).toBeGreaterThan(0);
    });

    it("handles empty snapshots array", () => {
      const stats = calculateBeachAccuracyStats([]);

      expect(stats.total_sessions_count).toBe(0);
      expect(stats.last_30_days_count).toBe(0);
      expect(stats.last_7_days_count).toBe(0);
      expect(stats.overall_accuracy_score).toBeNull();
    });

    it("sets calculation date to today", () => {
      const stats = calculateBeachAccuracyStats(mockSnapshots);

      expect(stats.calculation_date).toBe("2024-01-20");
    });
  });

  describe("compareDataSources", () => {
    const mockSnapshots: SessionForecastSnapshot[] = [
      {
        id: "1",
        data_source: "NOAA_NWS",
        forecast_snapshot: { wave_height: "3 ft" },
        actual_conditions: { wave_height: "3.1" },
        forecast_confidence_score: 85,
      },
      {
        id: "2",
        data_source: "NOAA_NWS",
        forecast_snapshot: { wave_height: "4 ft" },
        actual_conditions: { wave_height: "3.9" },
        forecast_confidence_score: 80,
      },
      {
        id: "3",
        data_source: "FALLBACK",
        forecast_snapshot: { wave_height: "2 ft" },
        actual_conditions: { wave_height: "3 ft" },
        forecast_confidence_score: 50,
      },
    ] as unknown as SessionForecastSnapshot[];

    it("groups snapshots by data source", () => {
      const comparison = compareDataSources(mockSnapshots);

      expect(comparison).toHaveLength(2);
      expect(comparison.find((c) => c.source === "NOAA_NWS")).toBeDefined();
      expect(comparison.find((c) => c.source === "FALLBACK")).toBeDefined();
    });

    it("calculates average accuracy per source", () => {
      const comparison = compareDataSources(mockSnapshots);
      const noaaStats = comparison.find((c) => c.source === "NOAA_NWS");
      const fallbackStats = comparison.find((c) => c.source === "FALLBACK");

      expect(noaaStats!.sessionCount).toBe(2);
      expect(fallbackStats!.sessionCount).toBe(1);
      expect(noaaStats!.avgAccuracy).toBeGreaterThan(
        fallbackStats!.avgAccuracy
      );
    });

    it("calculates average confidence per source", () => {
      const comparison = compareDataSources(mockSnapshots);
      const noaaStats = comparison.find((c) => c.source === "NOAA_NWS");

      expect(noaaStats!.avgConfidence).toBe(83); // (85 + 80) / 2
    });

    it("assigns reliability ratings based on sample size", () => {
      const comparison = compareDataSources(mockSnapshots);

      const noaaStats = comparison.find((c) => c.source === "NOAA_NWS");
      const fallbackStats = comparison.find((c) => c.source === "FALLBACK");

      expect(fallbackStats!.reliability).toBe("low"); // Only 1 session
      expect(noaaStats!.reliability).toBe("low"); // Only 2 sessions (need 5+ for medium)
    });

    it("handles unknown data sources", () => {
      const unknownSnapshots = [
        {
          ...mockSnapshots[0],
          data_source: null,
        },
      ] as SessionForecastSnapshot[];

      const comparison = compareDataSources(unknownSnapshots);

      expect(comparison).toHaveLength(1);
      expect(comparison[0].source).toBe("unknown");
    });
  });
});
