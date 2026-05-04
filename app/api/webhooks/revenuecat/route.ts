// app/api/webhooks/revenuecat/route.ts
//
// RevenueCat webhook receiver — upserts user_entitlements based on RC events.
//
// Auth: shared-secret via Authorization header (RC calls this endpoint with
// a bearer token configured in the RC dashboard). Set REVENUECAT_WEBHOOK_SECRET
// in Vercel env to match RC dashboard > Project > Integrations > Webhooks.
//
// Event handling (see https://www.revenuecat.com/docs/webhooks for full list):
//   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION → is_pro=true, extend expires_at
//   CANCELLATION                                 → will_renew=false (keep is_pro
//                                                  until expires_at passes)
//   EXPIRATION                                   → is_pro=false, set lapsed_at
//   BILLING_ISSUE                                → billing_issue=true (keep is_pro)
//   PRODUCT_CHANGE                               → swap product_id
//   TRANSFER                                     → re-identify app_user_id
//   TEST                                         → log + 200 (RC dashboard ping)
//
// Failures write to user_entitlements_failed_webhooks for a daily reconciler
// to sweep via the RC REST API. We return 200 in those cases so RC stops
// retrying on permanent errors (auth mismatch, malformed payload); 500 is
// reserved for transient infra problems so RC backs off and retries.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ensureSimilarityRuleForUser } from "@/lib/alerts/auto-enable-similarity";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CONTEXT_TAG = "[rc-webhook]";

interface RCEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  period_type?: "NORMAL" | "TRIAL" | "INTRO";
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  event_timestamp_ms?: number;
  environment?: "SANDBOX" | "PRODUCTION";
  // Many more fields exist; we read the ones we need + stash the full
  // payload into rc_raw for debugging.
  [k: string]: unknown;
}

interface RCPayload {
  event: RCEvent;
  api_version?: string;
}

