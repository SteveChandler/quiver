import {
  buildWeekendScoutCandidatePool,
  type WeekendScoutCandidatePoolDependencies,
} from "@/lib/services/discovery/weekend-scout-candidate-pool";
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
