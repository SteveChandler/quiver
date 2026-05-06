import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildInviteStartPath,
  buildInvitedProfilePath,
  consumeInviteForUser,
  getInviteInviterId,
  INVITE_ERROR_REDIRECT_PATH,
  INVITE_EXPIRED_REDIRECT_PATH,
  SELF_INVITE_REDIRECT_PATH,
} from "@/lib/invites/consume";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * /invite/[token]
 *
 * Landing page for an invite link. Branches on sign-in state:
 * - Not signed in → redirect through /invite/start so a Route Handler owns
 *   the `invite_token` cookie write.
 * - Signed in as the inviter → redirect to community/friends (can't follow self).
 * - Signed in as someone else → idempotently consume the invite and land on
 *   the inviter profile.
 *
 * Server component; intentionally read-only with no cookie mutation.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const inviterId = await getInviteInviterId(token);
  if (!inviterId) {
    redirect(INVITE_EXPIRED_REDIRECT_PATH);
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildInviteStartPath(token));
  }

  const result = await consumeInviteForUser(supabase, token, user.id);

  if (result.status === "accepted") {
    redirect(buildInvitedProfilePath(result.inviterId));
  }

  if (result.status === "self") {
    redirect(SELF_INVITE_REDIRECT_PATH);
  }

  if (result.status === "invalid") {
    redirect(INVITE_EXPIRED_REDIRECT_PATH);
  }

  console.error("[invite/[token]] user_follows insert failed:", result.error);
  redirect(INVITE_ERROR_REDIRECT_PATH);
}
