import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Lets the app show the saved choice as one switch instead of both opt-in and opt-out buttons.
export const GET = withRateLimit(withAuth(async (_request, { user }) => {
  const headers = { "Cache-Control": "private, no-store" };
  const db = await createSupabaseServiceRoleClient();
  const { data, error } = await (db as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: { lifecycle_consent_at: string | null } | null; error: unknown }>;
        };
      };
    };
  }).from("email_contact_state").select("lifecycle_consent_at").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Preference unavailable" }, { status: 503, headers });
  return NextResponse.json({ consent: Boolean(data?.lifecycle_consent_at), contract_version: 1 }, { headers });
}), { key: "authenticated-default" });

export const POST = withRateLimit(withAuth(async (request, { user }) => {
  const headers = { "Cache-Control": "private, no-store" };
  const body = z.object({ consent: z.boolean(), version: z.literal("lifecycle-v1") }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid preference" }, { status: 400, headers });
  await lifecycleRpc("set_lifecycle_consent", { p_user_id: user.id, p_consent: body.data.consent });
  return NextResponse.json({ consent: body.data.consent, contract_version: 1 }, { headers });
}), { key: "authenticated-default" });
