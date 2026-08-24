/**
 * @jest-environment node
 */
import {
  getCachedNearbyBeachesFromDb,
  getNearbyBeachesFromDb,
  normalizeNearbyBeachQuery,
} from "@/lib/services/nearby-beach-service";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockQuery = {
  select: jest.fn(),
  or: jest.fn(),
  is: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  limit: jest.fn(),
  in: jest.fn(),
};
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => mockQuery),
};
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) =>
  beaches.filter((beach) => beach.id !== "held-beach"),
);

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => mockSupabase),
}));

describe("nearby beach service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.or.mockReturnValue(mockQuery);
    mockQuery.is.mockReturnValue(mockQuery);
    mockQuery.gte.mockReturnValue(mockQuery);
    mockQuery.lte.mockReturnValue(mockQuery);
    mockQuery.limit.mockResolvedValue({ data: [], error: null });
    mockQuery.in.mockResolvedValue({ data: [], error: null });
  });

  it("hard-caps public radius and result limits", () => {
    expect(normalizeNearbyBeachQuery(500, 999)).toEqual({
      radiusMiles: 50,
      limit: 50,
    });
    expect(normalizeNearbyBeachQuery(Number.NaN, Number.NaN)).toEqual({
      radiusMiles: 30,
      limit: 20,
    });
  });

  it("uses the bounded spatial RPC for the normal path", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(
      getNearbyBeachesFromDb(32.7, -117.2, 500, 999),
    ).resolves.toEqual({
      success: true,
      data: [],
      fallbackUsed: false,
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_nearby_beaches", {
      input_lat: 32.7,
      input_lng: -117.2,
      max_distance_meters: Math.round(50 * 1609.34),
      limit_count: 55,
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("coalesces nearby queries for the same rounded map region", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const first = getCachedNearbyBeachesFromDb(31.12341, -118.54321, 30, 20);
    const second = getCachedNearbyBeachesFromDb(31.12344, -118.54324, 30, 20);

    await expect(Promise.all([first, second])).resolves.toEqual([
      { success: true, data: [], fallbackUsed: false },
      { success: true, data: [], fallbackUsed: false },
    ]);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns only rows confirmed public and non-deleted", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          id: "public-beach",
          name: "Public Beach",
          lat: 32.7,
          lon: -117.2,
          is_private: false,
          country: "USA",
        },
        {
          id: "private-beach",
          name: "Private Beach",
          lat: 32.71,
          lon: -117.21,
          is_private: true,
          country: "USA",
        },
        {
          id: "deleted-beach",
          name: "Deleted Beach",
          lat: 32.72,
          lon: -117.22,
          is_private: false,
          country: "USA",
        },
      ],
      error: null,
    });
    mockQuery.in.mockResolvedValue({
      data: [{ id: "public-beach", country: "USA" }],
      error: null,
    });

    await expect(
      getNearbyBeachesFromDb(32.7, -117.2, 30, 20),
    ).resolves.toMatchObject({
      success: true,
      data: [{ id: "public-beach", name: "Public Beach" }],
      fallbackUsed: false,
    });
    expect(mockQuery.or).toHaveBeenCalledWith(
      "is_private.is.null,is_private.eq.false",
    );
    expect(mockQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mockQuery.in).toHaveBeenCalledWith("id", [
      "public-beach",
      "private-beach",
      "deleted-beach",
    ]);
  });

  it("returns held beaches for map visibility with an additive warning flag", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          id: "held-beach",
          name: "Held Beach",
          lat: 32.7,
          lon: -117.2,
          is_private: false,
          country: "USA",
        },
        {
          id: "safe-beach",
          name: "Safe Beach",
          lat: 32.71,
          lon: -117.21,
          is_private: false,
          country: "USA",
        },
      ],
      error: null,
    });
    mockQuery.in.mockResolvedValue({
      data: [
        { id: "held-beach", country: "USA" },
        { id: "safe-beach", country: "USA" },
      ],
      error: null,
    });

    await expect(
      getNearbyBeachesFromDb(32.7, -117.2, 30, 20),
    ).resolves.toMatchObject({
      success: true,
      data: [
        { id: "held-beach", waterQualityHold: true },
        { id: "safe-beach", waterQualityHold: false },
      ],
    });
  });

  it("bounds the exceptional fallback by box and candidate cap", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "RPC unavailable" },
    });

    await expect(
      getNearbyBeachesFromDb(32.7, -117.2, 30, 20),
    ).resolves.toEqual({
      success: true,
      data: [],
      fallbackUsed: true,
    });
    expectConsoleWarnings([/Spatial function failed, using bounded nearby fallback/]);
    expect(mockQuery.gte).toHaveBeenCalledWith("lat", expect.any(Number));
    expect(mockQuery.lte).toHaveBeenCalledWith("lat", expect.any(Number));
    expect(mockQuery.gte).toHaveBeenCalledWith("lon", expect.any(Number));
    expect(mockQuery.lte).toHaveBeenCalledWith("lon", expect.any(Number));
    expect(mockQuery.limit).toHaveBeenCalledWith(200);
  });
});
