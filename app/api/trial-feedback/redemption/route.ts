import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { refreshLifecycleUserEligibility } from "@/lib/subscription/offer-automation";
import { parseFeedbackContext, readFeedbackContext } from "@/lib/trial-feedback/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reserve"), request_id: z.uuid(), terms_version: z.string().min(1).max(80), accept: z.literal(true) }).strict(),
  z.object({ action: z.literal("reconcile") }).strict(),
  z.object({ action: z.literal("handoff"), reservation_id: z.uuid() }).strict(),
]);
export const POST = withRateLimit(withAuth(async (request, { user }) => {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid offer request." }, { status: 400, headers });
  // Existing store receipts must remain reconcilable even while new redemption is paused.
  if (body.data.action === "reconcile") {
    return NextResponse.json(parseFeedbackContext(await lifecycleRpc("reconcile_trial_feedback", { p_user_id: user.id }), user.id), { headers });
  }
  if (process.env.TRIAL_FEEDBACK_ENABLED !== "true" || process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED !== "true" || process.env.TRIAL_FEEDBACK_WORKER_ENABLED !== "true") {
    return NextResponse.json({ error: "Offer redemption is not available right now." }, { status: 503, headers });
  }
  await refreshLifecycleUserEligibility(user.id);
  const context = await readFeedbackContext(user.id);
  if (!context.offer) return NextResponse.json({ error: "This offer is not available for redemption." }, { status: 409, headers });
  if (body.data.action === "handoff") {
    const started = z.boolean().parse(await lifecycleRpc("begin_trial_feedback_handoff", { p_user_id: user.id, p_reservation_id: body.data.reservation_id }));
    return NextResponse.json({ started }, { status: started ? 200 : 409, headers });
  }
  try {
    const value = z.object({ reservation_id: z.uuid() }).passthrough().parse(await lifecycleRpc("reserve_trial_feedback_offer", {
      p_user_id: user.id, p_request_id: body.data.request_id, p_terms_version: body.data.terms_version,
    }));
    return NextResponse.json({ ...parseFeedbackContext(value, user.id), reservation_id: value.reservation_id }, { headers });
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "trial-feedback" } });
    return NextResponse.json({ error: "Your offer could not be reserved. Refresh its saved status before trying again." }, { status: 409, headers });
  }
}), { key: "authenticated-default" });
