import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const contextSchema = z.object({
  contract_version: z.literal(1), user_id: z.uuid(),
  management_store: z.enum(["APP_STORE", "PLAY_STORE", "STRIPE", "RC_BILLING"]).nullable(),
  cancellation_confirmed: z.boolean(), feedback_submitted: z.boolean(),
  offer: z.object({ program_id: z.literal("cancellation_month"), months: z.literal(1),
    terms_version: z.string().min(1), award_id: z.uuid().nullable() }).nullable(),
});
const submissionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit"), request_id: z.uuid(),
    reason: z.enum(["forecast", "value", "time", "feature", "price", "technical", "other"]),
    note: z.string().trim().max(2000).default("") }).strict(),
  z.object({ action: z.literal("accept"), request_id: z.uuid(),
    terms_version: z.string().min(1).max(80), accept: z.literal(true) }).strict(),
]);

export const GET = withRateLimit(withAuth(async (_request, { user }) => {
  const context = contextSchema.parse(await lifecycleRpc("cancellation_feedback_context", { p_user_id: user.id }));
  if (context.user_id !== user.id) throw new Error("Feedback account mismatch");
  if (process.env.PRO_OFFERS_ENABLED !== "true") context.offer = null;
  return NextResponse.json(context, { headers });
}), { key: "authenticated-default" });

export const POST = withRateLimit(withAuth(async (request, { user }) => {
  const body = submissionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Choose a reason and keep your note under 2,000 characters." }, { status: 400, headers });
  const input = body.data;
  if (input.action === "accept" && process.env.PRO_OFFERS_ENABLED !== "true") {
    return NextResponse.json({ error: "This gift is not available right now." }, { status: 503, headers });
  }
  try {
    if (input.action === "submit") {
      const submissionId = z.uuid().parse(await lifecycleRpc("submit_cancellation_feedback", {
        p_user_id: user.id, p_request_id: input.request_id, p_reason: input.reason, p_note: input.note,
      }));
      return NextResponse.json({ contract_version: 1, submission_id: submissionId }, { headers });
    }
    const awardId = z.uuid().parse(await lifecycleRpc("accept_cancellation_gift", {
      p_user_id: user.id, p_request_id: input.request_id, p_terms_version: input.terms_version,
      p_code_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
    }));
    return NextResponse.json({ contract_version: 1, award_id: awardId }, { headers });
  } catch {
    // Notes are private support data; never send the request or database error to telemetry.
    return NextResponse.json({ error: "We could not confirm this request. You can still continue to subscription settings." }, { status: 409, headers });
  }
}), { key: "authenticated-default" });
