import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchLatestNDBCObservation } from "@/lib/services/ndbc-service";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/update-buoy-conditions
 *
 * Cron job: fetches latest NDBC observations for all active buoys
 * and updates the buoys table with current conditions.
 *
 * Runs hourly to keep buoy data fresh.
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get all active buoys
    const { data: buoys, error: fetchError } = await supabase
      .from("buoys")
      .select("buoy_uuid, buoy_name")
      .eq("active", true);

    if (fetchError) {
      console.error("Failed to fetch buoys:", fetchError);
      return createErrorResponse("Database error", fetchError.message, 500);
    }

    if (!buoys || buoys.length === 0) {
      return createSuccessResponse(
        await withCronOutcome(
          {
            job: "/api/cron/update-buoy-conditions",
            unit: "buoy_conditions_updated",
            expectedMin: 1,
            getProduced: (value) => value.summary.updated,
            legitimatelyZero: () => ({ reason: "No active buoys were available to update" }),
          },
          async () => ({
            summary: { total: 0, updated: 0, failed: 0 },
            message: "No active buoys to update",
          }),
        ),
      );
    }

    console.log(`Updating conditions for ${buoys.length} buoys...`);

    let updated = 0;
    let failed = 0;

    // Process buoys in batches to avoid overwhelming NDBC
    const batchSize = 20;
    for (let i = 0; i < buoys.length; i += batchSize) {
      const batch = buoys.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (buoy) => {
          try {
            const observation = await fetchLatestNDBCObservation(buoy.buoy_uuid);

            if (!observation) {
              // Buoy may not have real-time data - this is normal
              return { buoy_uuid: buoy.buoy_uuid, status: "no_data" };
            }

            // Update buoy with latest conditions
            const { error: updateError } = await supabase
              .from("buoys")
              .update({
                wave_height: observation.wave_height_m
                  ? observation.wave_height_m * 3.28084 // Convert meters to feet
                  : null,
                wave_period: observation.wave_period_s,
                wind_speed: observation.wind_speed_ms
                  ? observation.wind_speed_ms * 1.94384 // Convert m/s to knots
                  : null,
                wind_direction: observation.wind_direction_deg,
                updated_at: new Date().toISOString(),
              })
              .eq("buoy_uuid", buoy.buoy_uuid);

            if (updateError) {
              console.error(
                `Failed to update buoy ${buoy.buoy_uuid}:`,
                updateError
              );
              return { buoy_uuid: buoy.buoy_uuid, status: "error", error: updateError };
            }

            return { buoy_uuid: buoy.buoy_uuid, status: "updated" };
          } catch (err) {
            console.error(`Error processing buoy ${buoy.buoy_uuid}:`, err);
            return { buoy_uuid: buoy.buoy_uuid, status: "error", error: err };
          }
        })
      );

      // Count results
      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value.status === "updated") {
            updated++;
          } else if (result.value.status === "error") {
            failed++;
          }
          // "no_data" is normal and not counted as failure
        } else {
          failed++;
        }
      }

      // Small delay between batches to be nice to NDBC
      if (i + batchSize < buoys.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const summary = {
      total: buoys.length,
      updated,
      failed,
      noData: buoys.length - updated - failed,
    };

    console.log("Buoy conditions update complete:", summary);

    return createSuccessResponse(
      await withCronOutcome(
        {
          job: "/api/cron/update-buoy-conditions",
          unit: "buoy_conditions_updated",
          expectedMin: 1,
          getProduced: (value) => value.summary.updated,
          legitimatelyZero: (value) =>
            value.summary.noData === value.summary.total
              ? { reason: "Active buoys returned no current observations" }
              : undefined,
        },
        async () => ({
          summary,
          message: `Updated ${updated} of ${buoys.length} buoys`,
        }),
      ),
    );
  } catch (error) {
    console.error("Buoy conditions cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/update-buoy-conditions", _GET);