function verifyAuth(req: Request): boolean {
  // REVENUECAT_WEBHOOK_SECRET must be set in Vercel env (all environments:
  // Development, Preview, Production) AND match the RC dashboard's
  // "Authorization header value" field byte-for-byte. Env var changes in
  // Vercel only take effect on a new deployment — redeploy after editing.
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) {
    console.error(`${CONTEXT_TAG} REVENUECAT_WEBHOOK_SECRET not set`);
    return false;
  }
  const header = req.headers.get("authorization") ?? "";
  // Accept both "Bearer <token>" and the bare token form, matching how
  // the RC dashboard lets you configure either.
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  // timingSafeEqual requires equal-length buffers — short-circuit unequal
  // lengths up front (leaks length but not content, which is acceptable
  // since the expected secret is a fixed-length generated value).
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    // 401 on bad auth — RC treats this as a permanent failure and stops
    // retrying, which is what we want (mis-configured secret shouldn't
    // drown us in retries).
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RCPayload;
  try {
    payload = (await request.json()) as RCPayload;
  } catch (err) {
    console.error(`${CONTEXT_TAG} Invalid JSON body:`, err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event;
  if (!event?.type) {
    return NextResponse.json({ error: "Missing event.type" }, { status: 400 });
  }

  // TEST events are dashboard pings — acknowledge + move on.
  if (event.type === "TEST") {
    console.log(`${CONTEXT_TAG} Received TEST event`);
    return NextResponse.json({ ok: true, echo: "test" });
  }

  const userId = event.app_user_id ?? event.original_app_user_id;
  if (!userId) {
    return recordFailure(event, "Missing app_user_id");
  }

  // TRANSFER requires admin re-identification of app_user_id (a user
  // switching devices/accounts). We can't mirror it automatically — route
  // it to the DLQ for manual reconciliation rather than silently dropping.
  if (event.type === "TRANSFER") {
    return recordFailure(
      event,
      "TRANSFER event requires manual app_user_id reassignment",
      userId,
    );
  }

  const supabase = await createSupabaseServiceRoleClient();

  try {
    const update = buildEntitlementUpdate(event);
    if (!update) {
      // Unhandled event type — not an error; log and return 200.
      console.log(`${CONTEXT_TAG} Skipping unhandled event type: ${event.type}`);
      return NextResponse.json({ ok: true, skipped: event.type });
    }

    const { error } = await (supabase as any)
      .from("user_entitlements")
      .upsert(
        // `as any` on the client: rc_raw is a jsonb column and the generated
        // Insert type requires a strict Json recursive type which RCEvent's
        // `[k: string]: unknown` index signature can't satisfy. The runtime
        // shape is correct (every RC payload is JSON-serializable); the
        // cast is scoped to this single webhook boundary.
        { user_id: userId, ...update, rc_raw: event },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error(`${CONTEXT_TAG} Upsert failed for user ${userId}:`, error);
      return recordFailure(event, error.message, userId);
    }

    console.log(
      `${CONTEXT_TAG} Applied ${event.type} for user ${userId}`,
    );

    // Best-effort: auto-enable the similarity_match alert rule for newly
    // entitled users so the Pro flagship feature reaches them without
    // requiring an explicit opt-in via the alert management UI. Mirrors the
    // backfill in supabase/migrations/20260503210949_auto_enable_similarity_for_pro.sql.
    // Failures here MUST NOT fail the webhook — the user_entitlements upsert
    // above is the load-bearing step; the rule create is best-effort. RC
    // retries on 5xx; we don't want a transient alert_rules write error to
    // trigger a retry that re-flips entitlement state.
    if (update.is_pro === true || update.is_trialing === true) {
      try {
        const result = await ensureSimilarityRuleForUser(supabase, userId);
        if (result.created) {
          console.log(
            `${CONTEXT_TAG} Auto-enabled similarity_match rule for user ${userId}`,
          );
        } else {
          console.log(
            `${CONTEXT_TAG} Skipped similarity_match auto-enable for user ${userId}: ${result.reason}`,
          );
        }
      } catch (err) {
        console.error(
          `${CONTEXT_TAG} Auto-enable similarity rule threw for user ${userId}:`,
          err,
        );
        Sentry.captureException(err, {
          tags: {
            feature: "rc-webhook",
            step: "auto-enable-similarity",
          },
          extra: { user_id: userId, event_type: event.type },
        });
      }
    }

    return NextResponse.json({ ok: true, event_type: event.type });
  } catch (err) {
    console.error(`${CONTEXT_TAG} Unexpected error:`, err);
    return recordFailure(
      event,
      err instanceof Error ? err.message : "Unknown error",
      userId,
    );
  }
}

interface EntitlementUpdate {
  is_pro?: boolean;
  is_trialing?: boolean;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  product_id?: string | null;
  will_renew?: boolean;
  billing_issue?: boolean;
  lapsed_at?: string | null;
  previous_product_id?: string | null;
}

// Maps an RC event to the column set to upsert. Returns null for events we
// deliberately ignore (TRANSFER is handled by a separate admin path; we don't
// mirror it automatically because it requires re-identifying app_user_id).
function buildEntitlementUpdate(event: RCEvent): EntitlementUpdate | null {
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;
  const isTrial = event.period_type === "TRIAL";

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
      return {
        is_pro: true,
        is_trialing: isTrial,
        trial_ends_at: isTrial ? expiresAt : null,
        expires_at: expiresAt,
        product_id: event.product_id ?? null,
        will_renew: true,
        billing_issue: false,
        lapsed_at: null,
      };

    case "CANCELLATION":
      // Don't flip is_pro — user retains access until expires_at.
      return {
        will_renew: false,
      };

    case "EXPIRATION":
      return {
        is_pro: false,
        is_trialing: false,
        will_renew: false,
        billing_issue: false,
        lapsed_at: new Date(
          event.event_timestamp_ms ?? Date.now(),
        ).toISOString(),
        previous_product_id: event.product_id ?? null,
      };

    case "BILLING_ISSUE":
      // Grace period — keep is_pro true; surface a banner via UI read.
      return {
        billing_issue: true,
      };

    case "PRODUCT_CHANGE":
      return {
        product_id: event.product_id ?? null,
        expires_at: expiresAt,
      };

    // TRANSFER is intercepted earlier in the POST handler and routed to
    // the DLQ — it should never reach this switch. Leaving no case here
    // so a future refactor that removes the early intercept fails loudly.

    default:
      return null;
  }
}

async function recordFailure(
  event: RCEvent,
  errorMessage: string,
  userId?: string,
): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServiceRoleClient();
    // `as any` on the client: payload is a jsonb column and the generated
    // Insert type requires a strict Json recursive type which RCEvent's
    // `[k: string]: unknown` index signature can't satisfy. Same boundary
    // as the user_entitlements upsert above.
    await (supabase as any)
      .from("user_entitlements_failed_webhooks")
      .insert({
        user_id: userId ?? null,
        event_type: event.type ?? null,
        payload: event,
        error_message: errorMessage,
      });
  } catch (dlqErr) {
    // DLQ table may not exist yet (migration pending apply). Page via
    // Sentry rather than only console.error — RC retries ~3x then gives
    // up, and if the DLQ is permanently missing we need to know before
    // events are silently dropped past the retry budget.
    Sentry.captureException(dlqErr, {
      tags: {
        feature: "rc-webhook",
        step: "dlq-write-failed",
      },
      extra: {
        event_type: event.type,
        user_id: userId,
        original_error: errorMessage,
      },
    });
    console.error(
      `${CONTEXT_TAG} DLQ write failed — returning 500 to trigger RC retry. Event: ${event.type}, user: ${userId}, original error: ${errorMessage}`,
      dlqErr,
    );
    return NextResponse.json(
      { error: "DLQ write failed", original_error: errorMessage },
      { status: 500 },
    );
  }
  // DLQ succeeded — return 200 so RC considers the event handled on its side.
  // The daily reconciler sweeps the DLQ against the RC REST API.
  return NextResponse.json(
    { ok: false, error: errorMessage, queued_for_reconciliation: true },
    { status: 200 },
  );
}
