import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export interface SwellEventForecastRecord {
  eventKey: string;
  beachId: string;
  source: "alert" | "snapshot";
  detectorVersion: string;
  issuedAt: string;
  arrivalAt: string | null;
  peakAt: string;
  fadeAt: string | null;
  peakOffshoreHeightFt: number | null;
  peakFaceHeightFt: number | null;
  peakPeriodS: number | null;
  directionDeg: number | null;
}

// swell_event_verifications is newer than types/database.generated.ts.
interface SwellEventVerificationInsert {
  event_key: string;
  beach_id: string;
  source: "alert" | "snapshot";
  detector_version: string;
  forecast_issued_at: string;
  forecast_arrival_at: string | null;
  forecast_peak_at: string;
  forecast_fade_at: string | null;
  forecast_peak_offshore_height_ft: number | null;
  forecast_peak_face_height_ft: number | null;
  forecast_peak_period_s: number | null;
  forecast_direction_deg: number | null;
}

/** First forecast per (event, beach, source) wins; later calls are no-ops. */
export async function recordSwellEventForecast(
  supabase: SupabaseClient<Database>,
  record: SwellEventForecastRecord,
): Promise<{ inserted: boolean }> {
  const row: SwellEventVerificationInsert = {
    event_key: record.eventKey,
    beach_id: record.beachId,
    source: record.source,
    detector_version: record.detectorVersion,
    forecast_issued_at: record.issuedAt,
    forecast_arrival_at: record.arrivalAt,
    forecast_peak_at: record.peakAt,
    forecast_fade_at: record.fadeAt,
    forecast_peak_offshore_height_ft: record.peakOffshoreHeightFt,
    forecast_peak_face_height_ft: record.peakFaceHeightFt,
    forecast_peak_period_s: record.peakPeriodS,
    forecast_direction_deg: record.directionDeg,
  };
  const { data, error } = await supabase
    .from("swell_event_verifications" as never)
    .upsert(row as never, {
      onConflict: "event_key,beach_id,source",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    throw new Error(`Failed to record swell event forecast: ${error.message}`);
  }
  return { inserted: ((data ?? []) as unknown[]).length > 0 };
}
