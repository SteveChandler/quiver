/**
 * Unit tests for Enhanced Forecast Sync Cron Job API
 * Tests the new cron endpoint that orchestrates CDIP + NOAA data ingestion
 */

import { POST, GET } from "@/app/api/cron/enhanced-forecast-sync/route";
import { NextRequest } from "next/server";
import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { CDIPService } from "@/lib/services/cdip-service";

// Mock the services
const mockEnhancedForecastServiceInstance = {
  generateComprehensiveForecast: jest.fn(),
  storeEnhancedForecasts: jest.fn(),
};

const mockCDIPServiceInstance = {
  fetchMultipleStations: jest.fn(),
  getSouthernCaliforniaStations: jest.fn(),
};

jest.mock("@/lib/services/enhanced-forecast-service", () => ({
  EnhancedForecastService: jest.fn(() => mockEnhancedForecastServiceInstance),
}));

jest.mock("@/lib/services/cdip-service", () => ({
  CDIPService: jest.fn(() => mockCDIPServiceInstance),
}));

// Mock API response utilities
jest.mock("@/lib/api-response-utils", () => ({
  createSuccessResponse: jest.fn((data, message) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: true,
        data,
        message,
        timestamp: new Date().toISOString(),
      })
    ),
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error,
        details,
        timestamp: new Date().toISOString(),
      })
    ),
    status,
  })),
  validateCronAuth: jest.fn(() => true),
}));

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "beach-1",
              name: "Scripps Pier",
              latitude: 32.8663,
              longitude: -117.2544,
              state: "CA",
            },
            {
              id: "beach-2",
              name: "Blacks Beach",
              latitude: 32.9016,
              longitude: -117.2524,
              state: "CA",
            },
          ],
          error: null,
        })
      ),
      upsert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
}));

// Mock rate limiters
jest.mock("@/lib/utils/rate-limiter", () => ({
  CDIPRateLimiter: {
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn(() => 0),
  },
  NOAARateLimiter: {
    canMakeRequest: jest.fn(() => true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn(() => 0),
  },
}));

describe("Enhanced Forecast Sync Cron Job API", () => {
  let mockEnhancedForecastService: jest.Mocked<EnhancedForecastService>;
  let mockCDIPService: jest.Mocked<CDIPService>;

  const mockRequest = (headers: Record<string, string> = {}) => {
    return {
      headers: {
        get: jest.fn((name: string) => headers[name] || null),
      },
      json: jest.fn(() => Promise.resolve({})),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockEnhancedForecastService =
      mockEnhancedForecastServiceInstance as jest.Mocked<EnhancedForecastService>;
    mockCDIPService = mockCDIPServiceInstance as jest.Mocked<CDIPService>;

    // Setup default successful responses
    mockEnhancedForecastService.generateComprehensiveForecast.mockResolvedValue(
      [
        {
          id: "forecast-1",
          beach_id: "beach-1",
          forecast_date: "2024-01-15",
          forecast_time: "12:00:00",
          wave_height: "3.2 ft",
          wave_period: "12.5s",
          wave_direction: "WSW",
          data_source: "CDIP",
          confidence_score: 85,
          raw_forecast: {
            cdip_data: {},
            noaa_data: {},
            data_sources: ["CDIP", "NOAA_NWS"],
          },
        } as any,
      ]
    );

    mockEnhancedForecastService.storeEnhancedForecasts.mockResolvedValue({
      success: true,
      data: [],
    });

    mockCDIPService.fetchMultipleStations.mockResolvedValue([
      {
        stationId: "100",
        stationName: "Torrey Pines Outer",
        data: [],
        dataSource: "CDIP",
        lastUpdated: new Date().toISOString(),
      },
    ]);

    mockCDIPService.getSouthernCaliforniaStations.mockReturnValue([
      "100",
      "46225",
      "46236",
    ]);
  });

  describe("POST /api/cron/enhanced-forecast-sync", () => {
    it("should successfully sync all beaches with CDIP and NOAA data", async () => {
      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("totalBeaches", 2);
      expect(data.data).toHaveProperty("successful");
      expect(data.data).toHaveProperty("cdipStationsUpdated");
      expect(data.data).toHaveProperty("duration");
    });

    it("should handle authentication failures", async () => {
      const { validateCronAuth } = require("@/lib/api-response-utils");
      validateCronAuth.mockReturnValueOnce(false);

      const request = mockRequest({
        authorization: "Bearer invalid-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Unauthorized");
    });

    it("should respect rate limits", async () => {
      const { CDIPRateLimiter } = require("@/lib/utils/rate-limiter");
      CDIPRateLimiter.canMakeRequest.mockReturnValue(false);
      CDIPRateLimiter.getTimeUntilReset.mockReturnValue(30000);

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("rate limit");
    });

    it("should batch process beaches efficiently", async () => {
      const startTime = Date.now();

      const request = mockRequest({
        authorization: "Bearer valid-cron-secret",
      });

      await POST(request);

      const duration = Date.now() - startTime;

      // Should process multiple beaches concurrently
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
