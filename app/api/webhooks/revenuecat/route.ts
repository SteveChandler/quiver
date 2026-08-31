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
//   NON_RENEWING_PURCHASE                       → is_pro=true, including
//                                                  non-expiring promo grants
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
import {
  buildRevenueCatProviderEventInsert,
  buildEntitlementUpdate,
  mergeEntitlementUpdate,
  type ExistingEntitlementRow,
  type RCEvent,
} from "./entitlement-update";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CONTEXT_TAG = "[rc-webhook]";

interface RCPayload {
  event: RCEvent;
  api_version?: string;
}

interface ProviderEventState {
  providerEventId: string | null;
  processedDuplicate: boolean;
  retryRequired: boolean;
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

  const supabase = await createSupabaseServiceRoleClient();
  const providerEvent = await persistProviderEvent(supabase, event);
  if (providerEvent.processedDuplicate) {
    return NextResponse.json({ ok: true, event_type: event.type, duplicate: true });
  }

  const userId = event.app_user_id ?? event.original_app_user_id;
  if (!userId) {
    const response = await recordFailure(event, "Missing app_user_id");
    return providerEvent.retryRequired ? ledgerRetryResponse() : response;
  }

  // TRANSFER requires admin re-identification of app_user_id (a user
  // switching devices/accounts). We can't mirror it automatically — route
  // it to the DLQ for manual reconciliation rather than silently dropping.
  if (event.type === "TRANSFER") {
    const response = await recordFailure(
      event,
      "TRANSFER event requires manual app_user_id reassignment",
      userId,
    );
    return providerEvent.retryRequired ? ledgerRetryResponse() : response;
  }

