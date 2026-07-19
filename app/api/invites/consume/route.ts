import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  consumeInviteForUser,
} from "@/lib/invites/consume";
import { recordInviteConsumedEvent } from "@/lib/invites/events";
import { hashInviteToken } from "@/lib/invites/token-hash";
import { capturePostHogEvent } from "@/lib/posthog-server";

/**
 * POST /api/invites/consume
 *
 * Native JSON endpoint: verify an invite token, create the follower→inviter
 * crew edge, and record referral attribution through the shared invite RPC.
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

    const result = await consumeInviteForUser(supabase, rawToken, user.id);
    const tokenHash = hashInviteToken(rawToken);

    if (result.status === "invalid") {
      return createErrorResponse("Invalid or expired invite", 400);
    }

    if (result.status === "self") {
      await recordInviteConsumedEvent(supabase, {
        followerId: user.id,
        inviterId: result.inviterId,
        tokenHash,
        surface: "native",
        selfInvite: true,
      });

      // Self-invite: no row write, but not an error — native surface can
      // quietly navigate home.
      return createSuccessResponse({
        success: true,
        inviter_id: result.inviterId,
        self_invite: true,
      });
    }

    if (result.status === "insert_error") {
      throw result.error;
    }

    const telemetryAllowed = await recordInviteConsumedEvent(supabase, {
      followerId: user.id,
      inviterId: result.inviterId,
      tokenHash,
      surface: "native",
      selfInvite: false,
      flags: result,
    });

    if (telemetryAllowed) {
      await capturePostHogEvent({
        distinctId: user.id,
        event: "invite_consumed",
        properties: {
          inviter_id: result.inviterId,
          duplicate: result.followExisting,
          follow_created: result.followCreated,
          referral_created: result.referralCreated,
          referral_existing: result.referralExisting,
        },
      });
    }

    return createSuccessResponse({
      success: true,
      inviter_id: result.inviterId,
    });
  },
  { errorMessage: "Failed to consume invite" },
);

export function GET() {
  return methodNotAllowed(["POST"]);
}
