import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export interface TrustedForecastServingProjectionRow {
  readonly beach_id: string;
  readonly forecast_at: string;
  readonly display_wave_height: string;
  readonly baseline_max_face_ft: number;
  readonly refreshed_at: string;
}

export interface TrustedForecastServingProjectionStore {
  upsertRows(rows: readonly TrustedForecastServingProjectionRow[]): Promise<{
    readonly error: { readonly code?: string } | null;
  }>;
}

type TrustedForecastSupabaseClient = SupabaseClient<Database>;

export function createTrustedForecastServingProjectionStore(
  createClient: () => TrustedForecastSupabaseClient,
): TrustedForecastServingProjectionStore {
  return {
    async upsertRows(rows) {
      const { error } = await createClient()
        .from("trusted_forecast_serving_projections" as never)
        .upsert(rows as never, { onConflict: "beach_id,forecast_at" });
      return { error };
    },
  };
}
