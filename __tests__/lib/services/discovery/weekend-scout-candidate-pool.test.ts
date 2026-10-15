import {
  buildDriveRangeCandidatePool,
  buildWeekendScoutCandidatePool,
  type WeekendScoutCandidatePoolDependencies,
} from "@/lib/services/discovery/weekend-scout-candidate-pool";
import type { PoolBeach } from "@/lib/alerts/user-pool";
import type { Beach } from "@/types/database";

function beach(id: string, overrides: Partial<Beach> = {}): Beach {
  return {
    id,
    name: id,
    is_private: false,
    deleted_at: null,
    ...overrides,
  } as Beach;
}

function dependencies(
  rows: Array<{ id: string; distance_meters: number; total_count: number }>,
  beaches: Beach[]
): WeekendScoutCandidatePoolDependencies {
  return {
    fetchNearbyRows: jest.fn().mockResolvedValue(rows),
    fetchBeaches: jest.fn().mockResolvedValue(beaches),
  };
}

describe("buildWeekendScoutCandidatePool", () => {
  it("queries the exact GPS radius and preserves distance order", async () => {
    const deps = dependencies(
      [
        { id: "near", distance_meters: 1609.344, total_count: 2 },
        { id: "far", distance_meters: 8046.72, total_count: 2 },
      ],
      [beach("far"), beach("near")]
    );

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps
    );

    expect(deps.fetchNearbyRows).toHaveBeenCalledWith({
      userId: "user-1",
      lat: 21.31,
      lon: -157.86,
      maxDistanceMeters: 40234,
      offsetCount: 0,
      limitCount: 1000,
      requirePagedCoverage: false,
    });
    expect(deps.fetchBeaches).toHaveBeenCalledWith(["near", "far"]);
    expect(result).toEqual(expect.objectContaining({
      candidates: [
        { beach: expect.objectContaining({ id: "near" }), distanceMiles: 1 },
        { beach: expect.objectContaining({ id: "far" }), distanceMiles: 5 },
      ],
      wasTruncated: false,
    }));
  });

  it("fails closed when the RPC reports more eligible rows than it returned", async () => {
    const deps = dependencies(
      [{ id: "near", distance_meters: 1609.344, total_count: 1001 }],
      [beach("near")]
    );

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps
    );

    expect(result.wasTruncated).toBe(true);
  });

  it("fails closed when duplicate IDs leave the reported inventory unaccounted for", async () => {
    const deps = dependencies(
      [
        { id: "near", distance_meters: 1609.344, total_count: 2 },
        { id: "near", distance_meters: 1609.344, total_count: 2 },
      ],
      [beach("near")],
    );

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps,
    );

    expect(result.incomplete).toBe(true);
  });

  it("fails closed when a later paged response is empty before total_count is met", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `beach-${index}`,
      distance_meters: index + 1,
      total_count: 501,
    }));
    const deps: WeekendScoutCandidatePoolDependencies = {
      fetchNearbyRows: jest.fn(async ({ offsetCount }) => offsetCount === 0 ? firstPage : []),
      fetchBeaches: jest.fn().mockResolvedValue(firstPage.map((row) => beach(row.id))),
    };

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      {
        userLocation: { lat: 21.31, lon: -157.86 },
        radiusMiles: 25,
        requirePagedCoverage: true,
      },
      deps,
    );

    expect(result.incomplete).toBe(true);
    expect(deps.fetchNearbyRows).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a broken RPC repeats a full page without inventory progress", async () => {
    const repeatedPage = Array.from({ length: 500 }, (_, index) => ({
      id: `beach-${index}`,
      distance_meters: index + 1,
      total_count: 1001,
    }));
    const deps: WeekendScoutCandidatePoolDependencies = {
      fetchNearbyRows: jest.fn().mockResolvedValue(repeatedPage),
      fetchBeaches: jest.fn().mockResolvedValue(repeatedPage.map((row) => beach(row.id))),
    };

    const result = await buildWeekendScoutCandidatePool(
      'user-1',
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25, requirePagedCoverage: true },
      deps,
    );

    expect(result.incomplete).toBe(true);
    expect(deps.fetchNearbyRows).toHaveBeenCalledTimes(2);
  });

  it("keeps candidates beyond the old 30 and 50 caps", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      id: `beach-${index}`,
      distance_meters: index + 1,
      total_count: 51,
    }));
    const deps = dependencies(rows, rows.map((row) => beach(row.id)));
    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps,
    );

    expect(result.candidates).toHaveLength(51);
    expect(result.incomplete).toBe(false);
    expect(result.candidates.map((candidate) => candidate.beach.id)).toContain("beach-50");
  });

  it("fails closed when a returned beach cannot be loaded safely", async () => {
    const deps = dependencies(
      [
        { id: "near", distance_meters: 1609.344, total_count: 2 },
        { id: "missing", distance_meters: 3218.688, total_count: 2 },
      ],
      [beach("near")]
    );

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps
    );

    expect(result.candidates.map((candidate) => candidate.beach.id)).toEqual(["near"]);
    expect(result.wasTruncated).toBe(true);
  });

  it("excludes beaches that are not recommendation eligible", async () => {
    const withheld = beach("withheld") as Beach & {
      recommendation_eligible: boolean;
    };
    withheld.recommendation_eligible = false;
    const deps = dependencies(
      [{ id: "withheld", distance_meters: 1609.344, total_count: 1 }],
      [withheld]
    );

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 41.05, lon: -124.15 }, radiusMiles: 25 },
      deps
    );

    expect(result.candidates).toEqual([]);
    expect(result.wasTruncated).toBe(true);
  });

  it('treats scoped filter removals as known exclusions, not incomplete inventory', async () => {
    const rows = [
      { id: 'mixed-beach', distance_meters: 100, total_count: 2 },
      { id: 'reef', distance_meters: 200, total_count: 2 },
    ];
    const deps = dependencies(rows, [
      beach('mixed-beach', { break_type: 'Beach-Break' } as Partial<Beach>),
      beach('reef', { break_type: 'REEF' } as Partial<Beach>),
    ]);

    const result = await buildWeekendScoutCandidatePool('user-1', {
      userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25, filters: ['beach'],
    }, deps);

    expect(result.incomplete).toBe(false);
    expect(result.candidates.map((candidate) => candidate.beach.id)).toEqual(['mixed-beach']);
    expect(result).toEqual(expect.objectContaining({ enumeratedCount: 2, hydratedCount: 2, filteredOutCount: 1 }));
  });

  it("returns an empty pool without adding home or saved beaches", async () => {
    const deps = dependencies([], []);

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps
    );

    expect(result).toEqual(expect.objectContaining({ candidates: [], wasTruncated: false }));
    expect(deps.fetchBeaches).not.toHaveBeenCalled();
  });

  it("rejects invalid coordinates and radius before querying", async () => {
    const deps = dependencies([], []);

    await expect(
      buildWeekendScoutCandidatePool(
        "user-1",
        { userLocation: { lat: 91, lon: -157.86 }, radiusMiles: 25 },
        deps
      )
    ).rejects.toThrow(/coordinates/i);
    await expect(
      buildWeekendScoutCandidatePool(
        "user-1",
        { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 0 },
        deps
      )
    ).rejects.toThrow(/radius/i);
    expect(deps.fetchNearbyRows).not.toHaveBeenCalled();
  });

  it("propagates infrastructure failures instead of treating them as no candidates", async () => {
    const deps = dependencies([], []);
    (deps.fetchNearbyRows as jest.Mock).mockRejectedValueOnce(new Error("rpc failed"));

    await expect(
      buildWeekendScoutCandidatePool(
        "user-1",
        { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
        deps
      )
    ).rejects.toThrow("rpc failed");
  });
});

