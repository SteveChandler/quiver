import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { NOAAConditionsSync } from "./noaa-conditions-sync";

interface InactiveBuoy {
  buoy_uuid: string;
  buoy_name: string;
  kind: string;
  coordinates: string;
  failure_count: number;
  last_successful_update: string | null;
  last_attempted_update: string | null;
}

interface CleanupResult {
  success: boolean;
  deactivated: number;
  removed: number;
  tested: number;
  inactive_buoys: InactiveBuoy[];
  error?: string;
}

export class InactiveBuoyCleanup {
  private supabase;
  private noaaSync;

  // Consider a buoy inactive if it fails this many consecutive attempts
  private readonly FAILURE_THRESHOLD = 3;

  // Consider a buoy stale if it hasn't been updated in this many days
  private readonly STALE_DAYS = 7;

  constructor() {
    this.supabase = createSupabaseServiceRoleClient();
    this.noaaSync = new NOAAConditionsSync();
  }

  /**
   * Identify buoys that are inactive and should be cleaned up
   */
  async identifyInactiveBuoys(): Promise<{
    success: boolean;
    inactive_buoys: InactiveBuoy[];
    error?: string;
  }> {
    try {
      console.log("🔍 Identifying inactive buoys...");

      // Get all active buoys with their update history
      const { data: buoys, error } = await this.supabase
        .from("buoys")
        .select(
          `
          buoy_uuid,
          buoy_name,
          kind,
          coordinates,
          updated_at,
          air_temperature,
          water_temperature,
          wave_height,
          wind_speed
        `
        )
        .eq("active", true)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch buoys: ${error.message}`);
      }

      if (!buoys || buoys.length === 0) {
        return {
          success: true,
          inactive_buoys: [],
          error: "No active buoys found",
        };
      }

      console.log(
        `📡 Testing ${buoys.length} active buoys for data availability...`
      );

      const inactiveBuoys: InactiveBuoy[] = [];
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - this.STALE_DAYS);

      // Test each buoy for current data availability
      for (const buoy of buoys) {
        let failureCount = 0;
        let isStale = false;
        let hasAnyData = false;

        // Check if buoy has any recent data
        const lastUpdate = buoy.updated_at ? new Date(buoy.updated_at) : null;
        isStale = !lastUpdate || lastUpdate < staleDate;

        // Check if buoy has any weather data at all
        hasAnyData = !!(
          buoy.air_temperature ||
          buoy.water_temperature ||
          buoy.wave_height ||
          buoy.wind_speed
        );

        // Test current data availability from NOAA
        try {
          const result = await this.noaaSync.updateSingleBuoy(buoy.buoy_uuid);
          if (!result.success) {
            failureCount++;
            console.log(`❌ ${buoy.buoy_uuid}: Failed to fetch current data`);
          } else {
            console.log(`✅ ${buoy.buoy_uuid}: Data available`);
          }
        } catch (error) {
          failureCount++;
          console.log(`❌ ${buoy.buoy_uuid}: Error testing data availability`);
        }

        // Consider buoy inactive if it's stale AND has no data AND fails current test
        if ((isStale && !hasAnyData) || failureCount > 0) {
          inactiveBuoys.push({
            buoy_uuid: buoy.buoy_uuid,
            buoy_name: buoy.buoy_name || "Unknown",
            kind: buoy.kind || "buoy",
            coordinates: buoy.coordinates || "",
            failure_count: failureCount,
            last_successful_update: hasAnyData ? buoy.updated_at || null : null,
            last_attempted_update: new Date().toISOString(),
          });
        }

        // Add delay to avoid overwhelming NOAA servers
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log(
        `🎯 Found ${inactiveBuoys.length} inactive buoys out of ${buoys.length} tested`
      );

      return {
        success: true,
        inactive_buoys: inactiveBuoys,
      };
    } catch (error) {
      console.error("Failed to identify inactive buoys:", error);
      return {
        success: false,
        inactive_buoys: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Deactivate buoys by setting active = false instead of deleting them
   */
  async deactivateInactiveBuoys(buoyIds?: string[]): Promise<{
    success: boolean;
    deactivated: number;
    error?: string;
  }> {
    try {
      let targetBuoys: string[];

      if (buoyIds && buoyIds.length > 0) {
        targetBuoys = buoyIds;
      } else {
        // Identify inactive buoys first
        const result = await this.identifyInactiveBuoys();
        if (!result.success) {
          throw new Error(result.error || "Failed to identify inactive buoys");
        }
        targetBuoys = result.inactive_buoys.map((b) => b.buoy_uuid);
      }

      if (targetBuoys.length === 0) {
        return {
          success: true,
          deactivated: 0,
          error: "No inactive buoys to deactivate",
        };
      }

      console.log(`🔄 Deactivating ${targetBuoys.length} inactive buoys...`);

      // Set active = false and add deactivated_at timestamp
      const { error, count } = await this.supabase
        .from("buoys")
        .update({
          active: false,
          deactivated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("buoy_uuid", targetBuoys);

      if (error) {
        throw new Error(`Failed to deactivate buoys: ${error.message}`);
      }

      console.log(`✅ Successfully deactivated ${count || 0} buoys`);

      return {
        success: true,
        deactivated: count || 0,
      };
    } catch (error) {
      console.error("Failed to deactivate buoys:", error);
      return {
        success: false,
        deactivated: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Completely remove inactive buoys from the database
   */
  async removeInactiveBuoys(buoyIds?: string[]): Promise<{
    success: boolean;
    removed: number;
    error?: string;
  }> {
    try {
      let targetBuoys: string[];

      if (buoyIds && buoyIds.length > 0) {
        targetBuoys = buoyIds;
      } else {
        // Identify inactive buoys first
        const result = await this.identifyInactiveBuoys();
        if (!result.success) {
          throw new Error(result.error || "Failed to identify inactive buoys");
        }
        targetBuoys = result.inactive_buoys.map((b) => b.buoy_uuid);
      }

      if (targetBuoys.length === 0) {
        return {
          success: true,
          removed: 0,
          error: "No inactive buoys to remove",
        };
      }

      console.log(`🗑️  Removing ${targetBuoys.length} inactive buoys...`);

      // Completely delete the buoys
      const { error, count } = await this.supabase
        .from("buoys")
        .delete()
        .in("buoy_uuid", targetBuoys);

      if (error) {
        throw new Error(`Failed to remove buoys: ${error.message}`);
      }

      console.log(`✅ Successfully removed ${count || 0} buoys`);

      return {
        success: true,
        removed: count || 0,
      };
    } catch (error) {
      console.error("Failed to remove buoys:", error);
      return {
        success: false,
        removed: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Comprehensive cleanup - identify and handle inactive buoys
   */
  async cleanupInactiveBuoys(
    options: {
      remove?: boolean; // If true, remove completely; if false, just deactivate
      dryRun?: boolean; // If true, only identify but don't modify
    } = {}
  ): Promise<CleanupResult> {
    try {
      const { remove = false, dryRun = false } = options;

      console.log("🧹 Starting inactive buoy cleanup...");
      console.log(
        `   Mode: ${dryRun ? "DRY RUN" : remove ? "REMOVE" : "DEACTIVATE"}`
      );

      // First, identify inactive buoys
      const identifyResult = await this.identifyInactiveBuoys();

      if (!identifyResult.success) {
        return {
          success: false,
          deactivated: 0,
          removed: 0,
          tested: 0,
          inactive_buoys: [],
          error: identifyResult.error,
        };
      }

      const inactiveBuoys = identifyResult.inactive_buoys;

      if (dryRun || inactiveBuoys.length === 0) {
        return {
          success: true,
          deactivated: 0,
          removed: 0,
          tested: inactiveBuoys.length,
          inactive_buoys: inactiveBuoys,
          error:
            inactiveBuoys.length === 0 ? "No inactive buoys found" : undefined,
        };
      }

      // Perform the cleanup action
      const buoyIds = inactiveBuoys.map((b) => b.buoy_uuid);

      if (remove) {
        const removeResult = await this.removeInactiveBuoys(buoyIds);
        return {
          success: removeResult.success,
          deactivated: 0,
          removed: removeResult.removed,
          tested: inactiveBuoys.length,
          inactive_buoys: inactiveBuoys,
          error: removeResult.error,
        };
      } else {
        const deactivateResult = await this.deactivateInactiveBuoys(buoyIds);
        return {
          success: deactivateResult.success,
          deactivated: deactivateResult.deactivated,
          removed: 0,
          tested: inactiveBuoys.length,
          inactive_buoys: inactiveBuoys,
          error: deactivateResult.error,
        };
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
      return {
        success: false,
        deactivated: 0,
        removed: 0,
        tested: 0,
        inactive_buoys: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
