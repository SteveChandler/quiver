import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// NOAA CO-OPS API endpoints
const COOPS_BASE_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

// CO-OPS station data for major surf locations
// Station lookup: https://tidesandcurrents.noaa.gov/stations.html
const COOPS_STATIONS: Record<string, string> = {
  // San Diego County, CA
  "la-jolla": "9410230",
  "san-diego": "9410170",
  "imperial-beach": "9410170",
  oceanside: "9410230",
  carlsbad: "9410230",
  encinitas: "9410230",
  "del-mar": "9410230",
  "solana-beach": "9410230",
  cardiff: "9410230",
  leucadia: "9410230",
  swamis: "9410230",
  moonlight: "9410230",
  "stone-steps": "9410230",
  grandview: "9410230",
  "blacks-beach": "9410230",
  windansea: "9410230",
  tourmaline: "9410230",
  "crystal-pier": "9410230",
  "pacific-beach": "9410230",
  "mission-beach": "9410230",
  "ocean-beach": "9410170",
  "sunset-cliffs": "9410170",
  coronado: "9410170",
  "silver-strand": "9410170",
  // Orange County, CA
  "huntington-beach": "9410580", // Newport Beach station
  "newport-beach": "9410580",
  "laguna-beach": "9410580",
  "dana-point": "9410580",
  "san-clemente": "9410580",
  trestles: "9410580",
  // Los Angeles County, CA
  "santa-monica": "9410840", // Santa Monica station
  malibu: "9410840",
  "el-porto": "9410840",
  manhattan: "9410840",
  hermosa: "9410840",
  redondo: "9410840",
  "palos-verdes": "9410840",
  // Santa Barbara / Ventura County, CA
  "santa-barbara": "9411340", // Santa Barbara station
  ventura: "9411270", // Ventura station
  rincon: "9411340",
  // Central California
  "santa-cruz": "9413450", // Monterey station
  monterey: "9413450",
  "pismo-beach": "9412110", // Port San Luis station
  "morro-bay": "9412110",
  // Northern California
  "san-francisco": "9414290", // San Francisco station
  pacifica: "9414290",
  "half-moon-bay": "9414290",
  "ocean-beach-sf": "9414290",
  // Oregon
  astoria: "9439040", // Astoria station
  "cannon-beach": "9439040",
  seaside: "9439040",
  "pacific-city": "9435380", // South Beach station
  lincoln: "9435380",
  newport: "9435380",
  florence: "9432780", // Charleston, OR station
  coos: "9432780",
  "charleston-or": "9432780", // Charleston, Oregon
  brookings: "9430104", // Crescent City, CA (closest to southern OR)
  "gold-beach": "9430104",
  bandon: "9432780",
  // Washington
  westport: "9441102", // Westport station
  "long-beach": "9440910", // Toke Point station
  "ocean-shores": "9441102",
  "la-push": "9442396", // Neah Bay station
  // Hawaii - Oahu
  pipeline: "1612340", // Honolulu station
  "north-shore": "1612340",
  waikiki: "1612340",
  "diamond-head": "1612340",
  "sandy-beach": "1612340",
  "waimea-bay": "1612340",
  sunset: "1612340",
  haleiwa: "1612340",
  // Hawaii - Maui
  lahaina: "1615680", // Kahului station
  hookipa: "1615680",
  honolua: "1615680",
  // Hawaii - Big Island
  kona: "1617433", // Kawaihae station
  hilo: "1617760", // Hilo station
  waikoloa: "1617433",
  // Hawaii - Kauai
  hanalei: "1611400", // Nawiliwili station
  poipu: "1611400",
  // ==================== EAST COAST ====================
  // New York
  rockaway: "8531680", // Sandy Hook, NJ (closest to Rockaway)
  "long-beach-ny": "8531680",
  montauk: "8510560", // Montauk station
  "fire-island": "8531680",
  // New Jersey
  "sandy-hook": "8531680", // Sandy Hook station
  "asbury-park": "8534720", // Atlantic City station
  "belmar": "8534720",
  "manasquan": "8534720",
  "seaside-heights": "8534720",
  "long-beach-island": "8534720",
  "ocean-city-nj": "8534720",
  "cape-may": "8536110", // Cape May station
  // Delaware / Maryland
  rehoboth: "8557380", // Lewes station
  "ocean-city-md": "8570283", // Ocean City Inlet station
  "assateague": "8570283",
  // Virginia
  "virginia-beach": "8638610", // Sewells Point station
  "sandbridge": "8638610",
  // North Carolina - Outer Banks
  "cape-hatteras": "8652587", // Oregon Inlet station
  "kill-devil-hills": "8651370", // Duck station
  "nags-head": "8651370",
  buxton: "8652587",
  rodanthe: "8652587",
  // North Carolina - South
  "wrightsville-beach": "8658120", // Wrightsville Beach station
  "carolina-beach": "8658163", // Wilmington station
  "topsail": "8658163",
  // South Carolina
  "myrtle-beach": "8661070", // Springmaid Pier station
  "folly-beach": "8665530", // Charleston, SC station
  "charleston-sc": "8665530", // Charleston, South Carolina
  "hilton-head": "8670870", // Fort Pulaski station
  // Georgia
  "tybee-island": "8670870", // Fort Pulaski station
  jekyll: "8677344", // Kings Bay station
  // Florida - Atlantic
  "jacksonville-beach": "8720218", // Mayport station
  "st-augustine": "8720587", // St. Augustine Beach station
  "flagler-beach": "8721604", // Ponce Inlet station
  "new-smyrna": "8721604",
  "cocoa-beach": "8721604",
  "sebastian-inlet": "8722670", // Lake Worth Pier station
  "jupiter": "8722670",
  "palm-beach": "8722670",
  "deerfield": "8723214", // Virginia Key station
  "pompano": "8723214",
  "fort-lauderdale": "8723214",
  "miami-beach": "8723214",
  // Florida - Gulf Coast
  "st-pete-beach": "8726520", // St. Petersburg station
  "clearwater": "8726520",
  "indian-rocks": "8726520",
  "cocoa-beach-gulf": "8726520",
  "naples": "8725110", // Naples station
  "marco-island": "8725110",
  // Florida Keys
  "key-west": "8724580", // Key West station
  // Texas Gulf Coast
  "galveston": "8771450", // Galveston Pier 21 station
  "south-padre": "8779770", // Port Isabel station
  "port-aransas": "8775241", // Aransas Pass station
  // New England
  "rhode-island": "8452660", // Newport, RI station
  "narragansett": "8452660",
  "newport-ri": "8452660",
  "block-island": "8452660",
  // Massachusetts
  "cape-cod": "8447930", // Woods Hole station
  "nantucket": "8449130", // Nantucket Island station
  "marthas-vineyard": "8447930",
  "hull": "8443970", // Boston station
  "gloucester": "8443970",
  // New Hampshire / Maine
  "hampton-beach": "8423898", // Fort Point station
  "york-beach": "8418150", // Portland station
  "old-orchard": "8418150",
  "higgins-beach": "8418150",
  "portland": "8418150",
  // Puerto Rico
  "rincon-pr": "9759394", // Mayaguez station
  "aguadilla": "9759394",
  "san-juan": "9755371", // San Juan station
};

