import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export const POST = withAdminAuth(async (request, { user }) => {
  const parsed = z.object({ userId: z.uuid(), program: z.enum(["five_sessions_month", "return_three_months"]),
    reference: z.string().trim().min(1).max(200), termsVersion: z.string().trim().min(1).max(80),
    mode: z.enum(["preview", "issue"]).default("preview"),
  }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid offer request" }, { status: 400, headers });
  const input = parsed.data;
  if (input.mode === "preview") return NextResponse.json({ status: "preview", program: input.program,
    months: input.program === "five_sessions_month" ? 1 : 3, historicalSessionsCount: true, createsSubscription: false }, { headers });
  if (process.env.PRO_OFFERS_ENABLED !== "true") return NextResponse.json({ status: "disabled" }, { status: 503, headers });
  const code = randomBytes(32).toString("base64url");
  try {
    const awardId = z.uuid().parse(await lifecycleRpc("issue_pro_offer", { p_user_id: input.userId, p_program_id: input.program,
      p_code_hash: createHash("sha256").update(code).digest("hex"), p_reference: `${user.id}:${input.reference}`, p_terms_version: input.termsVersion }));
    return NextResponse.json({ awardId, offerToken: code, claimPath: "/offers/claim" }, { status: 201, headers });
  } catch {
    return NextResponse.json({ error: "Offer issuance could not be confirmed. Inspect recipient, approval and budget records before retrying." }, { status: 409, headers });
  }
}, { errorMessage: "Offer issuance failed" });
