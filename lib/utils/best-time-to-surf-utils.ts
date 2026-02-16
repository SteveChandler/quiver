import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getBestTimeToSurfUrl = cache(async function getBestTimeToSurfUrl(
  citySlug: string,
  cityName: string,
  state: string
): Promise<string | undefined> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("beaches")
    .select("id", { count: "exact", head: true })
    .eq("city", cityName)
    .eq("state", state)
    .not("best_months", "is", null)
    .or("is_private.is.null,is_private.eq.false");

  if (error) {
    console.warn("[getBestTimeToSurfUrl] Query failed:", error.message);
    return undefined;
  }

  return (count ?? 0) >= 3 ? `/best-time-to-surf/${citySlug}` : undefined;
});