// Geographic regions for station fallback lookup
interface RegionBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  stationId: string;
  name: string;
}

const GEOGRAPHIC_STATIONS: RegionBounds[] = [
  // ==================== WEST COAST ====================
  // Hawaii
  { latMin: 18.5, latMax: 22.5, lonMin: -160.5, lonMax: -154.5, stationId: "1612340", name: "Hawaii (Honolulu)" },
  // Southern California - San Diego
  { latMin: 32.5, latMax: 33.0, lonMin: -117.5, lonMax: -117.0, stationId: "9410170", name: "San Diego" },
  // Southern California - North County
  { latMin: 33.0, latMax: 33.5, lonMin: -117.5, lonMax: -117.1, stationId: "9410230", name: "La Jolla" },
  // Orange County
  { latMin: 33.3, latMax: 33.8, lonMin: -118.1, lonMax: -117.4, stationId: "9410580", name: "Newport Beach" },
  // Los Angeles
  { latMin: 33.7, latMax: 34.1, lonMin: -118.8, lonMax: -118.1, stationId: "9410840", name: "Santa Monica" },
  // Ventura / Santa Barbara
  { latMin: 34.0, latMax: 34.5, lonMin: -120.0, lonMax: -119.0, stationId: "9411340", name: "Santa Barbara" },
  // Central California
  { latMin: 34.5, latMax: 37.0, lonMin: -122.5, lonMax: -120.0, stationId: "9413450", name: "Monterey" },
  // Northern California
  { latMin: 37.0, latMax: 42.0, lonMin: -124.5, lonMax: -122.0, stationId: "9414290", name: "San Francisco" },
  // Southern Oregon
  { latMin: 42.0, latMax: 43.5, lonMin: -125.0, lonMax: -124.0, stationId: "9432780", name: "Charleston OR" },
  // Central Oregon
  { latMin: 43.5, latMax: 45.0, lonMin: -125.0, lonMax: -123.5, stationId: "9435380", name: "South Beach OR" },
  // Northern Oregon
  { latMin: 45.0, latMax: 46.5, lonMin: -124.5, lonMax: -123.5, stationId: "9439040", name: "Astoria OR" },
  // Washington
  { latMin: 46.0, latMax: 49.0, lonMin: -125.0, lonMax: -123.0, stationId: "9441102", name: "Westport WA" },
  // Baja Mexico (use San Diego)
  { latMin: 30.0, latMax: 32.5, lonMin: -117.5, lonMax: -116.0, stationId: "9410170", name: "San Diego (Baja)" },
  // ==================== EAST COAST ====================
  // Maine
  { latMin: 43.0, latMax: 45.5, lonMin: -71.0, lonMax: -69.5, stationId: "8418150", name: "Portland ME" },
  // New Hampshire
  { latMin: 42.8, latMax: 43.2, lonMin: -71.0, lonMax: -70.5, stationId: "8423898", name: "Fort Point NH" },
  // Massachusetts
  { latMin: 41.0, latMax: 43.0, lonMin: -71.5, lonMax: -69.5, stationId: "8443970", name: "Boston MA" },
  // Rhode Island
  { latMin: 41.0, latMax: 42.0, lonMin: -72.0, lonMax: -71.0, stationId: "8452660", name: "Newport RI" },
  // Connecticut / Long Island Sound
  { latMin: 40.5, latMax: 41.5, lonMin: -74.0, lonMax: -72.0, stationId: "8531680", name: "Sandy Hook NJ" },
  // New York - Long Island
  { latMin: 40.4, latMax: 41.2, lonMin: -74.0, lonMax: -71.5, stationId: "8531680", name: "Sandy Hook NJ (NY)" },
  // New Jersey
  { latMin: 38.9, latMax: 40.5, lonMin: -75.0, lonMax: -73.5, stationId: "8534720", name: "Atlantic City NJ" },
  // Delaware / Maryland
  { latMin: 38.0, latMax: 39.0, lonMin: -75.5, lonMax: -74.5, stationId: "8570283", name: "Ocean City MD" },
  // Virginia
  { latMin: 36.5, latMax: 38.0, lonMin: -76.5, lonMax: -75.0, stationId: "8638610", name: "Virginia Beach VA" },
  // North Carolina - Outer Banks
  { latMin: 34.5, latMax: 36.5, lonMin: -76.5, lonMax: -75.0, stationId: "8652587", name: "Oregon Inlet NC" },
  // North Carolina - South
  { latMin: 33.5, latMax: 34.5, lonMin: -78.5, lonMax: -77.5, stationId: "8658120", name: "Wrightsville NC" },
  // South Carolina
  { latMin: 32.0, latMax: 34.0, lonMin: -81.0, lonMax: -78.5, stationId: "8665530", name: "Charleston SC" },
  // Georgia
  { latMin: 30.5, latMax: 32.5, lonMin: -82.0, lonMax: -80.5, stationId: "8670870", name: "Fort Pulaski GA" },
  // Florida - Northeast
  { latMin: 29.0, latMax: 31.0, lonMin: -82.0, lonMax: -80.0, stationId: "8720218", name: "Mayport FL" },
  // Florida - Central Atlantic
  { latMin: 27.5, latMax: 29.5, lonMin: -81.0, lonMax: -79.5, stationId: "8721604", name: "Ponce Inlet FL" },
  // Florida - Southeast
  { latMin: 25.5, latMax: 27.5, lonMin: -80.5, lonMax: -79.5, stationId: "8723214", name: "Virginia Key FL" },
  // Florida Keys
  { latMin: 24.0, latMax: 25.5, lonMin: -82.0, lonMax: -80.0, stationId: "8724580", name: "Key West FL" },
  // ==================== GULF COAST ====================
  // Florida - Gulf
  { latMin: 27.0, latMax: 30.0, lonMin: -83.5, lonMax: -82.0, stationId: "8726520", name: "St. Petersburg FL" },
  // Florida - Panhandle
  { latMin: 29.5, latMax: 31.0, lonMin: -87.5, lonMax: -84.0, stationId: "8729108", name: "Panama City FL" },
  // Alabama / Mississippi
  { latMin: 29.5, latMax: 31.0, lonMin: -89.5, lonMax: -87.5, stationId: "8735180", name: "Dauphin Island AL" },
  // Louisiana
  { latMin: 28.5, latMax: 30.5, lonMin: -93.5, lonMax: -89.0, stationId: "8761724", name: "Grand Isle LA" },
  // Texas - Upper Coast
  { latMin: 28.5, latMax: 30.0, lonMin: -96.0, lonMax: -93.5, stationId: "8771450", name: "Galveston TX" },
  // Texas - South Padre
  { latMin: 25.5, latMax: 28.5, lonMin: -98.0, lonMax: -96.0, stationId: "8779770", name: "Port Isabel TX" },
  // ==================== CARIBBEAN ====================
  // Puerto Rico - West
  { latMin: 17.5, latMax: 18.6, lonMin: -67.5, lonMax: -66.5, stationId: "9759394", name: "Mayaguez PR" },
  // Puerto Rico - North/East
  { latMin: 17.5, latMax: 18.6, lonMin: -66.5, lonMax: -65.0, stationId: "9755371", name: "San Juan PR" },
];

