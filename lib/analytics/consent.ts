import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AnalyticsConsentClient = Pick<SupabaseClient<Database>, "rpc">;
type AnalyticsConsentUpdate = Pick<
  Database["public"]["Tables"]["profiles"]["Update"],
  "allow_implicit_tracking"
>;

export function buildAnalyticsConsentProfileUpdate(
  consentLoaded: boolean,
  allowed: boolean,
): AnalyticsConsentUpdate | Record<string, never> {
  return consentLoaded ? { allow_implicit_tracking: allowed } : {};
}

/** Reads analytics consent through the owner-only database boundary. */
export async function getOwnAnalyticsTrackingAllowed(
  supabase: AnalyticsConsentClient,
  expectedUserId: string,
): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)(
    "get_my_analytics_tracking_allowed",
    { p_expected_user_id: expectedUserId },
  );

  if (error) throw error;
  return data === true;
}
