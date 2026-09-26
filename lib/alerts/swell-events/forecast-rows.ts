import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

import type { SwellEventForecastRow } from "./detector";
import { readAllPages } from "./paging";

const SWELL_FORECAST_COLUMNS = [
  "beach_id",
  "forecast_at",
  "swell_1_height",
  "swell_1_period",
  "swell_1_direction",
  "swell_2_height",
  "swell_2_period",
  "swell_2_direction",
].join(",");

/** Only the swell columns detection reads, grouped by beach. */
export async function loadSwellForecastRows(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, SwellEventForecastRow[]>> {
  const byBeach = new Map<string, SwellEventForecastRow[]>();
  if (beachIds.length === 0) return byBeach;
  const rows = await readAllPages(async (offset, limit) => {
    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select(SWELL_FORECAST_COLUMNS)
      .in("beach_id", beachIds)
      .gte("forecast_at", from.toISOString())
      .lt("forecast_at", to.toISOString())
      .order("beach_id", { ascending: true })
      .order("forecast_at", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to load swell forecast rows: ${error.message}`);
    return (data ?? []) as unknown as Array<SwellEventForecastRow & { beach_id: string }>;
  });
  for (const row of rows) {
    const list = byBeach.get(row.beach_id) ?? [];
    list.push(row);
    byBeach.set(row.beach_id, list);
  }
  return byBeach;
}
