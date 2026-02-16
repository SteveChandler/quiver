"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { YesterdayAccuracy } from "@/types/accuracy";

export async function getYesterdayAccuracy(
  beachId: string
): Promise<YesterdayAccuracy | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("get_yesterday_accuracy", {
    p_beach_id: beachId,
  });

  if (error) {
    console.error("Accuracy fetch error:", error);
    return null;
  }

  return data?.[0] ?? null;
}
