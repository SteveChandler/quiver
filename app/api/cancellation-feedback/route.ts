import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withAuth, withRateLimit } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, no-cache, must-revalidate" };
const reason = z.enum(["avoid_charge", "price", "missing_spot", "forecast", "technical", "usage", "other"]);
const submission = z.object({
  cancellation_event_id: z.string().min(1).max(200),
  outcome: z.enum(["submitted", "dismissed"]),
  reason: reason.nullable(),
  note: z.string().trim().max(2000),
  source: z.enum(["native_home", "native_settings"]),
  app_version: z.string().max(40).nullable(),
  app_build: z.string().max(40).nullable(),
}).strict().refine(value => value.outcome === "submitted"
  ? value.reason !== null
  : value.reason === null && value.note === "");

const eventSchema = z.object({
  provider_event_id: z.string(),
  event_type: z.string(),
  event_timestamp: z.string().datetime({ offset: true }),
  period_type: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  expiration_at: z.string().datetime({ offset: true }).nullable(),
});

async function latestCancellation(db: SupabaseClient, userId: string): Promise<z.infer<typeof eventSchema> | null> {
  const { data, error } = await db.from("revenuecat_provider_events")
    .select("provider_event_id,event_type,event_timestamp,period_type,cancellation_reason,expiration_at")
    .eq("app_user_id", userId).eq("environment", "PRODUCTION")
    .in("store", ["APP_STORE", "PLAY_STORE"])
    .in("event_type", ["CANCELLATION", "UNCANCELLATION", "INITIAL_PURCHASE", "RENEWAL"])
    .gte("event_timestamp", new Date(Date.now() - 30 * 86400_000).toISOString())
    .order("event_timestamp", { ascending: false }).order("received_at", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const event = eventSchema.parse(data);
  if (event.event_type !== "CANCELLATION" || event.cancellation_reason !== "UNSUBSCRIBE"
    || !["TRIAL", "NORMAL"].includes(event.period_type ?? "")) return null;
  return event;
}

export const GET = withRateLimit(withAuth(async (_request, { user }) => {
  if (process.env.CANCELLATION_FEEDBACK_ENABLED !== "true") {
    return NextResponse.json({ cancellation: null }, { headers });
  }
  // These additive tables are not in the generated schema until deployment.
  const db: SupabaseClient = await createSupabaseServiceRoleClient();
  const event = await latestCancellation(db, user.id);
  if (!event) return NextResponse.json({ cancellation: null }, { headers });
  const { data, error } = await db.from("cancellation_feedback")
    .select("cancellation_event_id").eq("user_id", user.id)
    .eq("cancellation_event_id", event.provider_event_id).maybeSingle();
  if (error) throw error;
  return NextResponse.json({ cancellation: data ? null : {
    id: event.provider_event_id,
    is_trial: event.period_type === "TRIAL",
    cancelled_at: event.event_timestamp,
    expires_at: event.expiration_at,
  } }, { headers });
}), { key: "authenticated-default" });

export const POST = withRateLimit(withAuth(async (request, { user }) => {
  if (process.env.CANCELLATION_FEEDBACK_ENABLED !== "true") {
    return NextResponse.json({ error: "Feedback is unavailable right now." }, { status: 503, headers });
  }
  const parsed = submission.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a reason and keep your note under 2,000 characters." }, { status: 400, headers });
  }
  const db: SupabaseClient = await createSupabaseServiceRoleClient();
  const event = await latestCancellation(db, user.id);
  if (!event || event.provider_event_id !== parsed.data.cancellation_event_id) {
    return NextResponse.json({ error: "This cancellation is no longer available for feedback." }, { status: 409, headers });
  }
  // First terminal decision wins, including retries after a lost response.
  const { error } = await db.from("cancellation_feedback").upsert(
    { ...parsed.data, user_id: user.id },
    { onConflict: "cancellation_event_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  const { data: stored, error: readError } = await db.from("cancellation_feedback")
    .select("outcome,reason,note").eq("user_id", user.id)
    .eq("cancellation_event_id", event.provider_event_id).maybeSingle();
  if (readError) throw readError;
  if (!stored || stored.outcome !== parsed.data.outcome || stored.reason !== parsed.data.reason || stored.note !== parsed.data.note) {
    return NextResponse.json({ error: "Feedback for this cancellation was already recorded." }, { status: 409, headers });
  }
  return NextResponse.json({ saved: true }, { headers });
}), { key: "authenticated-default" });
