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
import { recordInviteConsumedEvent } from "@/lib/invites/events";
import { hashInviteToken } from "@/lib/invites/token-hash";
import { InviteLandingClient } from "./invite-landing-client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface InviteLandingInviter {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildAbsoluteInviteUrl(token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const search = new URLSearchParams({
    utm_source: "qr",
    utm_medium: "invite_qr",
    utm_campaign: "invite_access",
  });
  return `${siteUrl.replace(/\/$/, "")}/invite/${token}?${search.toString()}`;
}

async function fetchInviter(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  inviterId: string,
): Promise<InviteLandingInviter> {
  const fallback = {
    id: inviterId,
    displayName: "A surfer",
    avatarUrl: null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url")
    .eq("id", inviterId)
    .maybeSingle();

  if (error || !data) return fallback;

  return {
    id: data.id,
    displayName: data.display_name || data.full_name || "A surfer",
    avatarUrl: data.avatar_url ?? null,
  };
}

/**
 * /invite/[token]
 *
 * Landing page for an invite link. Branches on sign-in state:
 * - Not signed in → render an app-install invite landing. "Continue on web"
 *   routes through /invite/start so a Route Handler owns the cookie write.
 * - Signed in as the inviter → redirect to community/friends (can't follow self).
 * - Signed in as someone else → idempotently consume the invite and land on
 *   the inviter profile.
 *
 * Server component; intentionally read-only with no cookie mutation.
 */
export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const inviterId = await getInviteInviterId(token);
  if (!inviterId) {
    redirect(INVITE_EXPIRED_REDIRECT_PATH);
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const inviter = await fetchInviter(supabase, inviterId);

    return (
      <InviteLandingClient
        token={token}
        tokenHash={hashInviteToken(token)}
        inviteUrl={buildAbsoluteInviteUrl(token)}
        startPath={buildInviteStartPath(token)}
        inviter={inviter}
        utm={{
          utm_source: firstSearchValue(resolvedSearchParams.utm_source),
          utm_medium: firstSearchValue(resolvedSearchParams.utm_medium),
          utm_campaign: firstSearchValue(resolvedSearchParams.utm_campaign),
        }}
      />
    );
  }

  const result = await consumeInviteForUser(supabase, token, user.id);
  const tokenHash = hashInviteToken(token);

  if (result.status === "accepted") {
    await recordInviteConsumedEvent(supabase, {
      followerId: user.id,
      inviterId: result.inviterId,
      tokenHash,
      surface: "web",
      selfInvite: false,
      flags: result,
    });
    redirect(buildInvitedProfilePath(result.inviterId));
  }

  if (result.status === "self") {
    await recordInviteConsumedEvent(supabase, {
      followerId: user.id,
      inviterId: result.inviterId,
      tokenHash,
      surface: "web",
      selfInvite: true,
    });
    redirect(SELF_INVITE_REDIRECT_PATH);
  }

  if (result.status === "invalid") {
    redirect(INVITE_EXPIRED_REDIRECT_PATH);
  }

  console.error("[invite/[token]] user_follows insert failed:", result.error);
  redirect(INVITE_ERROR_REDIRECT_PATH);
}
