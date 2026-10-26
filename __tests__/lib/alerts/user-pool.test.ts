import type { SupabaseClient } from "@supabase/supabase-js";
import { capNearbyPool, findNearestBeach, loadUserPool, type PoolBeach } from "@/lib/alerts/user-pool";
import { resolveLocationAnchor } from "@/lib/alerts/location-freshness";
import { selectFirstSightingCandidates } from "@/lib/alerts/swell-outlook/first-sighting";
import { outlookSwell } from "@/__tests__/helpers/outlook-swell";
import type { Beach, Database } from "@/types/database";
import beginnerPoolReplay from "@/__tests__/fixtures/daily-call-beginner-pool-20261013.json";
import { beachSkillVetoReason } from "@/lib/recommendations/canonical-decision";

interface Store {
  favorites: Array<{ beach_id: string | null; custom_spot_id: string | null }>;
  beaches: Beach[];
  nearby: Array<{ id: string; distance_meters: number; total_count: number }>;
  customSpots?: Array<{ id: string; nearest_beach_id: string | null }>;
  forecasts?: Array<{ beach_id: string }>;
  exclusions?: Array<{ beach_id: string }>;
  /** Column lists passed to select(), by table. */
  selects?: Record<string, string[]>;
}

function makeBeach(id: string, slug = id, country: string | null = "USA"): Beach {
  return { id, name: id, slug, country } as Beach;
}

