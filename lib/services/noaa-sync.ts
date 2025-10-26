import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CoordinateParser } from "@/lib/utils/coordinate-parser";

// NOAA Master Station List URL (matches Ruby NoaaBuoyFindAll)
const NOAA_STATION_LIST_URL =
  "https://www.ndbc.noaa.gov/data/stations/station_table.txt";

interface NOAAStationRow {
  stationId: string;
  stationName: string;
  coordinates: [number, number]; // [lat, lng]
  status: string;
}

interface Beach {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export class NOAABuoySync {
  private supabase;

  constructor() {
    this.supabase = createSupabaseServiceRoleClient();
  }

  /**
   * Sync NOAA buoys, but only for areas near existing beaches
   * Matches Ruby NoaaBuoyFindAll.upsert! but with geographic filtering
   */
  async syncBuoysForExistingBeaches(maxDistanceKm: number = 200): Promise<{
    success: boolean;
    buoysAdded: number;
    stationsAdded: number;
    error?: string;
  }> {
    try {
      console.log("Starting NOAA buoy sync for existing beaches...");

      // 1. Get all existing beaches
      const beaches = await this.getExistingBeaches();
      if (beaches.length === 0) {
        return {
          success: false,
          buoysAdded: 0,
          stationsAdded: 0,
          error: "No beaches found in database",
        };
      }

      console.log(`Found ${beaches.length} beaches to sync buoys for`);
      console.log(
        `Sample beaches:`,
        beaches
          .slice(0, 3)
          .map((b) => `${b.name} (${b.lat}, ${b.lon})`)
      );

      // 2. Fetch NOAA station master list
      const stations = await this.fetchNOAAStationList();
      console.log(
        `Fetched ${stations.length} valid NOAA stations (after filtering invalid coordinates)`
      );

      if (stations.length > 0) {
        console.log(
          `Sample stations:`,
          stations
            .slice(0, 3)
            .map(
              (s) =>
                `${s.stationId}: ${s.stationName} [${s.coordinates[0]}, ${s.coordinates[1]}]`
            )
        );
      }

      // 3. Filter stations to only those near existing beaches
      const relevantStations = this.filterStationsNearBeaches(
        stations,
        beaches,
        maxDistanceKm
      );
      console.log(
        `Found ${relevantStations.length} stations within ${maxDistanceKm}km of beaches`
      );

      if (relevantStations.length > 0) {
        console.log(
          `Relevant stations:`,
          relevantStations
            .slice(0, 3)
            .map((s) => `${s.stationId}: ${s.stationName}`)
        );
      }

      // 4. Upsert relevant buoys and stations
      const results = await this.upsertStations(relevantStations);

      console.log(
        `Sync complete: ${results.buoysAdded} buoys, ${results.stationsAdded} stations added`
      );
      return {
        success: true,
        buoysAdded: results.buoysAdded,
        stationsAdded: results.stationsAdded,
      };
    } catch (error) {
      console.error("NOAA sync failed:", error);
      return {
        success: false,
        buoysAdded: 0,
        stationsAdded: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get all beaches from the database
   */
  private async getExistingBeaches(): Promise<Beach[]> {
    const { data, error } = await this.supabase
      .from("beaches")
      .select("id, name, lat, lon")
      .not("lat", "is", null)
      .not("lon", "is", null);

    if (error) {
      throw new Error(`Failed to fetch beaches: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetch and parse NOAA station master list
   * Matches Ruby NoaaBuoyFindAll.upsert! parsing logic
   */
  private async fetchNOAAStationList(): Promise<NOAAStationRow[]> {
    const response = await fetch(NOAA_STATION_LIST_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch NOAA station list: ${response.statusText}`
      );
    }

    const data = await response.text();
    const lines = data.split("\n");
    const stations: NOAAStationRow[] = [];

    // Skip header rows (first 2 lines)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const station = this.parseStationLine(line);
      if (station) {
        stations.push(station);
      }
    }

    return stations;
  }

  /**
   * Parse a single station line from NOAA data
   */
  private parseStationLine(line: string): NOAAStationRow | null {
    const rowData = line.split("|");
    if (rowData.length < 7) return null;

    const stationId = rowData[0]?.trim();
    const stationName = rowData[4]?.trim();
    const coordString = rowData[6]?.trim();
    const status = rowData[rowData.length - 1]?.trim();

    // Skip destroyed/decommissioned stations (matches Ruby logic)
    if (this.shouldSkipStation(status)) {
      console.log(`Skipping station ${stationId}: ${status}`);
      return null;
    }

    // Parse coordinates using the utility class
    const coordinates = CoordinateParser.parseAndValidate(coordString);
    if (!coordinates) {
      console.warn(
        `Invalid coordinates for station ${stationId}: ${coordString}`
      );
      return null;
    }

    return {
      stationId,
      stationName,
      coordinates,
      status,
    };
  }

  /**
   * Check if a station should be skipped based on its status
   */
  private shouldSkipStation(status: string): boolean {
    return (
      status?.match(
        /(destroy|disestablished|decommissioned|internal\s+use\s+only)/i
      ) !== null
    );
  }

  /**
   * Filter stations to only those within specified distance of existing beaches
   */
  private filterStationsNearBeaches(
    stations: NOAAStationRow[],
    beaches: Beach[],
    maxDistanceKm: number
  ): NOAAStationRow[] {
    const relevantStations: NOAAStationRow[] = [];
    let totalDistanceChecks = 0;
    let nearbyCount = 0;

    console.log(
      `Checking distances for ${stations.length} stations against ${beaches.length} beaches...`
    );

    stations.forEach((station, index) => {
      const [stationLat, stationLng] = station.coordinates;
      let minDistance = Infinity;
      let closestBeach = "";

      // Find closest beach to this station
      beaches.forEach((beach) => {
        const distance = this.calculateDistance(
          stationLat,
          stationLng,
          beach.lat,
          beach.lon
        );
        totalDistanceChecks++;

        if (distance < minDistance) {
          minDistance = distance;
          closestBeach = beach.name;
        }
      });

      // Log first few stations and any that are close
      if (index < 5 || minDistance <= maxDistanceKm * 1.2) {
        console.log(
          `Station ${station.stationId} (${
            station.stationName
          }): ${minDistance.toFixed(1)}km from ${closestBeach}`
        );
      }

      if (minDistance <= maxDistanceKm) {
        relevantStations.push(station);
        nearbyCount++;
      }
    });

    console.log(
      `Distance check complete: ${totalDistanceChecks} calculations, ${nearbyCount} stations within ${maxDistanceKm}km`
    );
    return relevantStations;
  }

  /**
   * Calculate distance between two points in kilometers
   * Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Upsert stations into the database
   * Matches Ruby logic: create buoy record and station record if name contains " - "
   */
  private async upsertStations(stations: NOAAStationRow[]): Promise<{
    buoysAdded: number;
    stationsAdded: number;
  }> {
    let buoysAdded = 0;
    let stationsAdded = 0;

    for (const station of stations) {
      try {
        const [lat, lng] = station.coordinates;

        // Create primary buoy record (matches Ruby: kind: :buoy)
        console.log(
          `Upserting buoy ${station.stationId}: ${station.stationName} at [${lat}, ${lng}]`
        );

        const buoyResult = await this.supabase.from("buoys").upsert(
          {
            buoy_uuid: station.stationId,
            buoy_name: station.stationName,
            kind: "buoy",
            coordinates: `POINT(${lng} ${lat})`,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "buoy_uuid,kind",
          }
        );

        if (buoyResult.error) {
          console.error(
            `❌ Failed to upsert buoy ${station.stationId}:`,
            JSON.stringify(buoyResult.error, null, 2)
          );
          continue;
        }
        console.log(`✅ Successfully upserted buoy ${station.stationId}`);
        buoysAdded++;

        // Create station record if name contains " - " (matches Ruby logic)
        const stationRecord = this.extractStationRecord(station);
        if (stationRecord) {
          const stationResult = await this.supabase.from("buoys").upsert(
            {
              buoy_uuid: stationRecord.id,
              buoy_name: stationRecord.name,
              kind: "station",
              coordinates: `POINT(${lng} ${lat})`,
              active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "buoy_uuid,kind",
            }
          );

          if (stationResult.error) {
            console.error(
              `❌ Failed to upsert station ${stationRecord.id}:`,
              JSON.stringify(stationResult.error, null, 2)
            );
          } else {
            console.log(`✅ Successfully upserted station ${stationRecord.id}`);
            stationsAdded++;
          }
        }
      } catch (error) {
        console.error(`Error processing station ${station.stationId}:`, error);
      }
    }

    return { buoysAdded, stationsAdded };
  }

  /**
   * Extract station record from station name if it contains " - "
   */
  private extractStationRecord(station: NOAAStationRow): {
    id: string;
    name: string;
  } | null {
    if (!station.stationName.includes(" - ")) {
      return null;
    }

    const parts = station.stationName.split(" - ");
    const stationId = parts[0].trim();
    const stationName = parts.slice(1).join(" - ").trim();

    // Only create station if stationId is numeric (matches Ruby logic)
    if (isNaN(parseInt(stationId))) {
      return null;
    }

    console.log(`Creating station: ${stationId} from ${station.stationName}`);

    return {
      id: stationId,
      name: stationName,
    };
  }
}
