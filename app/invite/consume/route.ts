import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildInvitedProfilePath,
  consumeInviteForUser,
  INVITE_CONSUME_PATH,
  INVITE_COOKIE_NAME,
  INVITE_ERROR_REDIRECT_PATH,
  INVITE_EXPIRED_REDIRECT_PATH,
  SELF_INVITE_REDIRECT_PATH,
} from "@/lib/invites/consume";

/**
 * GET /invite/consume
 *
 * Web-side redirect handler: reads the `invite_token` cookie (set by
 * /invite/start), verifies it, and writes the `user_follows` row via the session
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
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirectTo", INVITE_CONSUME_PATH);
    return NextResponse.redirect(signInUrl);
  }

  const cookieToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  if (!cookieToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const result = await consumeInviteForUser(supabase, cookieToken, user.id);
  let redirectTarget = "/";

  if (result.status === "accepted") {
    redirectTarget = buildInvitedProfilePath(result.inviterId);
  } else if (result.status === "self") {
    redirectTarget = SELF_INVITE_REDIRECT_PATH;
  } else if (result.status === "invalid") {
    redirectTarget = INVITE_EXPIRED_REDIRECT_PATH;
  } else {
    console.error("[invite/consume] invite acceptance failed:", result.error);
    redirectTarget = INVITE_ERROR_REDIRECT_PATH;
  }

  const response = NextResponse.redirect(new URL(redirectTarget, request.url));
  response.cookies.delete(INVITE_COOKIE_NAME);
  return response;
}
