/**
 * POST /api/webhooks/resend
 *
 * Receives Resend webhook events for email delivery tracking.
 * Updates email_send_log with delivery/open/click/bounce timestamps.
 *
 * Events handled:
 * - email.delivered -> delivered_at
 * - email.opened   -> opened_at
 * - email.clicked   -> clicked_at
 * - email.bounced   -> bounced_at
 *
 * Security:
 * - Verifies svix signature headers
 * - Rate limited (120/min, 5000/hr)
 * - No auth required (webhook callbacks are server-to-server)
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/middleware/api-wrappers/rate-limit-wrapper";

const CONTEXT_TAG = "[resend-webhook]";

// Map Resend event types to email_send_log columns
const EVENT_COLUMN_MAP: Record<string, string> = {
  "email.delivered": "delivered_at",
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
};

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id: string;
    created_at: string;
    to: string[];
    bounce?: {
      type: "hard" | "soft" | "undetermined";
      message?: string;
    };
    click?: {
      link?: string;
      timestamp?: string;
      userAgent?: string;
      ipAddress?: string;
    };
    [key: string]: unknown;
  };
}

function normalizeClickLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const link = value.trim();
  if (link.length === 0) return null;
  return link;
}

function normalizeClickTimestamp(payload: ResendWebhookPayload): string {
  const timestamp =
    typeof payload.data.click?.timestamp === "string"
      ? payload.data.click.timestamp
      : payload.data.created_at;
  return timestamp || new Date().toISOString();
}

async function recordClickEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  payload: ResendWebhookPayload,
  link: string,
  resendMessageId: string,
  webhookMessageId: string | null,
  emailSendLogId: string | number | null
): Promise<void> {
  const { error } = await (supabase as any)
    .from("email_click_events")
    .insert({
      email_send_log_id: emailSendLogId,
      resend_message_id: resendMessageId,
      webhook_message_id: webhookMessageId,
      clicked_at: normalizeClickTimestamp(payload),
      link,
      user_agent:
        typeof payload.data.click?.userAgent === "string"
          ? payload.data.click.userAgent
          : null,
    });

  if (error && error.code !== "23505") {
    console.error(
      `${CONTEXT_TAG} Failed to record click event for ${resendMessageId}:`,
      error
    );
  }
}

async function findEmailSendLogId(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>,
  resendMessageId: string
): Promise<string | number | null> {
  const { data, error } = await supabase
    .from("email_send_log")
    .select("id")
    .eq("resend_message_id", resendMessageId)
    .maybeSingle();

  if (error) {
    console.error(
      `${CONTEXT_TAG} Failed to resolve email_send_log id for ${resendMessageId}:`,
      error
    );
    return null;
  }

  return data?.id ?? null;
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(`${CONTEXT_TAG} RESEND_WEBHOOK_SECRET not configured`);
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Extract svix headers for signature verification
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing webhook signature headers" },
      { status: 400 }
    );
  }

  // Read raw body for signature verification
  const body = await request.text();

  // Verify webhook signature
  const wh = new Webhook(webhookSecret);
  let payload: ResendWebhookPayload;

  try {
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch (err) {
    console.error(`${CONTEXT_TAG} Invalid webhook signature:`, err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  // Check if we handle this event type
  const column = EVENT_COLUMN_MAP[payload.type];
  if (!column) {
    // Unknown event type -- acknowledge but don't process
    return NextResponse.json({ received: true, processed: false });
  }

  const resendMessageId = payload.data.email_id;
  if (!resendMessageId) {
    console.warn(`${CONTEXT_TAG} Event ${payload.type} missing email_id`);
    return NextResponse.json({ received: true, processed: false });
  }

  // Update email_send_log -- only set if currently NULL (idempotent, first event wins)
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const eventTimestamp =
      payload.type === "email.clicked"
        ? normalizeClickTimestamp(payload)
        : payload.data.created_at || new Date().toISOString();

    const { data, error } = await supabase
      .from("email_send_log")
      .update({ [column]: eventTimestamp })
      .eq("resend_message_id", resendMessageId)
      .is(column, null)
      .select("id");

    if (error) {
      console.error(
        `${CONTEXT_TAG} Failed to update ${column} for ${resendMessageId}:`,
        error
      );
      // Still return 200 to prevent Resend retries
      return NextResponse.json({
        received: true,
        processed: false,
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      // Either no matching message ID or column already set
      console.log(
        `${CONTEXT_TAG} No update for ${payload.type} on ${resendMessageId} (not found or already set)`
      );
    } else {
      console.log(
        `${CONTEXT_TAG} Updated ${column} for ${resendMessageId}`
      );
    }

    const clickLink = normalizeClickLink(payload.data.click?.link);
    if (payload.type === "email.clicked" && clickLink) {
      const emailSendLogId =
        data?.[0]?.id ?? (await findEmailSendLogId(supabase, resendMessageId));

      await recordClickEvent(
        supabase,
        payload,
        clickLink,
        resendMessageId,
        svixId,
        emailSendLogId
      );
    }

    // Auto-suppress on hard bounce (runs regardless of whether email_send_log
    // matched — the upsert is idempotent so replays and missing log entries are safe)
    if (
      payload.type === "email.bounced" &&
      payload.data.bounce?.type === "hard" &&
      payload.data.to?.length > 0
    ) {
      for (const email of payload.data.to) {
        const sanitizedMessage = (payload.data.bounce.message || "no details")
          .replace(/[^\x20-\x7E]/g, "")
          .slice(0, 500);
        const { error: suppressError } = await supabase
          .from("email_suppression_list")
          .upsert(
            {
              email: email.toLowerCase(),
              reason: "hard_bounce",
              notes: `Auto-suppressed from Resend bounce event ${resendMessageId} — ${sanitizedMessage}`,
            },
            { onConflict: "email" }
          );

        if (suppressError) {
          console.error(
            `${CONTEXT_TAG} Failed to suppress bounced email ${email}:`,
            suppressError
          );
        } else {
          console.log(
            `${CONTEXT_TAG} Auto-suppressed hard-bounced email: ${email}`
          );
        }
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (err) {
    console.error(`${CONTEXT_TAG} Unexpected error processing webhook:`, err);
    // Always return 200 to prevent retries
    return NextResponse.json({ received: true, processed: false });
  }
}

// Apply rate limiting -- webhook-resend config (120/min, 5000/hr, burst 50)
export const POST = withRateLimit(handler, "webhook-resend");
