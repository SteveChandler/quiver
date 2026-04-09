/**
 * Tests for GET /api/forecasts/update-enhanced
 * 
 * Validates "never serve stale" behavior:
 * - Returns empty forecasts when cache is stale
 * - Returns empty forecasts when cache is missing
 * - Returns forecasts only when fresh
 * - Includes appropriate metadata in all cases
 */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockGetFreshForecastFromCache = jest.fn() as jest.MockedFunction<(...args: any[]) => Promise<any>>;

jest.mock("@/lib/utils/forecast-server-utils", () => ({
  updateBeachForecast: jest.fn(),
  updateAllBeachForecasts: jest.fn(),
  getFreshForecastFromCache: (...args: any[]) => mockGetFreshForecastFromCache(...args),
}));

jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(() => Promise.resolve({ success: false, status: 401, error: "Unauthorized" })),
}));

// Supabase client mocks. The route uses two distinct clients:
//   1. createSupabaseServiceRoleClient — mergeMLCorrections →
//      .from("corrected_forecasts").select().eq().gte().lte()
//   2. createPublicReadClient (anon, no cookies) — calibration lookup →
//      .from("beaches").select().eq().maybeSingle()
// Public read is used for the beaches row because `shoaling_factors` is
// publicly readable via RLS; the route no longer escalates to service-role
// just to read that column.
// Tests override `mockBeachShoalingFactors`: a value = calibrated,
// `null` = forecast-only, `undefined` = beach row not found.
let mockBeachShoalingFactors: unknown | undefined = null;
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn((_table: string) => ({
      // corrected_forecasts (mergeMLCorrections) — return no corrections
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() =>
              Promise.resolve({ data: [], error: null })
            ),
          })),
        })),
      })),
    })),
  })),
  createPublicReadClient: jest.fn(() => ({
    from: jest.fn((_table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data:
                mockBeachShoalingFactors === undefined
                  ? null
                  : { shoaling_factors: mockBeachShoalingFactors },
              error: null,
            })
          ),
        })),
      })),
    })),
  })),
}));

