import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// NOAA Real-time Data URLs
const NDBC_REALTIME_BASE = "https://www.ndbc.noaa.gov/data/realtime2";
const NOAA_TIDES_BASE =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

interface BuoyMeasurements {
  buoy_uuid: string;
  air_temperature?: number;
  water_temperature?: number;
  wave_period?: number;
  wave_height?: number;
  wind_speed?: number;
  wind_gust?: number;
  wind_direction?: number;
  pressure?: number;
  updated_at: string;
}

interface TideData {
  time: number;
  height: number;
  name: string;
}

export class NOAAConditionsSync {
  private supabase;

  constructor() {
    this.supabase = createSupabaseServiceRoleClient();
  }

  /**
   * Update all active buoys with current conditions from NOAA
   */
  async updateAllBuoyConditions(): Promise<{
    success: boolean;
    updated: number;
    failed: number;
    error?: string;
  }> {
    try {
      console.log("🌊 Starting NOAA conditions update...");

      // Get all active buoys from database
      const { data: buoys, error } = await this.supabase
        .from("buoys")
        .select("buoy_uuid, kind, active")
        .eq("active", true);

      if (error) {
        throw new Error(`Failed to fetch buoys: ${error.message}`);
      }

      if (!buoys || buoys.length === 0) {
        return {
          success: true,
          updated: 0,
          failed: 0,
          error: "No active buoys found",
        };
      }

      console.log(`📡 Found ${buoys.length} active buoys to update`);

      let updated = 0;
      let failed = 0;

      // Update conditions for each buoy
      for (const buoy of buoys) {
        try {
          const conditions = await this.fetchBuoyConditions(buoy.buoy_uuid);
          if (conditions) {
            await this.updateBuoyInDatabase(conditions);
            updated++;
            console.log(`✅ Updated ${buoy.buoy_uuid}`);
          } else {
            failed++;
            console.log(`❌ No data for ${buoy.buoy_uuid}`);
          }
        } catch (error) {
          failed++;
          console.error(`❌ Failed to update ${buoy.buoy_uuid}:`, error);
        }

        // Add small delay to avoid overwhelming NOAA servers
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(
        `🏁 Conditions update complete: ${updated} updated, ${failed} failed`
      );

      return {
        success: true,
        updated,
        failed,
      };
    } catch (error) {
      console.error("NOAA conditions sync failed:", error);
      return {
        success: false,
        updated: 0,
        failed: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch current conditions for a specific buoy from NOAA
   */
  private async fetchBuoyConditions(
    buoyId: string
  ): Promise<BuoyMeasurements | null> {
    try {
      // Try multiple NOAA data formats
      const conditions = await this.fetchNDBCData(buoyId);

      if (conditions) {
        return {
          buoy_uuid: buoyId,
          ...conditions,
          updated_at: new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.warn(`Could not fetch conditions for ${buoyId}:`, error);
      return null;
    }
  }

  /**
   * Fetch data from NDBC (National Data Buoy Center)
   */
  private async fetchNDBCData(
    buoyId: string
  ): Promise<Partial<BuoyMeasurements> | null> {
    try {
      // NDBC real-time meteorological data
      const metUrl = `${NDBC_REALTIME_BASE}/${buoyId}.txt`;

      const response = await fetch(metUrl, {
        headers: {
          "User-Agent": "Quiver-Surf-App/1.0 (contact@quiver.com)",
        },
      });

      if (!response.ok) {
        // Try alternative station ID format
        const altId = buoyId.replace(/[a-z]/gi, "").padStart(5, "0");
        const altUrl = `${NDBC_REALTIME_BASE}/${altId}.txt`;

        const altResponse = await fetch(altUrl, {
          headers: {
            "User-Agent": "Quiver-Surf-App/1.0 (contact@quiver.com)",
          },
        });

        if (!altResponse.ok) {
          return null;
        }

        const altData = await altResponse.text();
        return this.parseNDBCData(altData);
      }

      const data = await response.text();
      return this.parseNDBCData(data);
    } catch (error) {
      console.warn(`NDBC fetch failed for ${buoyId}:`, error);
      return null;
    }
  }

  /**
   * Parse NDBC text format data
   */
  private parseNDBCData(data: string): Partial<BuoyMeasurements> | null {
    try {
      const lines = data.split("\n");

      if (lines.length < 3) {
        return null;
      }

      // Skip header lines and get most recent data
      const latestLine = lines[2];
      const values = latestLine.split(/\s+/);

      if (values.length < 8) {
        return null;
      }

      // NDBC format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
      const [
        ,
        ,
        ,
        ,
        ,
        windDir,
        windSpeed,
        gust,
        waveHeight,
        dominantPeriod,
        ,
        ,
        pressure,
        airTemp,
        waterTemp,
      ] = values;

      const parseValue = (val: string): number | undefined => {
        if (!val || val === "MM" || val === "999" || val === "99.0")
          return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      };

      return {
        wind_direction: parseValue(windDir),
        wind_speed: parseValue(windSpeed),
        wind_gust: parseValue(gust),
        wave_height: parseValue(waveHeight),
        wave_period: parseValue(dominantPeriod),
        pressure: parseValue(pressure),
        air_temperature: parseValue(airTemp),
        water_temperature: parseValue(waterTemp),
      };
    } catch (error) {
      console.warn("Failed to parse NDBC data:", error);
      return null;
    }
  }

  /**
   * Update buoy conditions in database
   */
  private async updateBuoyInDatabase(
    conditions: BuoyMeasurements
  ): Promise<void> {
    const { error } = await this.supabase
      .from("buoys")
      .update({
        air_temperature: conditions.air_temperature,
        water_temperature: conditions.water_temperature,
        wave_period: conditions.wave_period,
        wave_height: conditions.wave_height,
        wind_speed: conditions.wind_speed,
        wind_gust: conditions.wind_gust,
        wind_direction: conditions.wind_direction,
        updated_at: conditions.updated_at,
      })
      .eq("buoy_uuid", conditions.buoy_uuid);

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * Update a single buoy's conditions
   */
  async updateSingleBuoy(buoyId: string): Promise<{
    success: boolean;
    conditions?: BuoyMeasurements;
    error?: string;
  }> {
    try {
      const conditions = await this.fetchBuoyConditions(buoyId);

      if (!conditions) {
        return {
          success: false,
          error: "No conditions data available",
        };
      }

      await this.updateBuoyInDatabase(conditions);

      return {
        success: true,
        conditions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
