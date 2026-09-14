import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { refreshLifecycleUserEligibility } from "@/lib/subscription/offer-automation";
import { feedbackSubmissionSchema } from "@/lib/trial-feedback/contract";
import { parseFeedbackContext, readFeedbackContext } from "@/lib/trial-feedback/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function disabled(): NextResponse { return NextResponse.json({ error: "Feedback is not available right now." }, { status: 503, headers }); }

export const GET = withRateLimit(withAuth(async (_request, { user }) => {
  if (process.env.TRIAL_FEEDBACK_ENABLED !== "true") return disabled();
  await refreshLifecycleUserEligibility(user.id);
  return NextResponse.json(await readFeedbackContext(user.id), { headers });
}), { key: "authenticated-default" });

export const POST = withRateLimit(withAuth(async (request, { user }) => {
  if (process.env.TRIAL_FEEDBACK_ENABLED !== "true") return disabled();
  const body = feedbackSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Choose a reason and keep your note under 2,000 characters." }, { status: 400, headers });
  await refreshLifecycleUserEligibility(user.id);
  try {
    const result = await lifecycleRpc("submit_trial_feedback", { p_user_id: user.id, p_request_id: body.data.request_id,
      p_reason: body.data.reason, p_note: body.data.note, p_message_id: body.data.message_instance_id ?? null });
    return NextResponse.json(parseFeedbackContext(result, user.id), { headers });
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "trial-feedback" } });
    return NextResponse.json({ error: "We could not confirm your feedback. Refresh to check whether it was saved." }, { status: 409, headers });
  }
}), { key: "authenticated-default" });