// Types for CO-OPS data
interface TideExtreme {
  t: string; // timestamp
  v: string; // height value
  type: "H" | "L"; // High or Low
}

interface TideData {
  time: number; // Unix timestamp
  height: number; // Height in feet
  name: string; // "High Tide" or "Low Tide"
  type: "high" | "low";
}

interface COOPSForecast {
  station_id: string;
  station_name: string;
  tides: TideData[];
  water_level: number | null; // Current water level in feet
}

export class NOAACOOPSService {
  /**
   * Get the appropriate CO-OPS station for a beach location
   * Uses name lookup first, then geographic bounds, then nearest station
   */
  getStationForLocation(beachName: string, lat?: number, lng?: number): string {
    const normalizedName = beachName.toLowerCase().replace(/\s+/g, "-");

    // First try direct lookup by beach name
    if (COOPS_STATIONS[normalizedName]) {
      return COOPS_STATIONS[normalizedName];
    }

    // Try partial name matching
    for (const [key, stationId] of Object.entries(COOPS_STATIONS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return stationId;
      }
    }

    // Fallback based on geographic location
    if (lat && lng) {
      // Find matching geographic region
      for (const region of GEOGRAPHIC_STATIONS) {
        if (
          lat >= region.latMin &&
          lat <= region.latMax &&
          lng >= region.lonMin &&
          lng <= region.lonMax
        ) {
          console.log(
            `📍 Using ${region.name} tide station (${region.stationId}) for ${beachName} at ${lat}, ${lng}`
          );
          return region.stationId;
        }
      }

      // If no exact region match, find nearest region by distance
      let nearestStation = "9410230"; // Default to La Jolla
      let nearestDistance = Infinity;

      for (const region of GEOGRAPHIC_STATIONS) {
        const regionCenterLat = (region.latMin + region.latMax) / 2;
        const regionCenterLon = (region.lonMin + region.lonMax) / 2;
        const distance = Math.sqrt(
          Math.pow(lat - regionCenterLat, 2) + Math.pow(lng - regionCenterLon, 2)
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestStation = region.stationId;
        }
      }

      console.log(
        `📍 Using nearest tide station (${nearestStation}) for ${beachName} at ${lat}, ${lng} (distance: ${nearestDistance.toFixed(2)}°)`
      );
      return nearestStation;
    }

    // Final fallback - La Jolla station (most common use case)
    console.warn(
      `⚠️ No tide station found for ${beachName}, defaulting to La Jolla`
    );
    return "9410230";
  }

