/**
 * Coastal region configuration for location-aware surf messaging
 */

export interface CoastalRegion {
  id: string;
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  coastFaces: string[]; // Primary swell directions that work well
  waterTempAvgByMonth: number[]; // Jan=0, Dec=11, in Fahrenheit
}

export const COASTAL_REGIONS: Record<string, CoastalRegion> = {
  socal: {
    id: "socal",
    name: "Southern California",
    latMin: 32.5,
    latMax: 34.5,
    lonMin: -120,
    lonMax: -117,
    coastFaces: ["SW", "S", "W"],
    waterTempAvgByMonth: [58, 58, 59, 60, 62, 65, 68, 70, 69, 66, 62, 59],
  },
  "central-ca": {
    id: "central-ca",
    name: "Central California",
    latMin: 34.5,
    latMax: 37.5,
    lonMin: -123,
    lonMax: -120,
    coastFaces: ["W", "NW", "SW"],
    waterTempAvgByMonth: [54, 54, 54, 54, 55, 56, 57, 58, 59, 58, 56, 54],
  },
  norcal: {
    id: "norcal",
    name: "Northern California",
    latMin: 37.5,
    latMax: 42.0,
    lonMin: -125,
    lonMax: -122,
    coastFaces: ["NW", "W"],
    waterTempAvgByMonth: [52, 52, 52, 52, 53, 54, 55, 56, 56, 55, 54, 52],
  },
  "pacific-nw": {
    id: "pacific-nw",
    name: "Pacific Northwest",
    latMin: 42.0,
    latMax: 49.0,
    lonMin: -125,
    lonMax: -122,
    coastFaces: ["W", "NW", "SW"],
    waterTempAvgByMonth: [48, 48, 48, 49, 51, 54, 56, 58, 57, 54, 51, 49],
  },
  hawaii: {
    id: "hawaii",
    name: "Hawaii",
    latMin: 18.5,
    latMax: 22.5,
    lonMin: -161,
    lonMax: -154,
    coastFaces: ["N", "NW", "S", "SW", "E"],
    waterTempAvgByMonth: [75, 75, 76, 77, 78, 79, 80, 81, 81, 80, 78, 76],
  },
  "east-fl": {
    id: "east-fl",
    name: "Florida East Coast",
    latMin: 24.5,
    latMax: 30.5,
    lonMin: -81,
    lonMax: -80,
    coastFaces: ["E", "SE", "NE"],
    waterTempAvgByMonth: [72, 73, 75, 78, 81, 84, 85, 85, 84, 81, 77, 74],
  },
  "east-se": {
    id: "east-se",
    name: "Southeast Coast",
    latMin: 30.5,
    latMax: 36.5,
    lonMin: -82,
    lonMax: -75,
    coastFaces: ["E", "SE"],
    waterTempAvgByMonth: [55, 55, 60, 66, 73, 79, 82, 82, 79, 72, 64, 58],
  },
  "east-mid": {
    id: "east-mid",
    name: "Mid-Atlantic Coast",
    latMin: 36.5,
    latMax: 41.5,
    lonMin: -76,
    lonMax: -73,
    coastFaces: ["E", "ESE", "SE"],
    waterTempAvgByMonth: [42, 41, 44, 50, 58, 67, 74, 76, 72, 64, 55, 47],
  },
  "east-ne": {
    id: "east-ne",
    name: "New England Coast",
    latMin: 41.5,
    latMax: 45.0,
    lonMin: -71,
    lonMax: -69,
    coastFaces: ["E", "SE", "S"],
    waterTempAvgByMonth: [40, 38, 40, 46, 53, 61, 68, 70, 66, 58, 50, 44],
  },
  gulf: {
    id: "gulf",
    name: "Gulf Coast",
    latMin: 25.0,
    latMax: 30.5,
    lonMin: -98,
    lonMax: -81,
    coastFaces: ["S", "SE", "SW"],
    waterTempAvgByMonth: [62, 63, 68, 74, 80, 84, 86, 86, 84, 78, 70, 64],
  },
};

/**
 * Detect coastal region from coordinates
 * @returns Region config or null if not in a known coastal area
 */
export function detectCoastalRegion(
  lat: number,
  lon: number
): CoastalRegion | null {
  for (const region of Object.values(COASTAL_REGIONS)) {
    if (
      lat >= region.latMin &&
      lat <= region.latMax &&
      lon >= region.lonMin &&
      lon <= region.lonMax
    ) {
      return region;
    }
  }
  return null;
}

/**
 * Get seasonal water temp context
 * @returns "warm for [month]", "cool for [month]", or null if typical
 */
export function getSeasonalTempContext(
  tempF: number,
  region: CoastalRegion,
  month: number // 0-11
): string | null {
  const avg = region.waterTempAvgByMonth[month];
  if (avg == null) return null;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const diff = tempF - avg;
  if (diff >= 5) {
    return `warm for ${monthNames[month]}`;
  }
  if (diff <= -5) {
    return `cool for ${monthNames[month]}`;
  }
  return null;
}
