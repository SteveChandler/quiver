import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { ownedOffersSchema } from "@/lib/subscription/offer-contract";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export const GET = withRateLimit(withAuth(async (_request, { user }) => {
  if (process.env.PRO_OFFERS_ENABLED !== "true") return NextResponse.json({ contract_version: 1, user_id: user.id, offers: [], enrollment: null }, { headers });
  return NextResponse.json(ownedOffersSchema.parse(await lifecycleRpc("list_owned_pro_offers", { p_user_id: user.id })), { headers });
}), { key: "authenticated-default" });
export const POST = withRateLimit(withAuth(async (request, { user }) => {
  if (process.env.PRO_OFFERS_ENABLED !== "true") return NextResponse.json({ status: "disabled", contract_version: 1 }, { status: 503, headers });
  const body = z.object({ terms_version: z.string().min(1).max(80), accept: z.literal(true) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Accept the displayed reward terms" }, { status: 400, headers });
  try {
    await lifecycleRpc("enroll_self_service_pro_offer", { p_user_id: user.id, p_terms_version: body.data.terms_version });
    return NextResponse.json(ownedOffersSchema.parse(await lifecycleRpc("list_owned_pro_offers", { p_user_id: user.id })), { headers });
  } catch {
    return NextResponse.json({ error: "Enrollment is unavailable. Refresh to check your account before retrying." }, { status: 409, headers });
  }
}), { key: "authenticated-default" });
