/** @jest-environment node */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockCreatePublicReadClient = jest.fn();
const mockFetchCachedHourlyTidePredictions = jest.fn();
const mockFetchHighLowTidePredictions = jest.fn();
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
  fetchHighLowTidePredictions: (...args: any[]) =>
    mockFetchHighLowTidePredictions(...args),
  fetchHourlyTidePredictions: (...args: any[]) =>
    mockFetchHourlyTidePredictions(...args),
  getNearestTideStation: (...args: any[]) => mockGetNearestTideStation(...args),
  hasSufficientCachedTideCoverage: (...args: any[]) =>
    mockHasSufficientCachedTideCoverage(...args),
}));

import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { GET } from "@/app/api/tools/tide-clock/route";

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

function createSupabaseMock(params: {
  beach?: typeof testBeach | null;
  sunTimes?: unknown;
}): { from: jest.Mock } {
  return {
    from: jest.fn((table: string) => {
      if (table === "beaches") {
        return createMaybeSingleChain(params.beach ?? testBeach);
      }
      if (table === "sun_times") {
        return createMaybeSingleChain(params.sunTimes ?? null);
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/tools/tide-clock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePublicReadClient.mockReturnValue(createSupabaseMock({}));
    mockFetchHighLowTidePredictions.mockResolvedValue([]);
    mockGetNearestTideStation.mockResolvedValue(null);
  });

  it("uses cached tide_forecasts rows when coverage is sufficient", async () => {
    const cachedPredictions = [
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1.1,
        tide_phase: null,
      },
    ];
    const extremes = [
      {
        ts: "2026-06-30T18:12:00.000Z",
        tide_height_m: 1.5,
        type: "high",
      },
    ];

    mockFetchCachedHourlyTidePredictions.mockResolvedValue({
      predictions: cachedPredictions,
      latestCreatedAt: "2026-06-30T04:00:00.000Z",
    });
    mockHasSufficientCachedTideCoverage.mockReturnValue(true);
    mockFetchHighLowTidePredictions.mockResolvedValue(extremes);

    const res = await GET(
      new Request("http://localhost:3000/api/tools/tide-clock?beachSlug=test-beach") as any
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.predictions).toEqual(cachedPredictions);
    expect(json.dataSource).toBe("cache");
    expect(json.predictionsUpdatedAt).toBe("2026-06-30T04:00:00.000Z");
    expect(json.extremes).toEqual(extremes);
    expect(json.stationId).toBe("9410230");
    expect(mockFetchHourlyTidePredictions).not.toHaveBeenCalled();
  });

  it("falls back to live hourly NOAA predictions when cache coverage is insufficient", async () => {
    const livePredictions = [
      {
        ts: "2026-06-30T17:00:00.000Z",
        tide_height_m: 1.2,
        tide_phase: null,
      },
    ];

    mockFetchCachedHourlyTidePredictions.mockResolvedValue({
      predictions: [],
      latestCreatedAt: null,
    });
    mockHasSufficientCachedTideCoverage.mockReturnValue(false);
    mockFetchHourlyTidePredictions.mockResolvedValue(livePredictions);

    const res = await GET(
      new Request("http://localhost:3000/api/tools/tide-clock?beachSlug=test-beach") as any
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.predictions).toEqual(livePredictions);
    expect(json.dataSource).toBe("noaa_live");
    expect(json.predictionsUpdatedAt).toBeNull();
    expect(mockFetchHourlyTidePredictions).toHaveBeenCalledTimes(1);
  });

  it("returns a controlled unavailable response when cache is missing and NOAA fallback fails", async () => {
    mockFetchCachedHourlyTidePredictions.mockResolvedValue({
      predictions: [],
      latestCreatedAt: null,
    });
    mockHasSufficientCachedTideCoverage.mockReturnValue(false);
    mockFetchHourlyTidePredictions.mockRejectedValue(new Error("NOAA down"));

    const res = await GET(
      new Request("http://localhost:3000/api/tools/tide-clock?beachSlug=test-beach") as any
    );
    expectConsoleWarnings([/\[tide-clock\] Live NOAA tide fallback failed/]);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toEqual({
      error: "Tide data unavailable",
      dataSource: null,
      predictionsUpdatedAt: null,
      predictions: [],
    });
  });
});
