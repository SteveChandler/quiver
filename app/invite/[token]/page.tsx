import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  verifyEmailToken,
  getEmailTokenSecret,
} from "@/lib/utils/email-token";
import { FollowButton } from "./follow-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * /invite/[token]
 *
 * Landing page for an invite link. Branches on sign-in state:
 * - Not signed in → set `invite_token` cookie, redirect to sign-up.
 * - Signed in as the inviter → redirect to community/friends (can't follow self).
 * - Signed in as someone else → render "Follow {name}?" card that POSTs to
 *   the follow-toggle endpoint.
 *
 * Server component; renders no client JS for the redirect paths.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const payload = await verifyEmailToken(token, getEmailTokenSecret());
  if (!payload || payload.purpose !== "invite") {
    redirect("/?invite_expired=1");
  }

  const inviterId = payload.user_id;

  const supabase = await createSupabaseServerClient();

  // Look up inviter profile (public fields only — RLS-safe).
  const { data: inviter } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", inviterId)
    .maybeSingle();

  if (!inviter) {
    redirect("/?invite_expired=1");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not signed in. Set the cookie so /auth/callback (email confirmation)
    // and /invite/consume (web post-signup redirect) can pick it up.
    const cookieStore = await cookies();
    cookieStore.set("invite_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    redirect(
      `/auth/sign-up?invite_token=${encodeURIComponent(token)}&redirectTo=${encodeURIComponent("/invite/consume")}`,
    );
  }

  if (user.id === inviterId) {
    // Can't follow yourself — quietly land on the community tab.
    redirect("/community?tab=friends");
  }

  // Signed in as a different user — render the follow card.
  const displayName = inviter.full_name || "a surfer";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-card border rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col items-center text-center">
          {inviter.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inviter.avatar_url}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-muted mb-4 flex items-center justify-center text-2xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold mb-2">
            {displayName} invited you to Quiver
          </h1>
          <p className="text-muted-foreground mb-6">
            Follow them to see their sessions and track surf together.
          </p>
          <FollowButton inviterId={inviterId} displayName={displayName} />
          <Link
            href="/"
            className="mt-4 text-sm text-muted-foreground hover:underline"
          >
            Not now
          </Link>
        </div>
      </div>
    </div>
  );
}