  try {
    const update = buildEntitlementUpdate(event);
    if (!update) {
      // Unhandled event type — not an error; log and return 200.
      console.log(`${CONTEXT_TAG} Skipping unhandled event type: ${event.type}`);
      return finishProviderEvent(
        supabase,
        providerEvent,
        event,
        NextResponse.json({ ok: true, skipped: event.type }),
      );
    }

    const { data: currentRow, error: readError } = await (supabase as any)
      .from("user_entitlements")
      .select("is_pro, is_trialing, expires_at, product_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) {
      console.error(`${CONTEXT_TAG} Read failed for user ${userId}:`, readError);
      const response = await recordFailure(event, readError.message, userId);
      return providerEvent.retryRequired ? ledgerRetryResponse() : response;
    }

    const mergedUpdate = mergeEntitlementUpdate({
      currentRow: currentRow as ExistingEntitlementRow | null,
      update,
    });

    if (!mergedUpdate) {
      console.log(
        `${CONTEXT_TAG} Preserved lifetime promotional Pro for user ${userId}; ignored ${event.type}`,
      );
      return finishProviderEvent(
        supabase,
        providerEvent,
        event,
        NextResponse.json({
          ok: true,
          event_type: event.type,
          preserved: "lifetime_promotional_pro",
        }),
      );
    }

    const { error } = await (supabase as any)
      .from("user_entitlements")
      .upsert(
        // `as any` on the client: rc_raw is a jsonb column and the generated
        // Insert type requires a strict Json recursive type which RCEvent's
        // `[k: string]: unknown` index signature can't satisfy. The runtime
        // shape is correct (every RC payload is JSON-serializable); the
        // cast is scoped to this single webhook boundary.
        { user_id: userId, ...mergedUpdate, rc_raw: event },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error(`${CONTEXT_TAG} Upsert failed for user ${userId}:`, error);
      const response = await recordFailure(event, error.message, userId);
      return providerEvent.retryRequired ? ledgerRetryResponse() : response;
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
    if (mergedUpdate.is_pro === true || mergedUpdate.is_trialing === true) {
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

    return finishProviderEvent(
      supabase,
      providerEvent,
      event,
      NextResponse.json({ ok: true, event_type: event.type }),
    );
  } catch (err) {
    console.error(`${CONTEXT_TAG} Unexpected error:`, err);
    const response = await recordFailure(
      event,
      err instanceof Error ? err.message : "Unknown error",
      userId,
    );
    return providerEvent.retryRequired ? ledgerRetryResponse() : response;
  }
}

async function persistProviderEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  event: RCEvent,
): Promise<ProviderEventState> {
  const ledgerRow = buildRevenueCatProviderEventInsert(event);
  if (!ledgerRow) {
    console.error(`${CONTEXT_TAG} Provider event missing immutable id: ${event.type}`);
    const recorded = await recordLedgerFailure(
      supabase,
      event,
      "missing immutable provider event id",
    );
    return { providerEventId: null, processedDuplicate: false, retryRequired: !recorded };
  }

  try {
    const { error } = await (supabase as any)
      .from("revenuecat_provider_events")
      .insert(ledgerRow);
    if (error?.code === "23505") {
      const { data: existing, error: readError } = await (supabase as any)
        .from("revenuecat_provider_events")
        .select("processed_at")
        .eq("provider_event_id", ledgerRow.provider_event_id)
        .maybeSingle();
      if (readError) {
        console.error(`${CONTEXT_TAG} Provider event duplicate read failed:`, readError);
        Sentry.captureException(readError, {
          tags: { feature: "rc-webhook", step: "provider-event-duplicate-read" },
          extra: { provider_event_id: event.id, event_type: event.type },
        });
        return { providerEventId: null, processedDuplicate: false, retryRequired: true };
      }
      return {
        providerEventId: ledgerRow.provider_event_id,
        processedDuplicate: Boolean(existing?.processed_at),
        retryRequired: false,
      };
    }
    if (!error) {
      return {
        providerEventId: ledgerRow.provider_event_id,
        processedDuplicate: false,
        retryRequired: false,
      };
    }
    console.error(`${CONTEXT_TAG} Provider event ledger insert failed:`, error);
    Sentry.captureException(error, {
      tags: { feature: "rc-webhook", step: "provider-event-ledger" },
      extra: { provider_event_id: event.id, event_type: event.type },
    });
    const recorded = await recordLedgerFailure(
      supabase,
      event,
      error.message ?? "ledger insert failed",
    );
    return { providerEventId: null, processedDuplicate: false, retryRequired: !recorded };
  } catch (error) {
    console.error(`${CONTEXT_TAG} Provider event ledger insert threw:`, error);
    Sentry.captureException(error, {
      tags: { feature: "rc-webhook", step: "provider-event-ledger" },
      extra: { provider_event_id: event.id, event_type: event.type },
    });
    const recorded = await recordLedgerFailure(
      supabase,
      event,
      error instanceof Error ? error.message : "ledger insert threw",
    );
    return { providerEventId: null, processedDuplicate: false, retryRequired: !recorded };
  }
}

async function finishProviderEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  providerEvent: ProviderEventState,
  event: RCEvent,
  response: NextResponse,
): Promise<NextResponse> {
  if (providerEvent.providerEventId) {
    try {
      const { error } = await (supabase as any)
        .from("revenuecat_provider_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("provider_event_id", providerEvent.providerEventId);
      if (error) throw error;
    } catch (error) {
      console.error(`${CONTEXT_TAG} Provider event completion write failed:`, error);
      Sentry.captureException(error, {
        tags: { feature: "rc-webhook", step: "provider-event-completion" },
        extra: { provider_event_id: event.id, event_type: event.type },
      });
      return NextResponse.json(
        { error: "Provider event completion write failed" },
        { status: 500 },
      );
    }
  }
  return providerEvent.retryRequired ? ledgerRetryResponse() : response;
}

function ledgerRetryResponse(): NextResponse {
  return NextResponse.json(
    { error: "Provider event ledger and DLQ writes failed" },
    { status: 500 },
  );
}

async function recordLedgerFailure(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  event: RCEvent,
  errorMessage: string,
): Promise<boolean> {
  const userId = event.app_user_id ?? event.original_app_user_id ?? null;
  try {
    const { error } = await (supabase as any)
      .from("user_entitlements_failed_webhooks")
      .insert({
        user_id: userId,
        event_type: event.type ?? null,
        payload: event,
        error_message: `provider_event_ledger: ${errorMessage}`,
      });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`${CONTEXT_TAG} Provider event ledger DLQ write failed:`, error);
    Sentry.captureException(error, {
      tags: { feature: "rc-webhook", step: "provider-event-ledger-dlq" },
      extra: { provider_event_id: event.id, event_type: event.type, user_id: userId },
    });
    return false;
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
