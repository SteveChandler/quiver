/** @jest-environment node */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockCreatePublicReadClient = jest.fn();
const mockFetchCachedHourlyTidePredictions = jest.fn();
const mockFetchHourlyTidePredictions = jest.fn();
const mockGetNearestTideStation = jest.fn();
const mockHasSufficientCachedTideCoverage = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: () => mockCreatePublicReadClient(),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withRateLimit: (handler: any) => handler,
}));

jest.mock("@/lib/services/noaa-coops/constants/station-mappings", () => ({
  COOPS_STATIONS: {
    "test-beach": "9410230",
  },
}));

jest.mock("@/lib/services/noaa-tide-service", () => ({
  fetchCachedHourlyTidePredictions: (...args: any[]) =>
    mockFetchCachedHourlyTidePredictions(...args),
  fetchHourlyTidePredictions: (...args: any[]) =>
    mockFetchHourlyTidePredictions(...args),
  getNearestTideStation: (...args: any[]) => mockGetNearestTideStation(...args),
  hasSufficientCachedTideCoverage: (...args: any[]) =>
    mockHasSufficientCachedTideCoverage(...args),
}));

import { GET } from "@/app/api/tools/dawn-patrol/route";

const testBeach = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  lat: 32.8,
  lon: -117.2,
  city: "San Diego",
  state: "CA",
  timezone: "America/Los_Angeles",
};

function createMaybeSingleChain(data: unknown, error: unknown = null): any {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.or = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(async () => ({ data, error }));
  return chain;
}

function createSupabaseMock(beach = testBeach): { from: jest.Mock } {
  return {
    from: jest.fn((table: string) => {
      if (table === "beaches") return createMaybeSingleChain(beach);
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/tools/dawn-patrol", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePublicReadClient.mockReturnValue(createSupabaseMock());
    mockGetNearestTideStation.mockResolvedValue(null);
  });

  it("uses cached tide_forecasts rows for the 7-day tide window", async () => {
    const cachedPredictions = [
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1.1,
        tide_phase: null,
      },
    ];

    mockFetchCachedHourlyTidePredictions.mockResolvedValue({
      predictions: cachedPredictions,
      latestCreatedAt: "2026-06-30T04:00:00.000Z",
    });
    mockHasSufficientCachedTideCoverage.mockReturnValue(true);

    const res = await GET(
      new Request("http://localhost:3000/api/tools/dawn-patrol?beachSlug=test-beach") as any
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.days).toHaveLength(7);
    expect(json.tidePredictions).toEqual(cachedPredictions);
    expect(json.dataSource).toBe("cache");
    expect(json.predictionsUpdatedAt).toBe("2026-06-30T04:00:00.000Z");
    expect(json.stationId).toBe("9410230");
    expect(mockGetNearestTideStation).not.toHaveBeenCalled();
    expect(mockFetchHourlyTidePredictions).not.toHaveBeenCalled();
  });

  it("keeps tide data optional when cache and station resolution are unavailable", async () => {
    mockCreatePublicReadClient.mockReturnValue(
      createSupabaseMock({
        ...testBeach,
        slug: "unmapped-beach",
      })
    );
    mockFetchCachedHourlyTidePredictions.mockResolvedValue({
      predictions: [],
      latestCreatedAt: null,
    });
    mockHasSufficientCachedTideCoverage.mockReturnValue(false);
    mockGetNearestTideStation.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost:3000/api/tools/dawn-patrol?beachSlug=unmapped-beach") as any
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stationId).toBeNull();
    expect(json.days).toHaveLength(7);
    expect(json.tidePredictions).toEqual([]);
    expect(json.dataSource).toBeNull();
    expect(mockFetchHourlyTidePredictions).not.toHaveBeenCalled();
  });
});
