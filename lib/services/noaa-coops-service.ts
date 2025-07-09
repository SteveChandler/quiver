import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// NOAA CO-OPS API endpoints
const COOPS_BASE_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

// CO-OPS station data for major surf locations
const COOPS_STATIONS = {
  // California Coast
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
};

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

interface CurrentData {
  time: number; // Unix timestamp
  speed: number; // Current speed in knots
  direction: number; // Current direction in degrees
  type: "flood" | "ebb" | "slack"; // Current type
}

interface COOPSForecast {
  station_id: string;
  station_name: string;
  tides: TideData[];
  currents: CurrentData[];
  water_level: number | null; // Current water level in feet
}

export class NOAACOOPSService {
  /**
   * Get the appropriate CO-OPS station for a beach location
   */
  getStationForLocation(beachName: string, lat?: number, lng?: number): string {
    const normalizedName = beachName.toLowerCase().replace(/\s+/g, "-");

    // First try direct lookup
    if (COOPS_STATIONS[normalizedName as keyof typeof COOPS_STATIONS]) {
      return COOPS_STATIONS[normalizedName as keyof typeof COOPS_STATIONS];
    }

    // Fallback based on geographic location
    if (lat && lng) {
      // San Diego area (south)
      if (lat < 32.8) {
        return "9410170"; // San Diego Bay
      }
      // North County (north of Del Mar)
      if (lat > 32.95) {
        return "9410230"; // La Jolla
      }
    }

    // Default to La Jolla station for San Diego area
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
      const [tideData, currentData, waterLevelData, stationInfo] =
        await Promise.all([
          this.fetchTidePredictions(stationId, beginDate, endDateStr),
          this.fetchCurrentPredictions(stationId, beginDate, endDateStr),
          this.fetchCurrentWaterLevel(stationId),
          this.fetchStationInfo(stationId),
        ]);

      return {
        station_id: stationId,
        station_name: stationInfo?.name || `Station ${stationId}`,
        tides: tideData,
        currents: currentData,
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
   * Fetch tidal current predictions
   */
  private async fetchCurrentPredictions(
    stationId: string,
    beginDate: string,
    endDate: string
  ): Promise<CurrentData[]> {
    try {
      const url = new URL(COOPS_BASE_URL);
      url.searchParams.set("application", "quiver-surf-app");
      url.searchParams.set("station", stationId);
      url.searchParams.set("begin_date", beginDate);
      url.searchParams.set("end_date", endDate);
      url.searchParams.set("product", "currents_predictions");
      url.searchParams.set("units", "english");
      url.searchParams.set("time_zone", "lst_ldt");
      url.searchParams.set("format", "json");

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "quiver-surf-app (contact@quiver.com)",
        },
      });

      if (!response.ok) {
        // Current predictions may not be available for all stations
        console.warn(
          `Current predictions not available for station ${stationId}`
        );
        return [];
      }

      const data = await response.json();

      if (!data.current_predictions) {
        return [];
      }

      return data.current_predictions.map((current: any) => ({
        time: new Date(current.t).getTime() / 1000,
        speed: parseFloat(current.s || "0"),
        direction: parseFloat(current.d || "0"),
        type: this.determineCurrentType(parseFloat(current.s || "0")),
      }));
    } catch (error) {
      console.error("Error fetching current predictions:", error);
      return [];
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
   * Determine current type based on speed
   */
  private determineCurrentType(speed: number): "flood" | "ebb" | "slack" {
    if (speed < 0.2) return "slack";
    return speed > 0 ? "flood" : "ebb";
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
