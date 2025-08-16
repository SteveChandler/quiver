import { NextRequest } from "next/server";
import { GET } from "@/app/api/forecasts/update-enhanced/route";

// Mock the forecast service utilities
jest.mock("@/lib/utils/forecast-service-utils", () => ({
  fetchBeachForecasts: jest.fn(),
  updateBeachForecast: jest.fn(),
}));

// Mock the API response utilities
jest.mock("@/lib/api-response-utils", () => ({
  createSuccessResponse: jest.fn((data) => 
    Response.json({ success: true, data })
  ),
  createErrorResponse: jest.fn((message, error, status = 500) =>
    Response.json({ success: false, error: message }, { status })
  ),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();

describe("/api/forecasts/update-enhanced", () => {
  const mockFetchBeachForecasts = require("@/lib/utils/forecast-service-utils").fetchBeachForecasts;
  const mockUpdateBeachForecast = require("@/lib/utils/forecast-service-utils").updateBeachForecast;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe("GET endpoint", () => {
    it("should return error when beachId is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/forecasts/update-enhanced");
      
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Beach ID is required");
    });

    it("should return fresh cached data when available and not stale", async () => {
      const mockForecasts = [
        {
          id: "forecast-1",
          beach_id: "test-beach-id",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          updated_at: new Date().toISOString(), // Fresh data
        },
      ];

      mockFetchBeachForecasts.mockResolvedValue({
        forecasts: mockForecasts,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id&days=2"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.beachId).toBe("test-beach-id");
      expect(data.data.days).toBe(2);
      expect(data.data.forecasts).toEqual(mockForecasts);
      
      // Should not call update since data is fresh
      expect(mockUpdateBeachForecast).not.toHaveBeenCalled();
    });

    it("should generate fresh forecasts when no data exists", async () => {
      // First call returns no data
      mockFetchBeachForecasts.mockResolvedValueOnce({
        forecasts: [],
      });

      // After update, return fresh data
      const freshForecasts = [
        {
          id: "forecast-1",
          beach_id: "test-beach-id",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          updated_at: new Date().toISOString(),
        },
      ];

      mockFetchBeachForecasts.mockResolvedValueOnce({
        forecasts: freshForecasts,
      });

      mockUpdateBeachForecast.mockResolvedValue();

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id&days=2"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.forecasts).toEqual(freshForecasts);
      
      // Should call update to generate fresh data
      expect(mockUpdateBeachForecast).toHaveBeenCalledWith("test-beach-id");
    });

    it("should generate fresh forecasts when data is stale (older than 6 hours)", async () => {
      const staleTime = new Date(Date.now() - 7 * 60 * 60 * 1000); // 7 hours ago
      const staleForecasts = [
        {
          id: "forecast-1",
          beach_id: "test-beach-id",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          updated_at: staleTime.toISOString(),
        },
      ];

      // First call returns stale data
      mockFetchBeachForecasts.mockResolvedValueOnce({
        forecasts: staleForecasts,
      });

      // After update, return fresh data
      const freshForecasts = [
        {
          ...staleForecasts[0],
          updated_at: new Date().toISOString(),
          wave_height: "2.8 ft", // Updated wave height
        },
      ];

      mockFetchBeachForecasts.mockResolvedValueOnce({
        forecasts: freshForecasts,
      });

      mockUpdateBeachForecast.mockResolvedValue();

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id&days=2"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.forecasts).toEqual(freshForecasts);
      
      // Should call update because data was stale
      expect(mockUpdateBeachForecast).toHaveBeenCalledWith("test-beach-id");
    });

    it("should handle forecast generation failures", async () => {
      mockFetchBeachForecasts.mockResolvedValueOnce({
        forecasts: [],
      });

      mockUpdateBeachForecast.mockRejectedValue(new Error("NOAA API unavailable"));

      // After failed update, still return empty
      mockFetchBeachForecasts.mockResolvedValueOnce({
        forecasts: [],
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id&days=2"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to fetch enhanced forecasts");
    });

    it("should use default days parameter when not provided", async () => {
      const mockForecasts = [
        {
          id: "forecast-1",
          beach_id: "test-beach-id",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          updated_at: new Date().toISOString(),
        },
      ];

      mockFetchBeachForecasts.mockResolvedValue({
        forecasts: mockForecasts,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.days).toBe(10); // Default value
      expect(mockFetchBeachForecasts).toHaveBeenCalledWith("test-beach-id", 10);
    });

    it("should handle specific Ocean Beach and Mission Beach IDs", async () => {
      const oceanBeachForecasts = [
        {
          id: "forecast-ob-1",
          beach_id: "d030911e-71ba-4678-8bbb-cd06a30f8c42",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          wave_direction: "SSW",
          updated_at: new Date().toISOString(),
        },
      ];

      mockFetchBeachForecasts.mockResolvedValue({
        forecasts: oceanBeachForecasts,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=d030911e-71ba-4678-8bbb-cd06a30f8c42&days=2"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.beachId).toBe("d030911e-71ba-4678-8bbb-cd06a30f8c42");
      expect(data.data.forecasts[0].wave_height).toBe("2.6 ft");
      expect(data.data.forecasts[0].wave_direction).toBe("SSW");
    });

    it("should log appropriate messages for data freshness", async () => {
      const freshForecasts = [
        {
          id: "forecast-1",
          beach_id: "test-beach-id",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          updated_at: new Date().toISOString(),
        },
      ];

      mockFetchBeachForecasts.mockResolvedValue({
        forecasts: freshForecasts,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id&days=2"
      );

      await GET(request);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Using fresh cached data for beach test-beach-id")
      );
    });

    it("should handle malformed beachId parameters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId="
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Beach ID is required");
    });

    it("should handle invalid days parameter", async () => {
      const mockForecasts = [
        {
          id: "forecast-1",
          beach_id: "test-beach-id",
          forecast_date: "2025-08-16",
          forecast_time: "12:00:00",
          wave_height: "2.6 ft",
          updated_at: new Date().toISOString(),
        },
      ];

      mockFetchBeachForecasts.mockResolvedValue({
        forecasts: mockForecasts,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id&days=invalid"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.days).toBe(10); // Should fall back to default
    });
  });
});