import { NextRequest } from "next/server";
import { withAuth, withRateLimit, createSuccessResponse, createErrorResponse } from "@/lib/middleware/api-wrappers";
import { lifecycleEnabled, lifecycleRpc } from "@/lib/email/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preserve the installed native POST contract; only enqueue the shared decision.
export const POST = withRateLimit(withAuth(async (_request: NextRequest, { user }) => {
  if (!lifecycleEnabled()) return createSuccessResponse({ sent: false, reason: "lifecycle_disabled" });
  try {
    await lifecycleRpc("record_email_lifecycle_decision", { p_user_id: user.id });
    return createSuccessResponse({ sent: false, queued: true });
  } catch {
    return createErrorResponse("Service Error", "Unable to record email eligibility", 503);
  }
}), "authenticated-default");
