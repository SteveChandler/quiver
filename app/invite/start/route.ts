import { NextRequest, NextResponse } from "next/server";
import {
  buildInviteSignupPath,
  getInviteCookieOptions,
  getInviteInviterId,
  INVITE_COOKIE_NAME,
  INVITE_EXPIRED_REDIRECT_PATH,
} from "@/lib/invites/consume";

/**
 * GET /invite/start?token=...
 *
 * Cookie-writing bridge for guest invite links. Server Components stay
 * read-only; this route verifies the signed invite token, stores it in an
 * HTTP-only cookie, and sends the guest into the auth flow.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const inviterId = await getInviteInviterId(token);

  if (!token || !inviterId) {
    const response = NextResponse.redirect(
      new URL(INVITE_EXPIRED_REDIRECT_PATH, request.url),
    );
    response.cookies.delete(INVITE_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.redirect(
    new URL(buildInviteSignupPath(), request.url),
  );
  response.cookies.set(INVITE_COOKIE_NAME, token, getInviteCookieOptions());
  return response;
}
