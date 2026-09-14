import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { acceptWebRecovery, getWebRecovery, getWebRecoveryPortal, reconcileWebRecovery } from "@/lib/trial-feedback/web-recovery";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), request_id: z.uuid(), terms_version: z.string().min(1).max(80), accept: z.literal(true) }).strict(),
  z.object({ action: z.literal("reconcile") }).strict(),
  z.object({ action: z.literal("portal") }).strict(),
]);
function unavailable(): NextResponse { return NextResponse.json({ error: "Web offer recovery is unavailable right now." }, { status: 503, headers }); }

export const GET = withRateLimit(withAuth(async (_request, { user }) => {
  if (process.env.TRIAL_FEEDBACK_WORKER_ENABLED !== "true") return NextResponse.json({ user_id: user.id, status: "unavailable", terms_version: null, trial_ends_at: null, free_ends_at: null }, { headers });
  return NextResponse.json(await getWebRecovery(user.id), { headers });
}), { key: "authenticated-default" });

export const POST = withRateLimit(withAuth(async (request, { user }) => {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid web offer request." }, { status: 400, headers });
  if (process.env.TRIAL_FEEDBACK_WORKER_ENABLED !== "true") return unavailable();
  if (body.data.action === "accept" && (process.env.TRIAL_FEEDBACK_WEB_ENABLED !== "true" || process.env.TRIAL_FEEDBACK_ENABLED !== "true" || process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED !== "true")) return unavailable();
  try {
    if (body.data.action === "accept") return NextResponse.json(await acceptWebRecovery(user.id, body.data.request_id, body.data.terms_version), { headers });
    if (body.data.action === "portal") return NextResponse.json({ user_id: user.id, url: await getWebRecoveryPortal(user.id) }, { headers });
    await reconcileWebRecovery(user.id);
    return NextResponse.json(await getWebRecovery(user.id), { headers });
  } catch {
    // Never attach provider responses or token-bearing management URLs to telemetry.
    Sentry.captureException(new Error("Web feedback request could not be confirmed"), { tags: { component: "trial-feedback-web" } });
    return NextResponse.json({ error: "We couldn’t confirm your offer. Refresh its saved status before trying again." }, { status: 409, headers });
  }
}), { key: "authenticated-default" });
