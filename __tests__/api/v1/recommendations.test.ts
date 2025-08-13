/**
 * @jest-environment node
 */

import { GET } from "@/app/api/v1/recommendations/route";
import { NextRequest } from "next/server";
import { createMocks } from "node-mocks-http";

// Mock the Supabase client
const mockSupabaseClient = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [
                {
                  ts: "2024-01-01T12:00:00Z",
                  wave_height_m: 1.5,
                  wave_period_s: 12,
                  wind_speed_ms: 5,
                  wind_direction_deg: 90,
                  wave_direction_deg: 225,
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
};

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: () => mockSupabaseClient,
}));

// Mock the recommendation scorer
jest.mock("@/lib/utils/recommendation-scorer", () => ({
  scoreRecommendation: jest.fn(() => ({
    score: 75,
    reasons: ["good_waves", "offshore_wind", "mid_tide"],
  })),
}));

describe("/api/v1/recommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock for valid coordinates
    mockSupabaseClient.rpc.mockResolvedValue({
      data: [
        {
          id: "beach-1",
          name: "Test Beach 1",
          latitude: 33.7490,
          longitude: -118.4095,
          distance_km: 2.5,
        },
        {
          id: "beach-2", 
          name: "Test Beach 2",
          latitude: 33.7500,
          longitude: -118.4100,
          distance_km: 3.2,
        },
      ],
      error: null,
    });
  });

  describe("GET", () => {
    it("should return recommendations with valid lat/lon", async () => {
      const url = new URL("http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095");
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.recommendations)).toBe(true);
      expect(Array.isArray(data.data.top_picks)).toBe(true);
      expect(data.data.metadata).toBeDefined();
    });

    it("should return top 3 picks with enriched data", async () => {
      const url = new URL("http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095");
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.top_picks).toBeDefined();
      expect(data.data.top_picks.length).toBeLessThanOrEqual(3);
      
      if (data.data.top_picks.length > 0) {
        const topPick = data.data.top_picks[0];
        expect(topPick).toHaveProperty("rank", 1);
        expect(topPick).toHaveProperty("isTopPick", true);
        expect(topPick).toHaveProperty("snapshot");
        expect(topPick.snapshot).toHaveProperty("timestamp");
        expect(topPick.snapshot).toHaveProperty("conditions");
        expect(topPick.snapshot).toHaveProperty("quality_indicators");
      }
    });

    it("should include metadata in response", async () => {
      const timeIso = "2024-01-01T12:00:00Z";
      const url = new URL(`http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095&time=${timeIso}&skill=intermediate`);
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.metadata).toEqual({
        query_time: timeIso,
        location: { lat: 33.7490, lon: -118.4095 },
        total_spots_analyzed: expect.any(Number),
        user_skill: "intermediate",
      });
    });

    it("should handle missing lat/lon gracefully", async () => {
      // The API should return empty results when lat/lon are missing or invalid
      const url = new URL("http://localhost:3000/api/v1/recommendations");
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({ recommendations: [] });
    });

    it("should handle invalid lat/lon gracefully", async () => {
      const url = new URL("http://localhost:3000/api/v1/recommendations?lat=invalid&lon=invalid");
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({ recommendations: [] });
    });

    it("should include wave, wind, and tide data in recommendations", async () => {
      const url = new URL("http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095");
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      if (data.data.recommendations.length > 0) {
        const rec = data.data.recommendations[0];
        expect(rec).toHaveProperty("wave");
        expect(rec).toHaveProperty("wind");
        expect(rec).toHaveProperty("tide");
        expect(rec).toHaveProperty("score");
        expect(rec).toHaveProperty("reasons");
        expect(rec).toHaveProperty("spotId");
        expect(rec).toHaveProperty("name");
      }
    });

    it("should sort recommendations by score descending", async () => {
      // Mock multiple beaches with different scores
      const mockScorer = require("@/lib/utils/recommendation-scorer").scoreRecommendation;
      mockScorer
        .mockReturnValueOnce({ score: 60, reasons: ["moderate_conditions"] })
        .mockReturnValueOnce({ score: 85, reasons: ["excellent_conditions"] });

      const url = new URL("http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095");
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      if (data.data.recommendations.length > 1) {
        for (let i = 0; i < data.data.recommendations.length - 1; i++) {
          expect(data.data.recommendations[i].score).toBeGreaterThanOrEqual(
            data.data.recommendations[i + 1].score
          );
        }
      }
    });

    it("should handle time parameter correctly", async () => {
      const timeIso = "2024-06-15T15:30:00Z";
      const url = new URL(`http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095&time=${timeIso}`);
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.metadata.query_time).toBe(timeIso);
    });

    it("should use current time when time parameter is not provided", async () => {
      const url = new URL("http://localhost:3000/api/v1/recommendations?lat=33.7490&lon=-118.4095");
      const request = new NextRequest(url);

      const beforeTime = new Date().toISOString();
      const response = await GET(request);
      const afterTime = new Date().toISOString();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.metadata.query_time).toBeDefined();
      
      const queryTime = new Date(data.data.metadata.query_time);
      expect(queryTime.getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(queryTime.getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });
  });
});