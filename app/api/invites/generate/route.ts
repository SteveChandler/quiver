import type { NextRequest } from "next/server";
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  signEmailToken,
  getEmailTokenSecret,
} from "@/lib/utils/email-token";
import { capturePostHogEvent } from "@/lib/posthog-server";
import { hashInviteToken } from "@/lib/invites/token-hash";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";

/**
 * POST /api/invites/generate
 *
 * Generate a signed, stateless invite JWT for the authenticated user. The
 * token embeds the inviter's `user_id` + `purpose: 'invite'` and expires in
 * 7 days. Returns the token and a fully-qualified invite URL for sharing.
 *
 * Used by both web and native callers via Bearer-aware `withAuth`. Wrapped in
 * `withRateLimit` so a compromised account can't mint unlimited invite tokens.
 */
const generateHandler = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const token = await signEmailToken(
      { user_id: user.id, purpose: "invite" },
      getEmailTokenSecret(),
    );

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const url = `${siteUrl.replace(/\/$/, "")}/invite/${token}`;
    const token_hash = hashInviteToken(token);

    const telemetryAllowed = await getOwnAnalyticsTrackingAllowed(
      supabase,
      user.id,
    ).catch(() => false);
    if (telemetryAllowed) {
      await capturePostHogEvent({
        distinctId: user.id,
        event: "invite_link_generated",
      });
    }

    return createSuccessResponse({ token, url, token_hash });
  },
  { errorMessage: "Failed to generate invite" },
);

export const POST = withRateLimit(generateHandler, "authenticated-default");

export function GET() {
  return methodNotAllowed(["POST"]);
}
