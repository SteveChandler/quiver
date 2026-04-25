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
  async (_request: NextRequest, { user }: AuthenticatedContext) => {
    const token = await signEmailToken(
      { user_id: user.id, purpose: "invite" },
      getEmailTokenSecret(),
    );

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const url = `${siteUrl.replace(/\/$/, "")}/invite/${token}`;

    return createSuccessResponse({ token, url });
  },
  { errorMessage: "Failed to generate invite" },
);

export const POST = withRateLimit(generateHandler, "authenticated-default");

export function GET() {
  return methodNotAllowed(["POST"]);
}
