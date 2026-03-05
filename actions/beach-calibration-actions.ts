"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import type { BeachRecommendationCalibration } from "@/types/database";

/**
 * Get the most recent calibration window for a beach.
 */
export async function getLatestBeachCalibrationAction(beachId: string) {
  return withDatabaseOperation<BeachRecommendationCalibration | null>(
    async (supabase) => {
      const { data, error } = await supabase
        .from("beach_recommendation_calibration")
        .select("*")
        .eq("beach_id", beachId)
        .order("window_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      return { data: data ?? null, error };
    },
    { allowNull: true }
  );
}
