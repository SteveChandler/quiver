import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  verifyEmailToken,
  getEmailTokenSecret,
} from "@/lib/utils/email-token";

/**
 * POST /api/invites/consume
 *
 * Native JSON endpoint: verify an invite token and insert the
 * follower→inviter `user_follows` row. Idempotent — duplicate rows are
 * rejected by the unique constraint and silently treated as success.
 *
 * Body: `{ token: string }`
 * Returns: `{ success: true, inviter_id }`
 */
export const POST = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    let body: { token?: unknown } = {};
    try {
      body = (await request.json()) as { token?: unknown };
    } catch {
      return createErrorResponse("Invalid JSON body", 400);
    }

    const rawToken = body.token;
    if (typeof rawToken !== "string" || rawToken.length === 0) {
      return createErrorResponse("Missing token", 400);
    }

    const payload = await verifyEmailToken(rawToken, getEmailTokenSecret());
    if (!payload || payload.purpose !== "invite") {
      return createErrorResponse("Invalid or expired invite", 400);
    }

    const inviterId = payload.user_id;
    if (inviterId === user.id) {
      // Self-invite: no row write, but not an error — native surface can
      // quietly navigate home.
      return createSuccessResponse({
        success: true,
        inviter_id: inviterId,
        self_invite: true,
      });
    }

    const { error: insertError } = await supabase
      .from("user_follows")
      .insert({ follower_id: user.id, following_id: inviterId });

    // 23505 is the unique-constraint violation — row already exists.
    // Treat as success so double-taps don't surface errors to the user.
    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }

    return createSuccessResponse({
      success: true,
      inviter_id: inviterId,
    });
  },
  { errorMessage: "Failed to consume invite" },
);

export function GET() {
  return methodNotAllowed(["POST"]);
}