  /**
   * Fetch comprehensive tide and current data from CO-OPS
   */
  async fetchCOOPSData(
    stationId: string,
    days: number = 10
  ): Promise<COOPSForecast | null> {
    try {
      console.log(`Fetching CO-OPS data for station ${stationId}`);

      const now = new Date();
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const formatDate = (date: Date) => {
        return date.toISOString().split("T")[0].replace(/-/g, "");
      };

      const beginDate = formatDate(now);
      const endDateStr = formatDate(endDate);

      // Fetch multiple data types in parallel
      const [tideData, waterLevelData, stationInfo] = await Promise.all([
        this.fetchTidePredictions(stationId, beginDate, endDateStr),
        this.fetchCurrentWaterLevel(stationId),
        this.fetchStationInfo(stationId),
      ]);

      return {
        station_id: stationId,
        station_name: stationInfo?.name || `Station ${stationId}`,
        tides: tideData,
        water_level: waterLevelData,
      };
    } catch (error) {
      console.error(
        `Error fetching CO-OPS data for station ${stationId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Fetch tide predictions (high/low tides)
   */
  private async fetchTidePredictions(
    stationId: string,
    beginDate: string,
    endDate: string
  ): Promise<TideData[]> {
    try {
      const url = new URL(COOPS_BASE_URL);
      url.searchParams.set("application", "quiver-surf-app");
      url.searchParams.set("station", stationId);
      url.searchParams.set("begin_date", beginDate);
      url.searchParams.set("end_date", endDate);
      url.searchParams.set("product", "predictions");
      url.searchParams.set("datum", "MLLW"); // Mean Lower Low Water
      url.searchParams.set("units", "english");
      url.searchParams.set("time_zone", "lst_ldt"); // Local time
      url.searchParams.set("interval", "hilo"); // High and low tides only
      url.searchParams.set("format", "json");

      console.log(`Fetching NOAA CO-OPS tide data from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "quiver-surf-app (contact@quiver.com)",
        },
      });

