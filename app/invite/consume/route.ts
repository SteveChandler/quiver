import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  verifyEmailToken,
  getEmailTokenSecret,
} from "@/lib/utils/email-token";

/**
 * GET /invite/consume
 *
 * Web-side redirect handler: reads the `invite_token` cookie (set at sign-up
 * time), verifies it, and writes the `user_follows` row via the session
 * Supabase client. Clears the cookie and redirects to the inviter's profile
 * with `?invited=1`.
 *
 * Intentionally cookie-scoped (not Bearer) because this is a web browser
 * redirect target. Native clients use POST /api/invites/consume instead.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const cookieToken = request.cookies.get("invite_token")?.value;
  if (!cookieToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const payload = await verifyEmailToken(cookieToken, getEmailTokenSecret());

  // Build redirect target based on verification outcome.
  let redirectTarget = "/";
  if (payload && payload.purpose === "invite") {
    const inviterId = payload.user_id;
    if (inviterId !== user.id) {
      const { error: insertError } = await supabase
        .from("user_follows")
        .insert({ follower_id: user.id, following_id: inviterId });

      // 23505 = unique violation (row already exists). Idempotent — treat
      // as success.
      if (insertError && insertError.code !== "23505") {
        console.error(
          "[invite/consume] user_follows insert failed:",
          insertError,
        );
      }

      redirectTarget = `/profile/${inviterId}?invited=1`;
    }
  } else {
    redirectTarget = "/?invite_expired=1";
  }

  const response = NextResponse.redirect(new URL(redirectTarget, request.url));
  response.cookies.delete("invite_token");
  return response;
}
