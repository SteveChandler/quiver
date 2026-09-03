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
      limitCount: 1000,
    });
    expect(deps.fetchBeaches).toHaveBeenCalledWith(["near", "far"]);
    expect(result).toEqual({
      candidates: [
        { beach: expect.objectContaining({ id: "near" }), distanceMiles: 1 },
        { beach: expect.objectContaining({ id: "far" }), distanceMiles: 5 },
      ],
      wasTruncated: false,
    });
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

  it("returns an empty pool without adding home or saved beaches", async () => {
    const deps = dependencies([], []);

    const result = await buildWeekendScoutCandidatePool(
      "user-1",
      { userLocation: { lat: 21.31, lon: -157.86 }, radiusMiles: 25 },
      deps
    );

    expect(result).toEqual({ candidates: [], wasTruncated: false });
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