describe("GET /api/forecasts/update-enhanced", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("returns empty forecasts when cache is stale (never serve stale)", async () => {
    mockGetFreshForecastFromCache.mockResolvedValueOnce({
      forecasts: [], // Empty because stale
      metadata: {
        cached: true,
        stale: true,
        missing: false,
        reason: "Data is 14.5h old (threshold: 12h) - refusing to serve stale cache",
        stalenessDetails: {
          hoursSinceUpdate: 14.5,
          threshold: 12,
          isStale: true,
          reason: "Exceeded source-specific threshold",
        },
      },
    });

    const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
    const res = await GET(
      new Request("http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id") as any
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.forecasts).toEqual([]);
    expect(json.data.metadata.stale).toBe(true);
    expect(json.data.metadata.cached).toBe(true);
    expect(json.data.metadata.reason).toContain("refusing to serve stale cache");
    
    // Verify no-store cache header for stale data
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns empty forecasts when cache is missing", async () => {
    mockGetFreshForecastFromCache.mockResolvedValueOnce({
      forecasts: [],
      metadata: {
        cached: false,
        stale: false,
        missing: true,
        reason: "No forecast data in cache - waiting for background job",
      },
    });

    const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
    const res = await GET(
      new Request("http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id") as any
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.forecasts).toEqual([]);
    expect(json.data.metadata.missing).toBe(true);
    expect(json.data.metadata.reason).toContain("waiting for background job");
    
    // Verify no-store cache header for missing data
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns forecasts with caching headers when cache is fresh", async () => {
    const mockForecasts = [
      {
        id: "1",
        beach_id: "test-beach-id",
        forecast_at: "2025-01-01T12:00:00Z",
        forecast_date: "2025-01-01",
        forecast_time: "12:00:00",
        wave_height: "3 ft",
        data_source: "NOAA_NWS",
      },
    ];

    mockGetFreshForecastFromCache.mockResolvedValueOnce({
      forecasts: mockForecasts,
      metadata: {
        cached: true,
        stale: false,
        missing: false,
        reason: null,
        stalenessDetails: {
          hoursSinceUpdate: 2.5,
          threshold: 12,
          isStale: false,
          reason: "Within freshness window",
        },
      },
    });

    const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
    const res = await GET(
      new Request("http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id") as any
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.forecasts).toHaveLength(1);
    expect(json.data.metadata.stale).toBe(false);
    expect(json.data.metadata.cached).toBe(true);
    
    // Verify caching headers for fresh data
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=600");
  });

  it("returns error when beachId is missing", async () => {
    const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
    const res = await GET(
      new Request("http://localhost:3000/api/forecasts/update-enhanced") as any
    );

    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("Beach ID is required");
  });

  it("passes correct windowHours based on days parameter", async () => {
    mockGetFreshForecastFromCache.mockResolvedValueOnce({
      forecasts: [],
      metadata: {
        cached: true,
        stale: true,
        missing: false,
        reason: "stale",
        stalenessDetails: { hoursSinceUpdate: 15, threshold: 12, isStale: true, reason: "stale" },
      },
    });

    const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
    await GET(
      new Request("http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach&days=5") as any
    );

    // 5 days * 24 hours = 120 hours
    expect(mockGetFreshForecastFromCache).toHaveBeenCalledWith("test-beach", 120);
  });

  describe("isCalibrated honesty-layer envelope", () => {
    const freshMockCache = (forecasts: any[]) => ({
      forecasts,
      metadata: {
        cached: true,
        stale: false,
        missing: false,
        reason: null,
        stalenessDetails: {
          hoursSinceUpdate: 1,
          threshold: 12,
          isStale: false,
          reason: "fresh",
        },
      },
    });

    const mockForecast = {
      id: "1",
      beach_id: "test-beach-id",
      forecast_at: "2025-01-01T12:00:00Z",
      forecast_date: "2025-01-01",
      forecast_time: "12:00:00",
      wave_height: "3 ft",
      data_source: "NOAA_NWS",
    };

    it("stamps isCalibrated=true when shoaling_factors is present", async () => {
      mockBeachShoalingFactors = { site_id: "foo", factors: [1, 2, 3] };
      mockGetFreshForecastFromCache.mockResolvedValueOnce(
        freshMockCache([mockForecast])
      );

      const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
      const res = await GET(
        new Request(
          "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id"
        ) as any
      );
      const json = await res.json();

      expect(json.data.forecasts).toHaveLength(1);
      expect(json.data.forecasts[0].isCalibrated).toBe(true);
      // shoaling_factors itself must never be exposed in the envelope
      expect(json.data.forecasts[0].shoaling_factors).toBeUndefined();
    });

    it("stamps isCalibrated=false when shoaling_factors is null", async () => {
      mockBeachShoalingFactors = null;
      mockGetFreshForecastFromCache.mockResolvedValueOnce(
        freshMockCache([mockForecast])
      );

      const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
      const res = await GET(
        new Request(
          "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id"
        ) as any
      );
      const json = await res.json();

      expect(json.data.forecasts[0].isCalibrated).toBe(false);
    });

    it("defaults isCalibrated=false when beach row is not found", async () => {
      mockBeachShoalingFactors = undefined; // maybeSingle → { data: null }
      mockGetFreshForecastFromCache.mockResolvedValueOnce(
        freshMockCache([mockForecast])
      );

      const { GET } = await import("@/app/api/forecasts/update-enhanced/route");
      const res = await GET(
        new Request(
          "http://localhost:3000/api/forecasts/update-enhanced?beachId=test-beach-id"
        ) as any
      );
      const json = await res.json();

      expect(json.data.forecasts[0].isCalibrated).toBe(false);
    });
  });
});

