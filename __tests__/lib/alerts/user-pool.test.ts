import type { SupabaseClient } from "@supabase/supabase-js";
import { loadUserPool, poolRadiusMiles } from "@/lib/alerts/user-pool";
import type { Beach, Database } from "@/types/database";

interface Store {
  favorites: Array<{ beach_id: string | null; custom_spot_id: string | null }>;
  beaches: Beach[];
  nearby: Array<{ id: string; distance_meters: number; total_count: number }>;
  customSpots?: Array<{ id: string; nearest_beach_id: string | null }>;
  forecasts?: Array<{ beach_id: string }>;
}

function makeBeach(id: string, slug = id): Beach {
  return { id, name: id, slug } as Beach;
}

function makeSupabase(store: Store): SupabaseClient<Database> {
  const chain = (rows: unknown[]): Record<string, unknown> => {
    let result = rows;
    const query: Record<string, unknown> = {};
    const passthrough = (): Record<string, unknown> => query;
    query.select = passthrough;
    query.eq = passthrough;
    query.is = passthrough;
    query.order = passthrough;
    query.gte = passthrough;
    query.in = (column: string, values: string[]): Record<string, unknown> => {
      result = result.filter(
        (row) =>
          typeof row === "object" &&
          row !== null &&
          column in row &&
          values.includes(String((row as Record<string, unknown>)[column])),
      );
      return query;
    };
    query.then = (resolve: (value: unknown) => void): void => {
      resolve({ data: result, error: null });
    };
    return query;
  };

  return {
    from: jest.fn((table: string) => {
      if (table === "favorite_beaches") return chain(store.favorites);
      if (table === "beaches") return chain(store.beaches);
      if (table === "custom_spots") return chain(store.customSpots ?? []);
      if (table === "enhanced_forecasts") return chain(store.forecasts ?? []);
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: jest.fn(() => Promise.resolve({ data: store.nearby, error: null })),
  } as unknown as SupabaseClient<Database>;
}

describe("user pool", () => {
  it("includes home, favorites, and nearby beaches with home precedence", async () => {
    const home = makeBeach("home");
    const favoriteOne = makeBeach("favorite-1");
    const favoriteTwo = makeBeach("favorite-2");
    const nearby = [
      makeBeach("nearby-1"),
      makeBeach("nearby-2"),
      makeBeach("nearby-3"),
    ];
    const supabase = makeSupabase({
      favorites: [
        { beach_id: home.id, custom_spot_id: null },
        { beach_id: favoriteOne.id, custom_spot_id: null },
        { beach_id: favoriteTwo.id, custom_spot_id: null },
      ],
      beaches: [home, favoriteOne, favoriteTwo, ...nearby],
      nearby: nearby.map((beach, index) => ({
        id: beach.id,
        distance_meters: (index + 1) * 1609.344,
        total_count: nearby.length,
      })),
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: home.id,
      location: { lat: 32.8, lon: -117.2 },
      maxDriveMinutes: null,
    });

    expect(result).toHaveLength(6);
    expect(
      Object.fromEntries(
        result.map(({ beach, relation }) => [beach.id, relation]),
      ),
    ).toEqual({
      home: "home",
      "favorite-1": "favorite",
      "favorite-2": "favorite",
      "nearby-1": "nearby",
      "nearby-2": "nearby",
      "nearby-3": "nearby",
    });
  });

  it("keeps favorites without loading nearby beaches when location is null", async () => {
    const favorite = makeBeach("favorite");
    const supabase = makeSupabase({
      favorites: [{ beach_id: favorite.id, custom_spot_id: null }],
      beaches: [favorite],
      nearby: [{ id: "nearby", distance_meters: 1000, total_count: 1 }],
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: null,
      location: null,
      maxDriveMinutes: null,
    });

    expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
      [favorite.id, "favorite"],
    ]);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("resolves the configured drive radius", () => {
    expect(poolRadiusMiles(null)).toBe(30);
    expect(poolRadiusMiles(60)).toBe(30);
    expect(poolRadiusMiles(400)).toBe(100);
  });

  it("drops beaches with an empty slug", async () => {
    const valid = makeBeach("valid");
    const supabase = makeSupabase({
      favorites: [
        { beach_id: "empty-slug", custom_spot_id: null },
        { beach_id: valid.id, custom_spot_id: null },
      ],
      beaches: [makeBeach("empty-slug", ""), valid],
      nearby: [],
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: null,
      location: null,
      maxDriveMinutes: null,
    });

    expect(result.map(({ beach }) => beach.id)).toEqual([valid.id]);
  });

  it("includes only custom spots whose forecast anchor has fresh forecasts", async () => {
    const freshAnchor = makeBeach("fresh-anchor");
    const staleAnchor = makeBeach("stale-anchor");
    const supabase = makeSupabase({
      favorites: [
        { beach_id: null, custom_spot_id: "custom-fresh" },
        { beach_id: null, custom_spot_id: "custom-stale" },
      ],
      beaches: [freshAnchor, staleAnchor],
      nearby: [],
      customSpots: [
        { id: "custom-fresh", nearest_beach_id: freshAnchor.id },
        { id: "custom-stale", nearest_beach_id: staleAnchor.id },
      ],
      forecasts: [{ beach_id: freshAnchor.id }],
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: null,
      location: null,
      maxDriveMinutes: null,
    });

    expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
      [freshAnchor.id, "custom"],
    ]);
  });
});