describe("buildDriveRangeCandidatePool", () => {
  const anchor = { lat: 32.767, lon: -117.188 };

  it("uses the alert pool for the anchor and drive range, then the Week Scout filters", async () => {
    const pool: PoolBeach[] = [
      { beach: beach("home", { lat: 32.747, lon: -117.254, break_type: "beach" } as Partial<Beach>), relation: "home", distanceMiles: 3.9 },
      { beach: beach("saved-reef", { lat: 32.887, lon: -117.252, break_type: "reef" } as Partial<Beach>), relation: "favorite", distanceMiles: 9.1 },
      { beach: beach("harbor", { lat: 33.204, lon: -117.394, break_type: "beach" } as Partial<Beach>), relation: "nearby", distanceMiles: 32.5 },
    ];
    const loadPool = jest.fn().mockResolvedValue(pool);

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor,
      homeBeachId: "home",
      maxDriveMinutes: 90,
      filters: ["beach"],
    }, { loadPool, supabase: {} as never });

    expect(loadPool).toHaveBeenCalledWith({
      supabase: {},
      userId: "user-1",
      homeBeachId: "home",
      location: anchor,
      maxDriveMinutes: 90,
    });
    expect(result.candidates.map(({ beach: { id }, distanceMiles }) => [id, distanceMiles])).toEqual([
      ["home", 3.9],
      ["harbor", 32.5],
    ]);
    expect(result).toEqual(expect.objectContaining({ enumeratedCount: 3, filteredOutCount: 1 }));
  });

  it("scores the 50 nearest beaches plus every saved and home spot in range", async () => {
    const nearby: PoolBeach[] = Array.from({ length: 60 }, (_, index) => ({
      beach: beach(`nearby-${index}`, { lat: 33, lon: -118 } as Partial<Beach>),
      relation: "nearby",
      distanceMiles: 60 - index,
    }));
    const saved: PoolBeach[] = [
      { beach: beach("home", { lat: 33, lon: -118 } as Partial<Beach>), relation: "home", distanceMiles: 2 },
      { beach: beach("far-saved", { lat: 33, lon: -118 } as Partial<Beach>), relation: "favorite", distanceMiles: 95 },
    ];
    const loadPool = jest.fn().mockResolvedValue([...saved, ...nearby]);

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor,
      homeBeachId: "home",
      maxDriveMinutes: null,
    }, { loadPool, supabase: {} as never });

    const ids = result.candidates.map(({ beach: { id } }) => id);
    expect(ids).toHaveLength(52);
    expect(ids).toEqual(expect.arrayContaining(["home", "far-saved", "nearby-59", "nearby-10"]));
    expect(ids).not.toContain("nearby-9");
    expect(result).toEqual(expect.objectContaining({ cappedCount: 10, farthestNearbyMiles: 50 }));
  });

  it("widens an empty drive range to the 100-mile maximum and names the nearest beach", async () => {
    const jetty: PoolBeach = { beach: beach("jetty", { slug: "jetty", lat: 39.28, lon: -74.57 } as Partial<Beach>), relation: "nearby", distanceMiles: 54.7 };
    const ac: PoolBeach = { beach: beach("ac", { slug: "ac", lat: 39.36, lon: -74.43 } as Partial<Beach>), relation: "nearby", distanceMiles: 56.7 };
    const loadPool = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([ac, jetty]);
    const findNearest = jest.fn();

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor, homeBeachId: "home", maxDriveMinutes: 90,
    }, { loadPool, findNearest, supabase: {} as never });

    expect(loadPool).toHaveBeenNthCalledWith(2, expect.objectContaining({ maxDriveMinutes: null }));
    expect(result.candidates.map(({ beach: { id } }) => id)).toEqual(["ac", "jetty"]);
    expect(result.widenedFromMiles).toBe(45);
    expect(result.nearestBeach).toEqual({ id: "jetty", name: "jetty", slug: "jetty", distanceMiles: 54.7 });
    expect(findNearest).not.toHaveBeenCalled();
  });

  it("names the nearest beach at any distance when even 100 miles is empty", async () => {
    const loadPool = jest.fn().mockResolvedValue([]);
    const nearest = { id: "bolsa", name: "Bolsa Chica", slug: "bolsa-chica", distanceMiles: 830 };
    const findNearest = jest.fn().mockResolvedValue(nearest);

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor, homeBeachId: null, maxDriveMinutes: 90,
    }, { loadPool, findNearest, supabase: {} as never });

    expect(result.candidates).toEqual([]);
    expect(result.widenedFromMiles).toBeUndefined();
    expect(result.nearestBeach).toEqual(nearest);
  });

  it("goes straight to the nearest beach when a No-limit range is empty", async () => {
    const loadPool = jest.fn().mockResolvedValue([]);
    const findNearest = jest.fn().mockResolvedValue(null);

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor, homeBeachId: null, maxDriveMinutes: null,
    }, { loadPool, findNearest, supabase: {} as never });

    expect(loadPool).toHaveBeenCalledTimes(1);
    expect(findNearest).toHaveBeenCalledTimes(1);
    expect(result.widenedFromMiles).toBeUndefined();
    expect(result.nearestBeach).toBeUndefined();
  });

  it("leaves an empty range alone when the caller opts out of widening", async () => {
    const loadPool = jest.fn().mockResolvedValue([]);
    const findNearest = jest.fn();

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor, homeBeachId: null, maxDriveMinutes: 90, widenEmptyRange: false,
    }, { loadPool, findNearest, supabase: {} as never });

    expect(loadPool).toHaveBeenCalledTimes(1);
    expect(findNearest).not.toHaveBeenCalled();
    expect(result.candidates).toEqual([]);
  });

  it("does not widen a range that has beaches, even when filters empty it", async () => {
    const loadPool = jest.fn().mockResolvedValue([
      { beach: beach("reef", { lat: 32.8, lon: -117.25, break_type: "reef" } as Partial<Beach>), relation: "nearby", distanceMiles: 5 },
    ] satisfies PoolBeach[]);

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor, homeBeachId: null, maxDriveMinutes: 90, filters: ["beach"],
    }, { loadPool, supabase: {} as never });

    expect(loadPool).toHaveBeenCalledTimes(1);
    expect(result.candidates).toEqual([]);
    expect(result.widenedFromMiles).toBeUndefined();
    expect(result.nearestBeach).toBeUndefined();
  });

  it("measures the nearby filter from the anchor", async () => {
    const loadPool = jest.fn().mockResolvedValue([
      { beach: beach("close", { lat: 32.797, lon: -117.258 } as Partial<Beach>), relation: "favorite", distanceMiles: 4.6 },
      { beach: beach("far", { lat: 33.204, lon: -117.394 } as Partial<Beach>), relation: "nearby", distanceMiles: 32.5 },
    ] satisfies PoolBeach[]);

    const result = await buildDriveRangeCandidatePool("user-1", {
      anchor,
      homeBeachId: null,
      maxDriveMinutes: 90,
      filters: ["nearby"],
    }, { loadPool, supabase: {} as never });

    expect(result.candidates.map(({ beach: { id } }) => id)).toEqual(["close"]);
  });
});
