import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";

export const dynamic = "force-dynamic";
export const POST = withRateLimit(withAuth(async (request, { user }) => {
  const headers = { "Cache-Control": "private, no-store" };
  const body = z.object({ consent: z.boolean(), version: z.literal("lifecycle-v1") }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid preference" }, { status: 400, headers });
  await lifecycleRpc("set_lifecycle_consent", { p_user_id: user.id, p_consent: body.data.consent });
  return NextResponse.json({ consent: body.data.consent, contract_version: 1 }, { headers });
}), { key: "authenticated-default" });