      if (!response.ok) {
        console.error(
          `CO-OPS tide API error: ${response.status} - ${response.statusText}`
        );
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        throw new Error(`CO-OPS tide API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Received tide data for station ${stationId}:`, data);

      if (!data.predictions) {
        console.warn("No tide predictions data returned, using fallback");
        return this.generateFallbackTideData();
      }

      const tideData = data.predictions.map((prediction: TideExtreme) => ({
        time: new Date(prediction.t).getTime() / 1000,
        height: parseFloat(prediction.v),
        name: prediction.type === "H" ? "High Tide" : "Low Tide",
        type: prediction.type === "H" ? "high" : "low",
      }));

      console.log(
        `Parsed ${tideData.length} tide predictions for station ${stationId}`
      );
      return tideData;
    } catch (error) {
      console.error("Error fetching tide predictions:", error);
      console.log("Using fallback tide data for development");
      // Return fallback simulated data for development
      return this.generateFallbackTideData();
    }
  }

  /**
   * Fetch current water level
   */
  private async fetchCurrentWaterLevel(
    stationId: string
  ): Promise<number | null> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const formatDateTime = (date: Date) => {
        return date
          .toISOString()
          .split(".")[0]
          .replace(/[-:]/g, "")
          .replace("T", " ");
      };

      const url = new URL(COOPS_BASE_URL);
      url.searchParams.set("application", "quiver-surf-app");
      url.searchParams.set("station", stationId);
      url.searchParams.set("begin_date", formatDateTime(oneHourAgo));
      url.searchParams.set("end_date", formatDateTime(now));
      url.searchParams.set("product", "water_level");
      url.searchParams.set("datum", "MLLW");
      url.searchParams.set("units", "english");
      url.searchParams.set("time_zone", "lst_ldt");
      url.searchParams.set("format", "json");

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "quiver-surf-app (contact@quiver.com)",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        return null;
      }

      // Return the most recent water level reading
      const latestReading = data.data[data.data.length - 1];
      return parseFloat(latestReading.v);
    } catch (error) {
      console.error("Error fetching current water level:", error);
      return null;
    }
  }

  /**
   * Fetch station information
   */
  private async fetchStationInfo(
    stationId: string
  ): Promise<{ name: string } | null> {
    try {
      const url = new URL(COOPS_BASE_URL);
      url.searchParams.set("application", "quiver-surf-app");
      url.searchParams.set("station", stationId);
      url.searchParams.set("product", "datums");
      url.searchParams.set("format", "json");

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "quiver-surf-app (contact@quiver.com)",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        name: data.metadata?.name || `Station ${stationId}`,
      };
    } catch (error) {
      console.error("Error fetching station info:", error);
      return null;
    }
  }

  /**
   * Generate fallback tide data for development/testing
   * Creates a realistic tide schedule with proper high/low patterns
   */
  private generateFallbackTideData(): TideData[] {
    const tides: TideData[] = [];

    // Start from beginning of today
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0);

    // Generate tides for 15 days
    for (let day = 0; day < 15; day++) {
      const dayStart = new Date(
        startTime.getTime() + day * 24 * 60 * 60 * 1000
      );

      // San Diego typically has 2 high tides and 2 low tides per day
      // Semi-diurnal tide pattern with about 6.2 hour intervals

      // First low tide (around 1:30 AM)
      const lowTide1 = new Date(
        dayStart.getTime() + (1.5 + Math.sin(day * 0.1) * 0.5) * 60 * 60 * 1000
      );

      // First high tide (around 7:45 AM)
      const highTide1 = new Date(lowTide1.getTime() + 6.25 * 60 * 60 * 1000);

      // Second low tide (around 2:00 PM)
      const lowTide2 = new Date(highTide1.getTime() + 6.25 * 60 * 60 * 1000);

      // Second high tide (around 8:15 PM)
      const highTide2 = new Date(lowTide2.getTime() + 6.25 * 60 * 60 * 1000);

      // Add some variation to tide heights
      const heightVariation = Math.sin(day * 0.2) * 0.5;

      tides.push({
        time: Math.floor(lowTide1.getTime() / 1000),
        height: Math.round((0.8 + heightVariation) * 10) / 10,
        name: "Low Tide",
        type: "low",
      });

      tides.push({
        time: Math.floor(highTide1.getTime() / 1000),
        height: Math.round((5.2 + heightVariation) * 10) / 10,
        name: "High Tide",
        type: "high",
      });

      tides.push({
        time: Math.floor(lowTide2.getTime() / 1000),
        height: Math.round((1.2 + heightVariation) * 10) / 10,
        name: "Low Tide",
        type: "low",
      });

      tides.push({
        time: Math.floor(highTide2.getTime() / 1000),
        height: Math.round((4.8 + heightVariation) * 10) / 10,
        name: "High Tide",
        type: "high",
      });
    }

    return tides.sort((a, b) => a.time - b.time);
  }

  /**
   * Get tide status for a specific time
   */
  getTideStatusAtTime(tides: TideData[], targetTime: Date): string {
    if (!tides || tides.length === 0) return "Unknown";

    const targetTimestamp = targetTime.getTime() / 1000;

    // Find the closest tide events (before and after target time)
    const sortedTides = [...tides].sort((a, b) => a.time - b.time);

    let prevTide = null;
    let nextTide = null;

    for (let i = 0; i < sortedTides.length; i++) {
      if (sortedTides[i].time <= targetTimestamp) {
        prevTide = sortedTides[i];
      } else {
        nextTide = sortedTides[i];
        break;
      }
    }

    if (!prevTide && nextTide) {
      return nextTide.type === "high" ? "Rising" : "Falling";
    }

    if (prevTide && !nextTide) {
      return prevTide.type === "high" ? "Falling" : "Rising";
    }

    if (prevTide && nextTide) {
      if (prevTide.type === "high" && nextTide.type === "low") {
        return "Falling";
      } else if (prevTide.type === "low" && nextTide.type === "high") {
        return "Rising";
      }
    }

    return "Unknown";
  }

  /**
   * Get current tide height estimate
   */
  getCurrentTideHeight(tides: TideData[]): number | null {
    if (!tides || tides.length < 2) return null;

    const now = Date.now() / 1000;
    return this.getTideHeightAtTime(tides, new Date(now * 1000));
  }

  /**
   * Get tide height estimate for a specific time
   */
  getTideHeightAtTime(tides: TideData[], targetTime: Date): number | null {
    if (!tides || tides.length < 2) return null;

    const targetTimestamp = targetTime.getTime() / 1000;
    const sortedTides = [...tides].sort((a, b) => a.time - b.time);

    // Find surrounding tides
    let prevTide = null;
    let nextTide = null;

    for (let i = 0; i < sortedTides.length; i++) {
      if (sortedTides[i].time <= targetTimestamp) {
        prevTide = sortedTides[i];
      } else {
        nextTide = sortedTides[i];
        break;
      }
    }

    if (!prevTide || !nextTide) return null;

    // Linear interpolation between tides
    const timeDiff = nextTide.time - prevTide.time;
    const timeElapsed = targetTimestamp - prevTide.time;
    const progress = timeElapsed / timeDiff;

    const heightDiff = nextTide.height - prevTide.height;
    const currentHeight = prevTide.height + heightDiff * progress;

    return Math.round(currentHeight * 10) / 10;
  }

  /**
   * Get next tide from current time
   */
  getNextTide(tides: TideData[]): TideData | null {
    if (!tides || tides.length === 0) return null;

    const now = Date.now() / 1000;
    return this.getNextTideFromTime(tides, new Date(now * 1000));
  }

  /**
   * Get next tide from a specific time
   */
  getNextTideFromTime(tides: TideData[], targetTime: Date): TideData | null {
    if (!tides || tides.length === 0) return null;

    const targetTimestamp = targetTime.getTime() / 1000;
    const sortedTides = [...tides].sort((a, b) => a.time - b.time);

    // Find the next tide after the target time
    for (const tide of sortedTides) {
      if (tide.time > targetTimestamp) {
        return tide;
      }
    }

    return null;
  }
}
