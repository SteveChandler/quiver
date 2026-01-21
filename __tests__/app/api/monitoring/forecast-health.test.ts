/**
 * Tests for forecast health monitoring route
 * 
 * Validates that staleness severity is correctly mapped:
 * - 'critical' for beaches > 24h (critical threshold)
 * - 'warning' for beaches > 12h but <= 24h (warning threshold)
 */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockStaleDataDetected = jest.fn() as jest.MockedFunction<(...args: any[]) => any>;
const mockHealthCheck = jest.fn() as jest.MockedFunction<() => Promise<any>>;
const mockLogHealthCheck = jest.fn() as jest.MockedFunction<(...args: any[]) => any>;

jest.mock("@/lib/monitoring/forecast-health-check", () => ({
  checkForecastHealth: () => mockHealthCheck(),
}));

jest.mock("@/lib/monitoring/forecast-logger", () => ({
  forecastLogger: {
    healthCheck: (...args: any[]) => mockLogHealthCheck(...args),
    staleDataDetected: (...args: any[]) => mockStaleDataDetected(...args),
    coverageGap: jest.fn(),
    apiError: jest.fn(),
  },
}));

describe("GET /api/monitoring/forecast-health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs warning-level staleness with 'warning' severity (not 'error')", async () => {
    // 14h is > 12h (warning) but < 24h (critical) => should be 'warning'
    mockHealthCheck.mockResolvedValueOnce({
      healthStatus: "degraded",
      totalBeaches: 10,
      enhancedAvailable: true,
      beachesWithForecasts: 10,
      beachesWithStaleData: 1,
      beachesWithCriticalStaleData: 0,
      beachesWithWarningStaleData: 1,
      coveragePercentage: 1.0,
      oldestForecastAge: 14.5,
      averageForecastAge: 8.0,
      dataSourceBreakdown: { NOAA_NWS: 10 },
      sources: {
        enhanced: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 1,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 1,
          oldestAgeHours: 14.5,
          averageAgeHours: 8.0,
          thresholds: { warningHours: 12, criticalHours: 24 },
        },
        marine: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 1.0,
          averageAgeHours: 0.5,
          thresholds: { warningHours: 2, criticalHours: 6 },
        },
        tide: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 12.0,
          averageAgeHours: 6.0,
          thresholds: { warningHours: 24, criticalHours: 48 },
        },
        sun: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 48.0,
          averageAgeHours: 24.0,
          thresholds: { warningHours: 168, criticalHours: 336 },
        },
        ioos: {
          available: true,
          coveragePercentage: 0.5,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 1.0,
          averageAgeHours: 0.5,
          thresholds: { warningHours: 2, criticalHours: 6 },
        },
      },
      issues: ["1 beach has warning-level staleness"],
      staleBeaches: [
        {
          beachId: "beach-warning",
          beachName: "Warning Beach",
          ageHours: 14.5, // > 12h (warning) but < 24h (critical)
          dataSource: "NOAA_NWS",
          lastUpdate: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const { GET } = await import("@/app/api/monitoring/forecast-health/route");
    const res = await GET(new Request("http://localhost:3000/api/monitoring/forecast-health"));

    expect(res.status).toBe(200);

    // Verify staleDataDetected was called with 'warning' severity (NOT 'error')
    expect(mockStaleDataDetected).toHaveBeenCalledTimes(1);
    expect(mockStaleDataDetected).toHaveBeenCalledWith(
      "beach-warning",
      "Warning Beach",
      14.5,
      "NOAA_NWS",
      "warning" // This is the key assertion: should be 'warning', not 'error'
    );
  });

  it("logs critical-level staleness with 'critical' severity", async () => {
    // 25h is > 24h (critical) => should be 'critical'
    mockHealthCheck.mockResolvedValueOnce({
      healthStatus: "critical",
      totalBeaches: 10,
      enhancedAvailable: true,
      beachesWithForecasts: 10,
      beachesWithStaleData: 1,
      beachesWithCriticalStaleData: 1,
      beachesWithWarningStaleData: 0,
      coveragePercentage: 1.0,
      oldestForecastAge: 25.0,
      averageForecastAge: 10.0,
      dataSourceBreakdown: { NOAA_NWS: 10 },
      sources: {
        enhanced: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 1,
          beachesWithCriticalStaleData: 1,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 25.0,
          averageAgeHours: 10.0,
          thresholds: { warningHours: 12, criticalHours: 24 },
        },
        marine: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 1.0,
          averageAgeHours: 0.5,
          thresholds: { warningHours: 2, criticalHours: 6 },
        },
        tide: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 12.0,
          averageAgeHours: 6.0,
          thresholds: { warningHours: 24, criticalHours: 48 },
        },
        sun: {
          available: true,
          coveragePercentage: 1.0,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 48.0,
          averageAgeHours: 24.0,
          thresholds: { warningHours: 168, criticalHours: 336 },
        },
        ioos: {
          available: true,
          coveragePercentage: 0.5,
          beachesWithStaleData: 0,
          beachesWithCriticalStaleData: 0,
          beachesWithWarningStaleData: 0,
          oldestAgeHours: 1.0,
          averageAgeHours: 0.5,
          thresholds: { warningHours: 2, criticalHours: 6 },
        },
      },
      issues: ["1 beach has critical staleness"],
      staleBeaches: [
        {
          beachId: "beach-critical",
          beachName: "Critical Beach",
          ageHours: 25.0, // > 24h (critical)
          dataSource: "NOAA_NWS",
          lastUpdate: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const { GET } = await import("@/app/api/monitoring/forecast-health/route");
    const res = await GET(new Request("http://localhost:3000/api/monitoring/forecast-health"));

    expect(res.status).toBe(503); // critical status returns 503

    // Verify staleDataDetected was called with 'critical' severity
    expect(mockStaleDataDetected).toHaveBeenCalledTimes(1);
    expect(mockStaleDataDetected).toHaveBeenCalledWith(
      "beach-critical",
      "Critical Beach",
      25.0,
      "NOAA_NWS",
      "critical"
    );
  });
});

