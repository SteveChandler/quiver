import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStateSurfProfile } from "@/lib/data/monthly-surf-data";

export const getBestTimeToSurfUrl = cache(async function getBestTimeToSurfUrl(
  citySlug: string,
  cityName: string,
  state: string
): Promise<string | undefined> {
  const supabase = await createSupabaseServerClient();

  const { count: bestMonthsCount, error: bestMonthsError } = await supabase
    .from("beaches")
    .select("id", { count: "exact", head: true })
    .eq("city", cityName)
    .eq("state", state)
    .not("best_months", "is", null)
    .or("is_private.is.null,is_private.eq.false");

  if (bestMonthsError) {
    console.warn("[getBestTimeToSurfUrl] Query failed:", bestMonthsError.message);
    return undefined;
  }

  if ((bestMonthsCount ?? 0) >= 3) {
    return `/best-time-to-surf/${citySlug}`;
  }

  if (!getStateSurfProfile(state.toLowerCase())) {
    return undefined;
  }

  const { count: cityBeachCount, error: cityBeachError } = await supabase
    .from("beaches")
    .select("id", { count: "exact", head: true })
    .eq("city", cityName)
    .eq("state", state)
    .or("is_private.is.null,is_private.eq.false");

  if (cityBeachError) {
    console.warn("[getBestTimeToSurfUrl] Query failed:", cityBeachError.message);
    return undefined;
  }

  return (cityBeachCount ?? 0) > 0
    ? `/best-time-to-surf/${citySlug}`
    : undefined;
});
