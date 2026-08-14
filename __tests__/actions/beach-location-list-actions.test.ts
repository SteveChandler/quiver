/**
 * @jest-environment node
 */

import type { BeachWithMetrics } from "@/types/location";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createPublicReadClient: jest.fn(),
}));

jest.mock("@/lib/recommendations/major-event-hold/water-quality-visibility", () => ({
  filterBeachesByWaterQualityVisibility: jest.fn(async (beaches) => beaches),
}));

const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

function createThenableQuery<T>(result: {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}) {
  const self: any = {};

  self.select = jest.fn((_sel?: any, _opts?: any) => self);
  self.eq = jest.fn((_field?: any, _value?: any) => self);
  self.ilike = jest.fn((_field?: any, _value?: any) => self);
  self.in = jest.fn((_field?: any, _values?: any) => self);
  self.gte = jest.fn((_field?: any, _value?: any) => self);
  self.lte = jest.fn((_field?: any, _value?: any) => self);
  self.order = jest.fn((_field?: any, _opts?: any) => self);
  self.limit = jest.fn((_n?: any) => self);
  self.single = jest.fn(() => Promise.resolve(result));

  self.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);

  return self;
}

describe("beach-location-list-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("getLocationPageData: metro path ranks beaches and returns stats", async () => {
    const { createSupabaseServerClient, createPublicReadClient } = await import("@/lib/supabase/server");

    const beaches: BeachWithMetrics[] = [
      {
        id: "b1",
        name: "Beach 1",
        slug: "beach-1",
        city: "La Jolla",
        state: "CA",
        country: "USA",
        lat: 32.8,
        lon: -117.2,
        average_rating: 4.2,
        review_count: 10,
        compositeScore: 0.9,
        recentIntelCount: 3,
        avgConfirmations: 2.5,
        rank: 0, // overwritten by action
      } as any,
      {
        id: "b2",
        name: "Beach 2",
        slug: "beach-2",
        city: "Pacific Beach",
        state: "CA",
        country: "USA",
        lat: 32.79,
        lon: -117.25,
        average_rating: 4.0,
        review_count: 5,
        compositeScore: 0.8,
        recentIntelCount: 1,
        avgConfirmations: 1.2,
        rank: 0,
      } as any,
    ];

    const mockSupabase = {
      rpc: jest.fn(async (fn: string) => {
        if (fn === "get_beaches_by_metro_with_scores") {
          return { data: beaches, error: null };
        }
        if (fn === "get_metro_stats") {
          return {
            data: [
              {
                total_beaches: 2,
                average_rating: "4.1",
                total_reviews: 15,
                top_beaches: 1,
              },
            ],
            error: null,
          };
        }
        throw new Error(`Unexpected rpc: ${fn}`);
      }),
      from: jest.fn(() => createThenableQuery({ data: null, error: null, count: 0 })),
    };

    (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue(mockSupabase);
    (createPublicReadClient as unknown as jest.Mock).mockReturnValue(mockSupabase);

    const { getLocationPageData } = await import(
      "@/actions/beach/beach-location-list-actions"
    );

    const res = await getLocationPageData("san-diego", "ca", "usa");

    expect(res.success).toBe(true);
    expect(res.data?.location.city).toBe("San Diego");
    expect(res.data?.beaches).toHaveLength(2);
    expect(res.data?.beaches[0].rank).toBe(1);
    expect(res.data?.beaches[1].rank).toBe(2);
  });

  test('getLocationPageData: metro path with no beaches returns error "CITY_EXISTS_NO_DATA"', async () => {
    const { createSupabaseServerClient, createPublicReadClient } = await import("@/lib/supabase/server");

    const mockSupabase = {
      rpc: jest.fn(async (fn: string) => {
        if (fn === "get_beaches_by_metro_with_scores") {
          return { data: [], error: null };
        }
        if (fn === "get_metro_stats") {
          return { data: [], error: null };
        }
        throw new Error(`Unexpected rpc: ${fn}`);
      }),
      from: jest.fn(() => createThenableQuery({ data: null, error: null, count: 0 })),
    };

    (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue(mockSupabase);
    (createPublicReadClient as unknown as jest.Mock).mockReturnValue(mockSupabase);

    const { getLocationPageData } = await import(
      "@/actions/beach/beach-location-list-actions"
    );

    const res = await getLocationPageData("san-diego", "ca", "usa");

    expect(res.success).toBe(false);
    expect(res.error).toBe("CITY_EXISTS_NO_DATA");
    expectConsoleErrors([/CITY_EXISTS_NO_DATA/]);
  });

  test("getLocationPageData: city path ranks beaches", async () => {
    const { createSupabaseServerClient, createPublicReadClient } = await import("@/lib/supabase/server");

    const beaches: BeachWithMetrics[] = [
      {
        id: "b1",
        name: "Beach 1",
        slug: "beach-1",
        city: "La Jolla",
        state: "CA",
        country: "USA",
        lat: 32.8,
        lon: -117.2,
        average_rating: 4.2,
        review_count: 10,
        compositeScore: 0.9,
        recentIntelCount: 3,
        avgConfirmations: 2.5,
        rank: 0,
      } as any,
    ];

    const mockSupabase = {
      rpc: jest.fn(async (fn: string) => {
        if (fn === "get_beaches_by_location_with_scores") {
          return { data: beaches, error: null };
        }
        if (fn === "get_location_stats") {
          return {
            data: [
              {
                average_rating: "4.2",
                total_reviews: 10,
                top_beaches: 1,
              },
            ],
            error: null,
          };
        }
        throw new Error(`Unexpected rpc: ${fn}`);
      }),
      from: jest.fn(() => createThenableQuery({ data: null, error: null, count: 0 })),
    };

    (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue(mockSupabase);
    (createPublicReadClient as unknown as jest.Mock).mockReturnValue(mockSupabase);

    const { getLocationPageData } = await import(
      "@/actions/beach/beach-location-list-actions"
    );

    const res = await getLocationPageData("la-jolla", "ca", "usa");

    expect(res.success).toBe(true);
    expect(res.data?.location.city).toBe("La Jolla");
    expect(res.data?.beaches[0].rank).toBe(1);
  });

  test("getLocationPageData: city path retries using slug→DB-city resolution when initial RPC returns empty", async () => {
    const { createSupabaseServerClient, createPublicReadClient } = await import("@/lib/supabase/server");

    const beachesResolved: BeachWithMetrics[] = [
      {
        id: "b1",
        name: "Playa Domes",
        slug: "playa-domes",
        city: "Rincón",
        state: "PR",
        country: "USA",
        lat: 18.3,
        lon: -67.2,
        average_rating: 4.5,
        review_count: 8,
        compositeScore: 0.85,
        recentIntelCount: 1,
        avgConfirmations: 1.0,
        rank: 0,
      } as any,
    ];

    const rpc = jest.fn(async (fn: string, params?: any) => {
      if (fn === "get_beaches_by_location_with_scores") {
        // First attempt returns empty for "Rincon", second attempt returns data for "Rincón"
        return params?.p_city === "Rincón"
          ? { data: beachesResolved, error: null }
          : { data: [], error: null };
      }
      if (fn === "get_all_beach_locations") {
        return {
          data: [{ city: "Rincón", state: "PR", country: "USA", beach_count: 1 }],
          error: null,
        };
      }
      if (fn === "get_location_stats") {
        return {
          data: [
            {
              average_rating: "4.5",
              total_reviews: 8,
              top_beaches: 1,
            },
          ],
          error: null,
        };
      }
      throw new Error(`Unexpected rpc: ${fn}`);
    });

    const mockSupabase = {
      rpc,
      from: jest.fn(() => createThenableQuery({ data: null, error: null, count: 0 })),
    };

    (createSupabaseServerClient as unknown as jest.Mock).mockResolvedValue(mockSupabase);
    (createPublicReadClient as unknown as jest.Mock).mockReturnValue(mockSupabase);

    const { getLocationPageData } = await import(
      "@/actions/beach/beach-location-list-actions"
    );

    const res = await getLocationPageData("rincon", "pr", "usa");

    expect(res.success).toBe(true);
    expect(res.data?.location.city).toBe("Rincón");
    expect(rpc).toHaveBeenCalledWith(
      "get_all_beach_locations"
    );
    expect(rpc).toHaveBeenCalledWith(
      "get_beaches_by_location_with_scores",
      expect.objectContaining({ p_city: "Rincón" })
    );
  });
});




