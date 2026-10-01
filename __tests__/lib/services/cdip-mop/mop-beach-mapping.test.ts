import {
  buildMopMappingSql,
  matchMopTransect,
  MAX_LANDWARD_M,
  MAX_TRANSECT_CROSS_M,
  type MappableBeach,
} from "@/lib/services/cdip-mop/mop-beach-mapping";
import type { MopPointMeta } from "@/lib/services/cdip-mop/mop-client";

// Real point metadata, read 2026-10-01. MOP points sit on the 10 m depth contour, often 0.5–2 km
// seaward of a beach pin; Blacks' nearest is 739 m out.
const D0536: MopPointMeta = { pointId: "D0536", lat: 32.88625, lon: -117.25986, shoreNormalDeg: 267.52 };
const D0537: MopPointMeta = { pointId: "D0537", lat: 32.8874, lon: -117.2599, shoreNormalDeg: 270 };
const D0538: MopPointMeta = { pointId: "D0538", lat: 32.88805, lon: -117.25993, shoreNormalDeg: 267.54 };

const beach = (overrides: Partial<MappableBeach> = {}): MappableBeach => ({
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  name: "Blacks Beach",
  lat: 32.887,
  lon: -117.252,
  aspect_deg: 270,
  ...overrides,
});

// A point 500 m due north of the beach (0.0045° of latitude).
const north = (shoreNormalDeg: number): MopPointMeta => ({ pointId: "X0001", lat: 32.8915, lon: -117.252, shoreNormalDeg });

describe("matchMopTransect", () => {
  it("takes the point whose shore-normal transect runs through the beach", () => {
    const match = matchMopTransect(beach(), [D0536, D0537, D0538]);
    expect(match?.point.pointId).toBe("D0537");
    expect(match?.crossTrackM).toBeLessThan(60);
    expect(match?.landwardM).toBeGreaterThan(700);
    expect(match?.distanceM).toBeGreaterThan(700);
  });

  it("accepts a beach landward of the point along its normal", () => {
    expect(matchMopTransect(beach(), [north(0)])?.landwardM).toBeCloseTo(500, -1);
  });

  it("rejects a point that faces away from the beach (the far side of a headland)", () => {
    expect(matchMopTransect(beach(), [north(180)])).toBeNull();
  });

  it(`rejects a transect passing more than ${MAX_TRANSECT_CROSS_M} m from the beach`, () => {
    expect(matchMopTransect(beach(), [north(90)])).toBeNull();
  });

  it(`rejects a beach more than ${MAX_LANDWARD_M} m inland of the contour`, () => {
    const far: MopPointMeta = { pointId: "X0002", lat: 32.887 + 0.0225, lon: -117.252, shoreNormalDeg: 0 };
    expect(matchMopTransect(beach(), [far])).toBeNull();
  });
});

describe("buildMopMappingSql", () => {
  const blacks = beach();
  const bay = beach({ id: "aaaaaaaa-0000-4000-8000-000000000002", name: "Bay\nBeach", lat: 37.8, lon: -122.3, aspect_deg: null });
  const northBeach = beach({ id: "aaaaaaaa-0000-4000-8000-000000000003", name: "North", aspect_deg: 5 });
  const sql = buildMopMappingSql(
    [
      { beach: blacks, match: matchMopTransect(blacks, [D0536, D0537, D0538]) },
      { beach: bay, match: null },
      { beach: { ...northBeach, aspect_deg: 220 }, match: { point: { ...north(359.6), pointId: "X0003" }, distanceM: 500, crossTrackM: 0, landwardM: 500 } },
    ],
    "2026-10-02T09:00:00Z",
  );

  it("summarises mapped, unmapped and the furthest beach kept", () => {
    expect(sql).toContain("-- mapped: 2, unmapped: 1, furthest beach kept: 738 m inland of its point");
    expect(sql).toContain("-- unmapped: aaaaaaaa-0000-4000-8000-000000000002 Bay Beach");
  });

  it("writes one UPDATE per mapped beach inside a transaction", () => {
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
    expect(sql).toMatch(
      /^UPDATE public\.beaches SET mop_point_id = 'D0537', mop_shore_normal_deg = 270, mop_point_distance_m = 7\d\d WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';$/m,
    );
    expect(sql).toContain("mop_shore_normal_deg = 0, mop_point_distance_m = 500 WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003';");
    expect(sql.match(/^UPDATE /gm)).toHaveLength(2);
  });

  it("lists shore normals more than 20° from aspect_deg for review, wrapping at north", () => {
    expect(sql).toContain("-- review: North aspect_deg 220 vs MOP X0003 normal 0 (140°)");
    expect(sql).not.toContain("-- review: Blacks Beach");
  });

  it("lists beaches more than 1200 m inland of their point for a closer look", () => {
    const far = beach({ id: "aaaaaaaa-0000-4000-8000-000000000004", name: "Far" });
    const farSql = buildMopMappingSql(
      [{ beach: far, match: { point: D0537, distanceM: 1500, crossTrackM: 12, landwardM: 1499.6 } }],
      "2026-10-02T09:00:00Z",
    );
    expect(farSql).toContain("-- check: Far is 1500 m inland of MOP D0537 (normal 270, 12 m off-transect)");
    expect(sql).not.toContain("-- check:");
  });

  it("refuses an id that is not a uuid", () => {
    expect(() =>
      buildMopMappingSql(
        [{ beach: beach({ id: "x'; DROP TABLE beaches; --" }), match: { point: D0537, distanceM: 1, crossTrackM: 0, landwardM: 1 } }],
        "2026-10-02T09:00:00Z",
      ),
    ).toThrow("not a uuid");
  });
});
