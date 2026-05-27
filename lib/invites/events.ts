import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InviteAcceptanceFlags } from "@/lib/invites/consume";

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
    const query = (supabase as any)
      .from("profiles")
      .select("allow_implicit_tracking")
      .eq("id", userId);

    const { data, error } =
      typeof query.maybeSingle === "function"
        ? await query.maybeSingle()
        : await query.single();

    if (error) {
      console.error("[invite] failed to check invite telemetry preference:", error);
      return false;
    }

    return data?.allow_implicit_tracking !== false;
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
): Promise<void> {
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
    if (!allowed) return;

    const { error } = await (supabase as any).from("user_events").insert({
      user_id: followerId,
      event_type: "invite_consumed",
      beach_id: null,
      metadata,
    });

    if (error) {
      console.error("[invite] failed to record invite_consumed:", error);
    }
  } catch (error) {
    console.error("[invite] failed to record invite_consumed:", error);
  }
}
