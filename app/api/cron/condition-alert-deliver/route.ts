// app/api/cron/condition-alert-deliver/route.ts
//
// Delivery cron — runs every 5 minutes.
// Reads due items from alert_queue, consolidates per user, sends email + push.

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { ConsolidatedAlertEmail } from "@/lib/mailer/templates/ConsolidatedAlertEmail";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { consolidateQueueItems } from "@/lib/alerts/payload-builder";
import type { QueueItemWithMeta } from "@/lib/alerts/payload-builder";
import { formatPushNotification } from "@/lib/alerts/push-formatter";
import { sendPushNotifications } from "@/lib/alerts/push-sender";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CONTEXT_TAG = "[condition-alert-deliver]";

export async function GET(request: Request): Promise<NextResponse> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();
  const summary = { processed: 0, emailSent: 0, pushSent: 0, queueMarked: 0, errors: 0 };

  try {
    // 1. Fetch due, unsent queue items joined with rule + beach + profile data
    const { data: rawItems, error: queueError } = await supabase
      .from("alert_queue")
      .select(`
        id, user_id, rule_id, beach_id, alert_date, send_at,
        window_start, window_end, best_hour, conditions_snapshot, sent,
        alert_rules!inner(name, notify_email, notify_push),
        beaches!inner(name, timezone),
        profiles!inner(email, display_name, notif_email_enabled, notif_push_enabled)
      `)
      .eq("sent", false)
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true });

    if (queueError) throw queueError;
    if (!rawItems || rawItems.length === 0) {
      console.log(`${CONTEXT_TAG} No due queue items`);
      return NextResponse.json({ ...summary, message: "No items due" });
    }

    console.log(`${CONTEXT_TAG} Found ${rawItems.length} due queue items`);

    // 2. Reshape into flat QueueItemWithMeta (consolidateQueueItems expects this shape)
    const items: QueueItemWithMeta[] = rawItems.map((row) => {
      const rule = row.alert_rules as unknown as { name: string; notify_email: boolean; notify_push: boolean };
      const beach = row.beaches as unknown as { name: string; timezone: string };
      return {
        id: row.id,
        user_id: row.user_id,
        rule_id: row.rule_id,
        beach_id: row.beach_id,
        alert_date: String(row.alert_date),
        send_at: row.send_at,
        window_start: row.window_start,
        window_end: row.window_end,
        best_hour: row.best_hour,
        conditions_snapshot: (row.conditions_snapshot ?? {}) as Record<string, unknown>,
        sent: row.sent,
        rule_name: rule.name,
        beach_name: beach.name,
        beach_timezone: beach.timezone,
        notify_email: rule.notify_email,
        notify_push: rule.notify_push,
        // best_score not stored in queue — use 0 as default; consolidate sorts by it
        best_score: 0,
      };
    });

    // 3. Group profile data by user_id for fast lookup
    const profilesByUser = new Map<string, { email: string; display_name: string | null; notif_email_enabled: boolean; notif_push_enabled: boolean }>();
    for (const row of rawItems) {
      if (!profilesByUser.has(row.user_id)) {
        const profile = row.profiles as unknown as { email: string; display_name: string | null; notif_email_enabled: boolean; notif_push_enabled: boolean };
        profilesByUser.set(row.user_id, profile);
      }
    }

    // 4. Consolidate per user
    const payloads = consolidateQueueItems(items);
    const baseUrl = getBaseUrl();
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    for (const payload of payloads) {
      summary.processed++;
      const profile = profilesByUser.get(payload.user_id);
      if (!profile) {
        console.warn(`${CONTEXT_TAG} No profile found for user ${payload.user_id}, skipping`);
        summary.errors++;
        continue;
      }

      const queueIds = items.filter((i) => i.user_id === payload.user_id).map((i) => i.id);

      try {
        // 5a. Email delivery
        const emailMatches = payload.matches.filter((m) => m.notify_email);
        const shouldEmail = emailMatches.length > 0 && profile.notif_email_enabled;

        if (shouldEmail) {
          // Dedup: only send if no email delivery recorded today
          const { data: existingEmail } = await supabase
            .from("alert_deliveries")
            .select("id")
            .eq("user_id", payload.user_id)
            .eq("alert_date", payload.alert_date)
            .eq("channel", "email")
            .limit(1);

          if (!existingEmail || existingEmail.length === 0) {
            const manageAlertsUrl = `${baseUrl}/settings/alerts`;
            const unsubscribeUrl = `${baseUrl}/settings`;
            const alertDate = new Date(payload.alert_date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });

            await rateLimiter.throttle();

            const { data: sendData, error: sendError } = await resend.emails.send({
              from: MAIL_FROM,
              replyTo: MAIL_REPLY_TO,
              to: profile.email,
              subject: `Your surf alert for ${alertDate}`,
              react: ConsolidatedAlertEmail({
                displayName: profile.display_name,
                alertDate,
                matches: emailMatches,
                manageAlertsUrl,
                unsubscribeUrl,
                baseUrl,
              }),
            });

            if (sendError) {
              console.error(`${CONTEXT_TAG} Email send failed for user ${payload.user_id}:`, sendError);
              summary.errors++;
            } else {
              // Write dedup record
              await supabase.from("alert_deliveries").insert({
                user_id: payload.user_id,
                alert_date: payload.alert_date,
                channel: "email",
                payload: { match_count: emailMatches.length, beaches: emailMatches.map((m) => m.beach_name) },
              });

              await emailLogger.logDelivery({
                userId: payload.user_id,
                emailType: "conditions_alert",
                subject: `Your surf alert for ${alertDate}`,
                meta: {
                  match_count: emailMatches.length,
                  beaches: emailMatches.map((m) => m.beach_name),
                },
                resendMessageId: sendData?.id,
              });

              summary.emailSent++;
              console.log(`${CONTEXT_TAG} Email sent to user ${payload.user_id} (${emailMatches.length} matches)`);
            }
          }
        }

        // 5b. Push delivery
        const pushMatches = payload.matches.filter((m) => m.notify_push);
        const shouldPush = pushMatches.length > 0 && profile.notif_push_enabled;

        if (shouldPush) {
          const { data: existingPush } = await supabase
            .from("alert_deliveries")
            .select("id")
            .eq("user_id", payload.user_id)
            .eq("alert_date", payload.alert_date)
            .eq("channel", "push")
            .limit(1);

          if (!existingPush || existingPush.length === 0) {
            const { data: devices } = await supabase
              .from("user_devices")
              .select("device_token")
              .eq("user_id", payload.user_id);

            if (devices && devices.length > 0) {
              const { title, body, data } = formatPushNotification(pushMatches);
              const messages = devices.map((d) => ({
                to: d.device_token,
                title,
                body,
                data,
              }));

              await sendPushNotifications(messages);

              await supabase.from("alert_deliveries").insert({
                user_id: payload.user_id,
                alert_date: payload.alert_date,
                channel: "push",
                payload: { match_count: pushMatches.length, device_count: devices.length },
              });

              summary.pushSent++;
              console.log(`${CONTEXT_TAG} Push sent to user ${payload.user_id} (${devices.length} devices)`);
            }
          }
        }

        // 6. Mark queue items as sent
        const { error: markError } = await supabase
          .from("alert_queue")
          .update({ sent: true })
          .in("id", queueIds);

        if (markError) {
          console.error(`${CONTEXT_TAG} Failed to mark queue items sent for user ${payload.user_id}:`, markError);
          summary.errors++;
        } else {
          summary.queueMarked += queueIds.length;
        }
      } catch (userErr) {
        console.error(`${CONTEXT_TAG} Error processing user ${payload.user_id}:`, userErr);
        summary.errors++;
      }
    }

    console.log(`${CONTEXT_TAG} Summary:`, summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error", summary }, { status: 500 });
  }
}
