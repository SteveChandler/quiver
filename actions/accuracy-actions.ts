"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { YesterdayAccuracy } from "@/types/accuracy";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getYesterdayAccuracy(
  beachId: string
): Promise<YesterdayAccuracy | null> {
  if (!UUID_RE.test(beachId)) return null;

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