function makeSupabase(store: Store): SupabaseClient<Database> {
  const chain = (rows: unknown[], table: string): Record<string, unknown> => {
    let result = rows;
    const query: Record<string, unknown> = {};
    const passthrough = (): Record<string, unknown> => query;
    query.select = (columns?: string): Record<string, unknown> => {
      if (store.selects && typeof columns === "string") (store.selects[table] ??= []).push(columns);
      return query;
    };
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
      if (table === "favorite_beaches") return chain(store.favorites, table);
      if (table === "beaches") return chain(store.beaches, table);
      if (table === "custom_spots") return chain(store.customSpots ?? [], table);
      if (table === "enhanced_forecasts") return chain(store.forecasts ?? [], table);
      if (table === "user_beach_exclusions") return chain(store.exclusions ?? [], table);
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

  it("queries nearby beaches within 30 miles when drive range is never set", async () => {
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
      expect.objectContaining({ max_distance_meters: Math.round(30 * 1609.344) }),
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

    it("keeps a 13.6-mile beach and excludes a 64-mile beach for a never-set profile", async () => {
      const anchor = { lat: 28.1707, lon: -80.5913 };
      const close = located("synthetic-close", 28.36755, -80.5913);
      const far = located("synthetic-far", 29.09705, -80.5913);
      const supabase = makeSupabase({
        favorites: [{ beach_id: far.id, custom_spot_id: null }],
        beaches: [far, close],
        nearby: [{ id: close.id, distance_meters: 13.6 * 1609.344, total_count: 1 }],
      });
      const args = { supabase, userId: "", homeBeachId: null, location: anchor };

      const pool = await loadUserPool({ ...args, maxDriveMinutes: null });

      expect(pool).toHaveLength(1);
      expect(pool[0]).toMatchObject({ beach: close, relation: "nearby" });
      expect(pool[0].distanceMiles).toBeCloseTo(13.6, 1);
      expect(supabase.rpc).toHaveBeenCalledWith("get_weekend_scout_candidates", expect.objectContaining({
        max_distance_meters: Math.round(30 * 1609.344),
      }));

      const unlimited = await loadUserPool({ ...args, maxDriveMinutes: 200 });
      expect(unlimited.map(({ beach }) => beach.id)).toEqual([far.id, close.id]);
      expect(unlimited.find(({ beach }) => beach.id === far.id)?.distanceMiles).toBeCloseTo(64, 1);
    });

    it("does not let a SoCal favorite widen reach from a fresh Hawaii fix", async () => {
      const hawaii = located("hawaii", 21.281, -157.844);
      const socalFavorite = located("socal-favorite", 32.797, -117.258);
      const socalHome = located("socal-home", 32.767, -117.188);
      const now = new Date("2026-10-14T18:00:00.000Z");
      const { anchor, source } = resolveLocationAnchor(
        { lat: 21.28, lon: -157.83, captured_at: now.toISOString() }, now, sanDiego,
      );
      const pool = await loadUserPool({
        supabase: makeSupabase({ favorites: [{ beach_id: socalFavorite.id, custom_spot_id: null }],
          beaches: [hawaii, socalFavorite, socalHome], nearby: [{ id: hawaii.id, distance_meters: 1200, total_count: 1 }] }),
        userId: "user-1", homeBeachId: socalHome.id, location: anchor, maxDriveMinutes: 60,
      });
      expect(source).toBe("location");
      expect(pool.map(({ beach }) => beach.id)).toEqual([hawaii.id]);
      expect(selectFirstSightingCandidates({ swells: pool.map(({ beach }) =>
        outlookSwell({ beach: { id: beach.id, name: beach.name } })) }).map((swell) => swell.beach.id)).toEqual([hawaii.id]);
    });

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
    const replayPool: PoolBeach[] = beginnerPoolReplay.beaches.map((row) => ({
      beach: {
        ...makeBeach(row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
        name: row.name,
        skill_level: row.skillLevel,
      },
      relation: row.relation as PoolBeach["relation"],
      distanceMiles: row.distanceMiles,
    }));

    it("keeps the distant beginner beaches from the production replay without dropping saved spots", () => {
      const capped = capNearbyPool(replayPool, { cap: 50, experienceLevel: "beginner" });
      const keptNames = capped.pool.map(({ beach }) => beach.name);

      expect(capped.pool.filter(({ relation }) => relation === "nearby")).toHaveLength(50);
      expect(keptNames).toEqual(expect.arrayContaining([
        "72nd Place", "Torrance Beach (RAT Beach)", "Doheny State Beach", "Doheny Beach",
      ]));
      expect(capped.pool.filter(({ relation }) => relation !== "nearby").map(({ beach }) => beach.name))
        .toEqual(replayPool.filter(({ relation }) => relation !== "nearby").map(({ beach }) => beach.name));
      expect(capped.cappedCount).toBe(40);
      expect(capped.farthestNearbyMiles).toBe(95.4);

      const nearestOnlyNames = capNearbyPool(replayPool).pool.map(({ beach }) => beach.name);
      expect(nearestOnlyNames).not.toContain("72nd Place");
      expect(nearestOnlyNames).not.toContain("Torrance Beach (RAT Beach)");
    });

    it("keeps beginner-intermediate replay beaches eligible and preserves saved spots after the cap", () => {
      const experienceLevel = "beginner";
      const capped = capNearbyPool(replayPool, { cap: 50, experienceLevel });
      const keptNames = capped.pool.map(({ beach }) => beach.name);

      for (const name of ["Tourmaline Beach", "Pacific Beach", "San Elijo State Beach"]) {
        const entry = replayPool.find(({ beach }) => beach.name === name);
        expect(entry?.beach.name).toBe(name);
        expect(beachSkillVetoReason(entry?.beach.skill_level, experienceLevel)).toBeNull();
      }

      expect(keptNames).toEqual(expect.arrayContaining([
        "72nd Place", "Torrance Beach (RAT Beach)",
      ]));
      expect(capped.pool.filter(({ relation }) => relation !== "nearby").map(({ beach }) => beach.name))
        .toEqual(replayPool.filter(({ relation }) => relation !== "nearby").map(({ beach }) => beach.name));

      const isBeginnerEligible = ({ beach }: PoolBeach): boolean =>
        beach.skill_level === "beginner" || beach.skill_level === "beginner-intermediate";
      const savedEligibleCount = replayPool.filter((entry) => entry.relation !== "nearby" && isBeginnerEligible(entry)).length;
      const nearbyEligibleCount = replayPool.filter((entry) => entry.relation === "nearby" && isBeginnerEligible(entry)).length;
      const expectedEligibleCount = savedEligibleCount + Math.min(50, nearbyEligibleCount);
      expect(capped.pool.filter(({ beach }) => beachSkillVetoReason(beach.skill_level, experienceLevel) === null))
        .toHaveLength(expectedEligibleCount);
    });

    it("keeps distance order and ties within each skill group while capping nearby beaches at 50", () => {
      const nearby = Array.from({ length: 51 }, (_, index) => ({
        ...entry(`ineligible-${index}`, "nearby", index + 1),
        beach: { ...makeBeach(`ineligible-${index}`), skill_level: "intermediate" },
      }));
      const eligible = [
        { ...entry("eligible-far", "nearby", 90), beach: { ...makeBeach("eligible-far"), skill_level: "beginner" } },
        { ...entry("eligible-tie-first", "nearby", 70), beach: { ...makeBeach("eligible-tie-first"), skill_level: "beginner" } },
        { ...entry("eligible-tie-second", "nearby", 70), beach: { ...makeBeach("eligible-tie-second"), skill_level: "beginner" } },
      ];
      const capped = capNearbyPool([...nearby, ...eligible], { cap: 50, experienceLevel: "beginner" });

      expect(capped.pool.filter(({ relation }) => relation === "nearby")).toHaveLength(50);
      expect(capped.pool.map(({ beach }) => beach.id)).toEqual([
        ...nearby.slice(0, 47).map(({ beach }) => beach.id),
        ...eligible.map(({ beach }) => beach.id),
      ]);
      expect(capNearbyPool([...nearby, ...eligible], { cap: 2, experienceLevel: "beginner" }).pool.map(({ beach }) => beach.id))
        .toEqual(["eligible-tie-first", "eligible-tie-second"]);
      expect(capped.farthestNearbyMiles).toBe(90);
    });

    it("keeps the 50 nearest skill-eligible beaches for an advanced surfer", () => {
      const nearby = [
        { ...entry("expert", "nearby", 1), beach: { ...makeBeach("expert"), skill_level: "expert" } },
        ...Array.from({ length: 51 }, (_, index) => ({
          ...entry(`advanced-${index}`, "nearby", index + 2),
          beach: { ...makeBeach(`advanced-${index}`), skill_level: "advanced" },
        })),
      ];

      const capped = capNearbyPool(nearby, { cap: 50, experienceLevel: "advanced" });

      expect(capped.pool.map(({ beach }) => beach.id))
        .toEqual(Array.from({ length: 50 }, (_, index) => `advanced-${index}`));
      expect(capped.farthestNearbyMiles).toBe(51);
    });

    it.each([null, undefined, "unknown"])("ranks a missing beach skill last for unknown experience %p", (experienceLevel) => {
      const pool = [
        { ...entry("missing", "nearby", 1), beach: { ...makeBeach("missing"), skill_level: null } },
        { ...entry("advanced", "nearby", 2), beach: { ...makeBeach("advanced"), skill_level: "advanced" } },
      ];

      expect(capNearbyPool(pool, { cap: 1, experienceLevel }).pool.map(({ beach }) => beach.id)).toEqual(["advanced"]);
      expect(capNearbyPool(pool, { cap: 1 }).pool.map(({ beach }) => beach.id)).toEqual(["missing"]);
    });

    it("keeps the nearest nearby beaches and every home, saved and custom spot", () => {
      const pool = [
        entry("far", "nearby", 30), entry("home", "home", 40), entry("near", "nearby", 5),
        entry("saved", "favorite", 44), entry("mid", "nearby", 12), entry("custom", "custom", 41),
      ];

      const capped = capNearbyPool(pool, { cap: 2 });

      expect(capped.pool.map(({ beach }) => beach.id)).toEqual(["home", "near", "saved", "mid", "custom"]);
      expect(capped).toEqual(expect.objectContaining({ cappedCount: 1, farthestNearbyMiles: 12 }));
    });

    it("leaves a pool under the cap untouched", () => {
      const pool = [entry("a", "nearby", 1), entry("b", "favorite", 2)];

      expect(capNearbyPool(pool, { cap: 2 })).toEqual({ pool, cappedCount: 0, farthestNearbyMiles: null });
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

describe("findNearestBeach", () => {
  const denver = { lat: 39.74, lon: -104.99 };
  const at = (id: string, lat: number, lon: number, extra: Partial<Beach> = {}): Beach =>
    ({ ...makeBeach(id), lat, lon, deleted_at: null, is_private: false, ...extra } as Beach);

  it("returns the closest recommendable beach at any distance", async () => {
    const supabase = makeSupabase({ favorites: [], nearby: [], beaches: [
      at("bolsa", 33.71, -118.06),
      at("pb", 32.8, -117.25),
      at("private", 39.7, -105.0, { is_private: true }),
      at("hidden", 39.7, -105.0, { recommendation_eligible: false } as Partial<Beach>),
      at("excluded", 39.75, -105.0),
      at("noslug", 39.76, -105.0, { slug: null } as unknown as Partial<Beach>),
    ], exclusions: [{ beach_id: "excluded" }], selects: {} });

    const nearest = await findNearestBeach({ supabase, userId: "user-1", location: denver });

    expect(nearest).toEqual(expect.objectContaining({ id: "pb", slug: "pb", lat: 32.8, lon: -117.25 }));
    expect(nearest!.distanceMiles).toBeGreaterThan(800);
  });

  it("reads the eligibility flag it filters on", async () => {
    const selects: Record<string, string[]> = {};
    const supabase = makeSupabase({ favorites: [], nearby: [], beaches: [], selects });
    await findNearestBeach({ supabase, userId: "user-1", location: denver });
    expect(selects.beaches?.[0]).toEqual(expect.stringContaining("recommendation_eligible"));
    expect(selects.beaches?.[0]).toEqual(expect.stringContaining("is_private"));
  });

  it("returns null when no beach qualifies", async () => {
    const supabase = makeSupabase({ favorites: [], nearby: [], beaches: [] });
    await expect(findNearestBeach({ supabase, userId: "user-1", location: denver })).resolves.toBeNull();
  });
});
