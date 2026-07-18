import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InviteAcceptanceFlags } from "@/lib/invites/consume";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";

type InviteConsumeSurface = "web" | "native";

interface RecordInviteConsumedEventInput {
  followerId: string;
  inviterId: string;
  tokenHash: string;
  surface: InviteConsumeSurface;
  selfInvite: boolean;
  flags?: Partial<InviteAcceptanceFlags>;
}

async function isInviteProductTelemetryAllowed(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  try {
    return await getOwnAnalyticsTrackingAllowed(supabase, userId);
  } catch (error) {
    console.error("[invite] failed to check invite telemetry preference:", error);
    return false;
  }
}

export async function recordInviteConsumedEvent(
  supabase: SupabaseClient<Database>,
  {
    followerId,
    inviterId,
    tokenHash,
    surface,
    selfInvite,
    flags,
  }: RecordInviteConsumedEventInput,
): Promise<boolean> {
  const metadata = {
    token_hash: tokenHash,
    inviter_id: inviterId,
    surface,
    follow_created: flags?.followCreated === true,
    follow_existing: flags?.followExisting === true,
    referral_created: flags?.referralCreated === true,
    referral_existing: flags?.referralExisting === true,
    self_invite: selfInvite,
  };

  try {
    const allowed = await isInviteProductTelemetryAllowed(supabase, followerId);
    if (!allowed) return false;

    const { error } = await (supabase as any).from("user_events").insert({
      user_id: followerId,
      event_type: "invite_consumed",
      beach_id: null,
      metadata,
    });

    if (error) {
      console.error("[invite] failed to record invite_consumed:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[invite] failed to record invite_consumed:", error);
    return false;
  }
}
