import { calculateDistance } from "@/lib/utils/distance-utils";
import { EARTH_RADIUS_KM, EARTH_RADIUS_MI, haversineDistance } from "@/lib/utils/geo-utils";

// Frozen copies of the two Haversine bodies before they shared haversineCentralAngle.
// The shared helper must return the same float, bit for bit, as these.
function legacyHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function legacyCalculateDistanceRaw(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: "miles" | "km" | "meters"
): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return NaN;
  }
  const R = unit === "miles" ? EARTH_RADIUS_MI : EARTH_RADIUS_KM;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return unit === "meters" ? distance * 1000 : distance;
}

type Pair = [name: string, lat1: number, lon1: number, lat2: number, lon2: number];

// Real beach and buoy coordinates from the catalogue evidence and lib/data/big-swells.json.
const PAIRS: Pair[] = [
  ["Sharp Park Beach -> Santa Cruz Main Beach", 37.6324357, -122.494697, 36.962058, -122.02219],
  ["Sharp Park Beach -> Roads End Beach", 37.6324357, -122.494697, 45.00827, -124.0105],
  ["Kamakahonu Beach -> Turtle Bay West", 19.63934, -155.99748, 21.705403, -158.00333],
  ["Virginia Beach Oceanfront -> Diamond Shoals buoy", 36.853333, -75.973056, 35.026, -75.38],
  ["Jenkinson's Beach -> Atlantic City Beach", 40.09355, -74.03434, 39.35813, -74.4178],
  ["TOBAY Beach -> Jenkinson's Beach", 40.6078, -73.4333, 40.09355, -74.03434],
  ["San Juan buoy -> Vieques Island buoy", 18.474, -66.099, 18.261, -65.464],
  ["Masonboro Inlet buoy -> Diamond Shoals buoy", 34.144, -77.715, 35.026, -75.38],
  ["Scripps Pier -> Torrey Pines outer buoy", 32.8667, -117.2571, 32.933, -117.391],
  ["Kamakahonu Beach -> Kamakahonu shoreline point", 19.63934, -155.99748, 19.63966, -155.99788],
  ["identical points", 33.6595, -118.0039, 33.6595, -118.0039],
  ["antimeridian", 51.5, 179.9, 51.6, -179.9],
  ["Santa Cruz Main Beach -> Virginia Beach Oceanfront", 36.962058, -122.02219, 36.853333, -75.973056],
];

const UNITS = ["km", "miles", "meters"] as const;

describe("shared Haversine central angle keeps every distance bit-identical", () => {
  it.each(PAIRS)("haversineDistance: %s", (_name, lat1, lon1, lat2, lon2) => {
    expect(haversineDistance(lat1, lon1, lat2, lon2)).toBe(legacyHaversineDistance(lat1, lon1, lat2, lon2));
  });

  it.each(PAIRS.flatMap((pair) => UNITS.map((unit) => [...pair, unit] as const)))(
    "calculateDistance: %s (%s)",
    (_name, lat1, lon1, lat2, lon2, unit) => {
      expect(calculateDistance({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }, unit)).toBe(
        legacyCalculateDistanceRaw(lat1, lon1, lat2, lon2, unit)
      );
    }
  );

  it("matches on 20,000 seeded nearby pairs in every unit", () => {
    let seed = 1;
    const next = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const mismatches: string[] = [];
    for (let index = 0; index < 20000; index += 1) {
      const lat1 = next() * 140 - 70;
      const lon1 = next() * 360 - 180;
      const lat2 = lat1 + (next() - 0.5) * 2;
      const lon2 = lon1 + (next() - 0.5) * 2;
      if (!Object.is(haversineDistance(lat1, lon1, lat2, lon2), legacyHaversineDistance(lat1, lon1, lat2, lon2))) {
        mismatches.push(`haversineDistance ${lat1},${lon1} -> ${lat2},${lon2}`);
      }
      for (const unit of UNITS) {
        const shared = calculateDistance({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }, unit);
        if (!Object.is(shared, legacyCalculateDistanceRaw(lat1, lon1, lat2, lon2, unit))) {
          mismatches.push(`calculateDistance ${unit} ${lat1},${lon1} -> ${lat2},${lon2}`);
        }
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it("keeps the NaN result for non-finite and missing inputs", () => {
    expect(calculateDistance({ lat: NaN, lon: -117.2 }, { lat: 32.7, lon: -117.1 }, "km")).toBeNaN();
    expect(calculateDistance({ lat: Infinity, lon: -117.2 }, { lat: 32.7, lon: -117.1 }, "miles")).toBeNaN();
    expect(calculateDistance(null as never, { lat: 32.7, lon: -117.1 })).toBeNaN();
    expect(haversineDistance(NaN, 0, 0, 0)).toBeNaN();
  });
});
