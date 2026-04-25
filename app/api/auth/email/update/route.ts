import { NextRequest } from "next/server";
import {
  withAuth,
  withRateLimit,
  createSuccessResponse,
  createValidationError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * POST /api/auth/email/update
 *
 * Initiates an email-change flow for the authenticated user. Supabase sends
 * confirmation links to both current and new addresses.
 *
 * Authentication is REQUIRED (cookie or Bearer). Composition order matters:
 * `withRateLimit(withAuth(handler))` — the outer rate-limit guards the
 * inner auth-gated handler, matching the pattern used by other protected
 * mutation routes.
 */
const emailUpdateHandler = withAuth(
  async (request: NextRequest, { supabase }: AuthenticatedContext) => {
    const { newEmail } = await request.json().catch(() => ({}));
    if (!newEmail || typeof newEmail !== "string") {
      return createValidationError("newEmail is required");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (updateError) throw updateError;

    return createSuccessResponse({
      message:
        "Email update process initiated. Please check your current and new email for confirmation links.",
    });
  },
  { errorMessage: "Failed to update email" }
);

export const POST = withRateLimit(emailUpdateHandler, "authenticated-default");
