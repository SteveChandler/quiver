import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { offerHttpStatus } from "@/lib/subscription/offer-contract";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { fulfillProOffer } from "@/lib/subscription/offer-fulfillment";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export const POST = withRateLimit(withAuth(async (request, { user }) => {
  const body = z.object({ offerToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(), awardId: z.uuid().optional(), messageInstanceId: z.uuid().optional(), mode: z.enum(["preview", "claim"]).default("preview") }).strict().refine(body => Boolean(body.offerToken) !== Boolean(body.awardId)).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid offer code" }, { status: 400, headers });
  try {
    if (process.env.PRO_OFFERS_ENABLED === "true" && body.data.mode === "claim" && body.data.awardId && body.data.messageInstanceId) {
      await lifecycleRpc("attribute_pro_offer_claim", { p_user_id: user.id, p_award_id: body.data.awardId, p_message_instance_id: body.data.messageInstanceId });
    }
    const result = await fulfillProOffer(user.id, body.data.offerToken ?? body.data.awardId!, fetch, body.data.mode === "preview");
    return NextResponse.json({ ...result, contract_version: 1 }, { status: offerHttpStatus(result), headers });
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "pro-offer-claim" } });
    return NextResponse.json({ error: "Offer fulfillment is unavailable. Your reward has not been discarded." }, { status: 503, headers });
  }
}, { errorMessage: "Offer claim failed" }), { key: "authenticated-default" });
