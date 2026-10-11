import type { SupabaseClient } from "@supabase/supabase-js";
import { capNearbyPool, loadUserPool, type PoolBeach } from "@/lib/alerts/user-pool";
import type { Beach, Database } from "@/types/database";

interface Store {
  favorites: Array<{ beach_id: string | null; custom_spot_id: string | null }>;
  beaches: Beach[];
  nearby: Array<{ id: string; distance_meters: number; total_count: number }>;
  customSpots?: Array<{ id: string; nearest_beach_id: string | null }>;
  forecasts?: Array<{ beach_id: string }>;
  exclusions?: Array<{ beach_id: string }>;
}

function makeBeach(id: string, slug = id, country: string | null = "USA"): Beach {
  return { id, name: id, slug, country } as Beach;
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
      if (table === "user_beach_exclusions") return chain(store.exclusions ?? []);
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: jest.fn(() => Promise.resolve({ data: store.nearby, error: null })),
  } as unknown as SupabaseClient<Database>;
}

describe("user pool", () => {
  it.each([
    { homeCountry: "USA", homeSlug: "home", closestCountry: "Mexico", expectedCountry: "Mexico" },
    { homeCountry: "USA", homeSlug: "home", closestCountry: "USA", expectedCountry: "USA" },
    { homeCountry: "Mexico", homeSlug: "home", closestCountry: "USA", expectedCountry: "USA" },
    { homeCountry: "Mexico", homeSlug: "home", closestCountry: "Mexico", expectedCountry: "Mexico" },
    { homeCountry: null, homeSlug: "home", closestCountry: "USA", expectedCountry: "USA" },
    { homeCountry: null, homeSlug: "home", closestCountry: "Mexico", expectedCountry: "Mexico" },
    { homeCountry: "USA", homeSlug: "", closestCountry: "Mexico", expectedCountry: "Mexico" },
  ])(
    "keeps $expectedCountry nearby beaches with home=$homeCountry, slug='$homeSlug', and closest=$closestCountry",
    async ({ homeCountry, homeSlug, closestCountry, expectedCountry }) => {
      const home = makeBeach("home", homeSlug, homeCountry);
      const favorite = makeBeach("favorite");
      const usa = makeBeach("usa");
      const mexico = makeBeach("mexico", "mexico", "Mexico");
      const closestId = closestCountry === "USA" ? usa.id : mexico.id;
      const supabase = makeSupabase({
        favorites: [{ beach_id: favorite.id, custom_spot_id: null }],
        // Hydration and RPC order must not determine the closest beach.
        beaches: [mexico, usa, home, favorite],
        nearby: [
          { id: "unhydrated", distance_meters: 1, total_count: 3 },
          { id: closestId === usa.id ? mexico.id : usa.id, distance_meters: 3000, total_count: 3 },
          { id: closestId, distance_meters: 1000, total_count: 3 },
        ],
      });

      const result = await loadUserPool({
        supabase,
        userId: "user-1",
        homeBeachId: homeCountry ? home.id : null,
        location: closestCountry === "Mexico"
          ? { lat: 31.86, lon: -116.6 }
          : { lat: 32.8, lon: -117.2 },
        maxDriveMinutes: 90,
      });

      const keptId = expectedCountry === "USA" ? usa.id : mexico.id;
      expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
        ...(homeCountry && home.slug ? [[home.id, "home"]] : []),
        [favorite.id, "favorite"],
        [keptId, "nearby"],
      ]);
      expect(result.find(({ beach }) => beach.id === keptId)?.distanceMiles).toBe(
        (keptId === closestId ? 1000 : 3000) / 1609.344,
      );
    },
  );

  it.each([null, "home"])("keeps nearby beaches when the closest beach has no country with home=%s", async (homeBeachId) => {
    const home = makeBeach("home");
    const usa = makeBeach("usa");
    const mexico = makeBeach("mexico", "mexico", "Mexico");
    const unknown = makeBeach("unknown", "unknown", null);
    const supabase = makeSupabase({
      favorites: [],
      beaches: [home, unknown, usa, mexico],
      nearby: [unknown, usa, mexico].map((beach, index) => ({
        id: beach.id, distance_meters: (index + 1) * 1000, total_count: 3,
      })),
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId,
      location: { lat: 32.8, lon: -117.2 },
      maxDriveMinutes: 90,
    });

    expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
      ...(homeBeachId ? [[home.id, "home"]] : []),
      [unknown.id, "nearby"], [usa.id, "nearby"], [mexico.id, "nearby"],
    ]);
  });

  it.each(["USA", "Mexico"])("falls back to the %s home when no nearby beach hydrates", async (country) => {
    const home = makeBeach("home", "home", country);
    const favorite = makeBeach("favorite", "favorite", country === "USA" ? "Mexico" : "USA");
    const supabase = makeSupabase({
      favorites: [{ beach_id: favorite.id, custom_spot_id: null }],
      beaches: [home, favorite],
      nearby: [{ id: "unhydrated", distance_meters: 1000, total_count: 1 }],
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: home.id,
      location: { lat: 32.8, lon: -117.2 },
      maxDriveMinutes: 90,
    });

    expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
      [home.id, "home"], [favorite.id, "favorite"],
    ]);
  });

  it("preserves Mexican favorites and custom anchors even when also nearby", async () => {
    const home = makeBeach("home");
    const favorite = makeBeach("favorite", "favorite", "Mexico");
    const custom = makeBeach("custom-anchor", "custom-anchor", "Mexico");
    const nearby = makeBeach("nearby", "nearby", "Mexico");
    const local = makeBeach("local");
    const supabase = makeSupabase({
      favorites: [
        { beach_id: favorite.id, custom_spot_id: null },
        { beach_id: null, custom_spot_id: "custom-spot" },
      ],
      customSpots: [{ id: "custom-spot", nearest_beach_id: custom.id }],
      forecasts: [{ beach_id: custom.id }],
      beaches: [home, favorite, custom, nearby, local],
      nearby: [
        ...[favorite, custom, nearby].map((beach) => ({
          id: beach.id, distance_meters: 1000, total_count: 4,
        })),
        { id: local.id, distance_meters: 500, total_count: 4 },
      ],
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: home.id,
      location: { lat: 32.8, lon: -117.2 },
      maxDriveMinutes: 90,
    });

    expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
      [home.id, "home"],
      [favorite.id, "favorite"],
      [custom.id, "custom"],
      [local.id, "nearby"],
    ]);
  });

  it.each(["missing-home", "unknown-country"])(
    "uses the closest nearby country when the home anchor is unavailable: %s",
    async (homeBeachId) => {
      const usa = makeBeach("usa");
      const mexico = makeBeach("mexico", "mexico", "Mexico");
      const unknown = makeBeach("unknown-country", "unknown-country", null);
      const supabase = makeSupabase({
        favorites: [],
        beaches: [usa, mexico, unknown],
        nearby: [usa, mexico].map((beach, index) => ({
          id: beach.id, distance_meters: (index + 1) * 1000, total_count: 2,
        })),
      });

      const result = await loadUserPool({
        supabase,
        userId: "user-1",
        homeBeachId,
        location: { lat: 32.8, lon: -117.2 },
        maxDriveMinutes: 90,
      });

      expect(result.filter(({ relation }) => relation === "nearby").map(({ beach }) => beach.id))
        .toEqual([usa.id]);
    },
  );

  it("returns an empty pool without a home, location, or favorites", async () => {
    const supabase = makeSupabase({ favorites: [], beaches: [], nearby: [] });

    expect(await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: null,
      location: null,
      maxDriveMinutes: null,
    })).toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalledWith("beaches");
  });

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

  it("queries nearby beaches within 100 miles when drive range is unset", async () => {
    const supabase = makeSupabase({ favorites: [], beaches: [], nearby: [] });

    await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: null,
      location: { lat: 33, lon: -118 },
      maxDriveMinutes: null,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_weekend_scout_candidates",
      expect.objectContaining({ max_distance_meters: Math.round(100 * 1609.344) }),
    );
  });

  it("queries nearby beaches within the configured drive range", async () => {
    const supabase = makeSupabase({ favorites: [], beaches: [], nearby: [] });

    await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: null,
      location: { lat: 33, lon: -118 },
      maxDriveMinutes: 60,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_weekend_scout_candidates",
      expect.objectContaining({ max_distance_meters: Math.round(30 * 1609.344) }),
    );
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

  describe("drive range", () => {
    const sanDiego = { lat: 32.767, lon: -117.188 };
    const located = (id: string, lat: number, lon: number): Beach =>
      ({ ...makeBeach(id), lat, lon }) as Beach;
    const pacificBeach = located("pacific-beach", 32.797, -117.258);
    const alaMoana = located("ala-moana-bowls", 21.281, -157.844);
    const farHome = located("far-home", 21.27, -157.82);
    const farCustomAnchor = located("far-custom-anchor", 33.47, -117.72);

    function store(): Store {
      return {
        favorites: [
          { beach_id: pacificBeach.id, custom_spot_id: null },
          { beach_id: alaMoana.id, custom_spot_id: null },
          { beach_id: null, custom_spot_id: "far-custom" },
        ],
        customSpots: [{ id: "far-custom", nearest_beach_id: farCustomAnchor.id }],
        forecasts: [{ beach_id: farCustomAnchor.id }],
        beaches: [pacificBeach, alaMoana, farHome, farCustomAnchor],
        nearby: [],
      };
    }

    it("drops home, saved and custom beaches outside the range of the anchor", async () => {
      const result = await loadUserPool({
        supabase: makeSupabase(store()),
        userId: "user-1",
        homeBeachId: farHome.id,
        location: sanDiego,
        maxDriveMinutes: 90,
      });

      expect(result.map(({ beach, relation }) => [beach.id, relation])).toEqual([
        [pacificBeach.id, "favorite"],
      ]);
      expect(result[0].distanceMiles).toBeCloseTo(4.6, 1);
    });

    it("keeps every saved spot when there is no anchor to measure from", async () => {
      const result = await loadUserPool({
        supabase: makeSupabase(store()),
        userId: "user-1",
        homeBeachId: farHome.id,
        location: null,
        maxDriveMinutes: 90,
      });

      expect(result.map(({ beach }) => beach.id)).toEqual([
        farHome.id, pacificBeach.id, alaMoana.id, farCustomAnchor.id,
      ]);
      expect(result.every(({ distanceMiles }) => distanceMiles === null)).toBe(true);
    });
  });

  it("leaves out home and saved beaches the surfer excluded or that cannot be recommended", async () => {
    const keep = makeBeach("keep");
    const excluded = makeBeach("excluded-home");
    const privateBeach = { ...makeBeach("private"), is_private: true } as Beach;
    const ineligible = { ...makeBeach("ineligible"), recommendation_eligible: false } as Beach;
    const deleted = { ...makeBeach("deleted"), deleted_at: "2026-10-01T00:00:00Z" } as Beach;
    const supabase = makeSupabase({
      favorites: [keep, privateBeach, ineligible, deleted].map((beach) => ({ beach_id: beach.id, custom_spot_id: null })),
      beaches: [keep, excluded, privateBeach, ineligible, deleted],
      nearby: [],
      exclusions: [{ beach_id: excluded.id }],
    });

    const result = await loadUserPool({
      supabase,
      userId: "user-1",
      homeBeachId: excluded.id,
      location: null,
      maxDriveMinutes: null,
    });

    expect(result.map(({ beach }) => beach.id)).toEqual([keep.id]);
  });

  describe("capNearbyPool", () => {
    const entry = (id: string, relation: PoolBeach["relation"], distanceMiles: number | null): PoolBeach =>
      ({ beach: makeBeach(id), relation, distanceMiles });

    it("keeps the nearest nearby beaches and every home, saved and custom spot", () => {
      const pool = [
        entry("far", "nearby", 30), entry("home", "home", 40), entry("near", "nearby", 5),
        entry("saved", "favorite", 44), entry("mid", "nearby", 12), entry("custom", "custom", 41),
      ];

      const capped = capNearbyPool(pool, 2);

      expect(capped.pool.map(({ beach }) => beach.id)).toEqual(["home", "near", "saved", "mid", "custom"]);
      expect(capped).toEqual(expect.objectContaining({ cappedCount: 1, farthestNearbyMiles: 12 }));
    });

    it("leaves a pool under the cap untouched", () => {
      const pool = [entry("a", "nearby", 1), entry("b", "favorite", 2)];

      expect(capNearbyPool(pool, 2)).toEqual({ pool, cappedCount: 0, farthestNearbyMiles: null });
    });
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
