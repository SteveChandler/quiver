import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CreateInviteActivityInput {
  actorId: string; // inviter user id
  recipientId: string; // invitee user id
  sessionId: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a user_activities row using RPC create_activity.
 * Returns the created activity id.
 */
export async function createActivityForInvite(
  input: CreateInviteActivityInput
) {
  const supabase = await createSupabaseServerClient();

  // create_activity inserts with the current auth uid; we want the actorId as the user_id.
  // To ensure correct attribution, we call RPC as the inviter if they are the current user.
  const { data: activityId, error } = await supabase.rpc("create_activity", {
    p_user_id: input.actorId,
    p_activity_type: "session_invite.created",
    p_entity_type: "session",
    p_entity_id: input.sessionId,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  return activityId as string;
}

