import {
  CITY_MAP_SPOT_FIELDS,
  MAP_BEACH_FIELDS,
  toCityMapSpot,
  toMapBeach,
} from "@/lib/utils/map-client-props";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { createClusterPopupContent } from "@/components/map/map-cluster-popup";
import type { SurfSpot } from "@/lib/data/surf-spots";
import type { Beach } from "@/types/database";

function fullBeach(overrides: Partial<Beach>): Beach {
  return createBeachWithDefaults({
    id: "00000000-0000-4000-8000-000000000001",
    name: "Pohaku Park",
    slug: "pohaku-park",
    city: "Lahaina",
    state: "HI",
    country: null,
    region: "Maui",
    lat: 20.9,
    lon: -156.69,
    timezone: "Pacific/Honolulu",
    created_at: "2026-01-01T00:00:00.000Z",
    skill_level: "beginner",
    break_type: "point",
    crowd_level: "moderate",
    wave_tips: "Rolling rights on a small swell.",
    best_conditions_prose: "North swell with trade winds.",
    crowd_tips: "Busy at sunset.",
    description: "Longboard point in West Maui.",
    preference_model: { beginner_window: { buckets: [1, 2, 3] } } as unknown as Beach["preference_model"],
    swell_access_factors: [0.1, 0.2, 0.3],
    wind_exposure_factors: [0.4, 0.5],
    terrain_params: { k: 3 } as unknown as Beach["terrain_params"],
    parking_tips: "Roadside parking.",
    access_tips: "Short walk.",
    hazards: ["reef"],
    features: ["showers"],
    ...overrides,
  });
}

// What the map now receives: the projected row, padded with defaults client-side.
function asMapReceivesIt(beach: Beach): Beach {
  return createBeachWithDefaults(toMapBeach(beach));
}

describe("toMapBeach", () => {
  it("keeps only the columns the map reads, with country present even when null", () => {
    const projected = toMapBeach(fullBeach({}));

    expect(Object.keys(projected).sort()).toEqual([...MAP_BEACH_FIELDS].sort());
    expect(projected).toHaveProperty("country", null);
    expect(projected).not.toHaveProperty("preference_model");
    expect(projected).not.toHaveProperty("swell_access_factors");
    expect(projected).not.toHaveProperty("parking_tips");
  });

  it.each([
    ["Hawaii island route", fullBeach({})],
    ["Mexico route", fullBeach({ state: "Baja California", country: "Mexico", region: "Ensenada", city: "Ensenada" })],
    ["US city route", fullBeach({ state: "CA", region: null, city: "San Diego" })],
  ])("builds the same beach URL for a %s", (_label, beach) => {
    expect(buildBeachUrl(asMapReceivesIt(beach))).toBe(buildBeachUrl(beach));
  });

  it("copies only keys the row has, so partial RPC rows keep their URLs and invent no timezone", () => {
    const rpcRow = { id: "b1", name: "Point", slug: "point", city: "Pacifica", state: "CA", lat: 37.6, lon: -122.5 };
    const projected = toMapBeach(rpcRow as unknown as Beach);

    expect(projected).toEqual(rpcRow);
    expect(projected).not.toHaveProperty("country");
    expect(projected).not.toHaveProperty("timezone");
    expect(buildBeachUrl(projected)).toBe(buildBeachUrl(rpcRow as unknown as Beach));
  });

  it("renders the same cluster popup as the full row", () => {
    const full = [
      fullBeach({}),
      fullBeach({ id: "00000000-0000-4000-8000-000000000002", slug: "launiupoko", name: "Launiupoko", wave_tips: null, best_conditions_prose: null, crowd_tips: null }),
      fullBeach({ id: "00000000-0000-4000-8000-000000000003", slug: "puamana", name: "Puamana", wave_tips: null, best_conditions_prose: null, crowd_tips: null, crowd_level: null, break_type: null }),
    ];
    const cluster = {
      isCluster: true,
      pointCount: full.length,
      latitude: 20.9,
      longitude: -156.69,
      beachIds: full.map((beach) => beach.id),
    };
    const render = (beaches: Beach[]) =>
      createClusterPopupContent({
        cluster,
        beaches,
        waveHeightMap: new Map([[full[0].id, 1.2]]),
      }).outerHTML;

    expect(render(full.map(asMapReceivesIt))).toBe(render(full));
  });
});

describe("toCityMapSpot", () => {
  const spot = {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "pohaku-park",
    name: "Pohaku Park",
    citySlug: "lahaina",
    city: "Lahaina",
    region: "Lahaina, HI",
    coordinates: { lat: 20.9, lon: -156.69 },
    overview: "Longboard point in West Maui.",
    history: "",
    conditions: "North swell with trade winds.",
    tideAdvice: "",
    swellAdvice: "Rolling rights on a small swell.",
    windAdvice: "",
    waterTemp: "",
    hazards: ["reef"],
    skillLevel: "Beginner friendly",
    bestSeason: "11, 12, 1",
    crowdFactor: "Moderate",
    parking: "Roadside parking.",
    amenities: ["showers"],
    nearby: [],
    faq: [],
    speakableSummary: "Longboard point in West Maui.",
    beginnerNotes: "This spot is suitable for beginners.",
    intentTags: ["beginner", "tide", "water-temp"],
  } as unknown as SurfSpot;

  it("keeps only the fields CityMapView reads", () => {
    const projected = toCityMapSpot(spot);

    expect(Object.keys(projected).sort()).toEqual([...CITY_MAP_SPOT_FIELDS].sort());
    expect(projected).toEqual(
      Object.fromEntries(CITY_MAP_SPOT_FIELDS.map((field) => [field, spot[field]])),
    );
  });

  it("omits optional fields a spot does not have", () => {
    const projected = toCityMapSpot({ ...spot, id: undefined, city: undefined });

    expect(projected).not.toHaveProperty("id");
    expect(projected).not.toHaveProperty("city");
  });
});
