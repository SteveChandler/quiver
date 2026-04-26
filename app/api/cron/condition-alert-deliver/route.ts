// app/api/cron/condition-alert-deliver/route.ts
//
// Delivery cron — runs every 15 minutes.
// Reads due items from alert_queue, consolidates per user, sends email + push.
//
// Hardened (Task 4) with:
//   - ALERTS_DELIVERY_ENABLED kill switch (env var, default off)
//   - ALERTS_DELIVERY_USER_ALLOWLIST (comma-separated user_ids; empty = all)
//   - Per-(queue_id, channel) row in `alert_delivery_attempts` for every
//     decision (sent, skipped_*, failed_*).
//
// The kill-switch path STILL marks queue rows sent so the queue can't grow
// unboundedly while delivery is paused. Throttle (cooldown + cap) lands in
// Task 5.

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
import { sendPushNotifications } from "@/lib/services/push-notifications";
import { generateDisableToken } from "@/lib/alerts/email-token";
import type { AttemptStatus } from "@/lib/alerts/throttle";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CONTEXT_TAG = "[condition-alert-deliver]";

type Channel = "email" | "push";

export async function GET(request: Request): Promise<NextResponse> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();
  const summary = { processed: 0, emailSent: 0, pushSent: 0, queueMarked: 0, errors: 0 };

  // Env-driven gates. Default OFF for safety; staged rollout via allowlist.
  const deliveryEnabled = process.env.ALERTS_DELIVERY_ENABLED === "true";
  const allowlistRaw = process.env.ALERTS_DELIVERY_USER_ALLOWLIST ?? "";
  const allowlist = new Set(
    allowlistRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  async function recordAttempt(args: {
    queueId: string;
    ruleId: string;
    userId: string;
    channel: Channel;
    status: AttemptStatus;
    skipReason?: string;
  }): Promise<void> {
    const { error } = await supabase.from("alert_delivery_attempts").insert({
      queue_id: args.queueId,
      rule_id: args.ruleId,
      user_id: args.userId,
      channel: args.channel,
      status: args.status,
      skip_reason: args.skipReason ?? null,
    });
    if (error) {
      console.error(`${CONTEXT_TAG} attempt-write-failed:`, error.message, args);
    }
  }

  try {
    // 1. Fetch due, unsent queue items with rule + beach embeddings.
    //    Profiles are fetched in a separate query because `alert_queue.user_id`
    //    has a FK to `auth.users(id)` — not `profiles(id)` — so PostgREST
    //    cannot resolve a `profiles!inner(...)` embedding and returns PGRST200,
    //    500ing the whole cron (blocks all alert types, including similarity).
    const { data: rawItems, error: queueError } = await supabase
      .from("alert_queue")
      .select(`
        id, user_id, rule_id, beach_id, alert_date, send_at,
        window_start, window_end, best_hour, conditions_snapshot, sent,
        alert_rules!inner(name, notify_email, notify_push),
        beaches!inner(name, timezone)
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

    // 3. Fetch profile data for the queue's user set in a single query.
    //    profiles.id is a 1:1 mirror of auth.users.id, so we can key by user_id.
    type ProfileRow = {
      id: string;
      email: string;
      display_name: string | null;
      notif_email_enabled: boolean;
      notif_push_enabled: boolean;
    };
    const userIds = Array.from(new Set(rawItems.map((r) => r.user_id)));
    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, display_name, notif_email_enabled, notif_push_enabled")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    const profilesByUser = new Map<string, ProfileRow>();
    for (const row of (profileRows ?? []) as ProfileRow[]) {
      profilesByUser.set(row.id, row);
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

      // Per-user contributing queue items, used for per-(queue_id × channel) attempt rows.
      const contributingItems = items.filter((i) => i.user_id === payload.user_id);
      const queueIds = contributingItems.map((i) => i.id);

      // Precompute channel-aware contributing items for attempts. Each item
      // contributes one row per channel that its rule asked for.
      const emailItems = contributingItems.filter((i) => i.notify_email);
      const pushItems = contributingItems.filter((i) => i.notify_push);

      try {
        // ---- Email branch ----
        if (emailItems.length > 0) {
          // Gate: kill switch
          if (!deliveryEnabled) {
            for (const item of emailItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "email",
                status: "skipped_disabled",
                skipReason: "ALERTS_DELIVERY_ENABLED=false",
              });
            }
          } else if (allowlist.size > 0 && !allowlist.has(payload.user_id)) {
            for (const item of emailItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "email",
                status: "skipped_allowlist",
                skipReason: `user not in ALERTS_DELIVERY_USER_ALLOWLIST`,
              });
            }
          } else if (!profile.notif_email_enabled) {
            for (const item of emailItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "email",
                status: "skipped_channel_disabled",
                skipReason: "profile.notif_email_enabled=false",
              });
            }
          } else {
            // Dedup: only send if no email delivery recorded today
            const { data: existingEmail } = await supabase
              .from("alert_deliveries")
              .select("id")
              .eq("user_id", payload.user_id)
              .eq("alert_date", payload.alert_date)
              .eq("channel", "email")
              .limit(1);

            if (existingEmail && existingEmail.length > 0) {
              for (const item of emailItems) {
                await recordAttempt({
                  queueId: item.id,
                  ruleId: item.rule_id,
                  userId: payload.user_id,
                  channel: "email",
                  status: "skipped_dedup_collision",
                  skipReason: "alert_deliveries row already exists for (user, date, email)",
                });
              }
            } else {
              const emailMatches = payload.matches
                .filter((m) => m.notify_email)
                .map((m) => ({ ...m, disable_token: generateDisableToken(m.rule_id) }));
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
                const errorMessage = (sendError as { message?: string })?.message ?? String(sendError);
                for (const item of emailItems) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel: "email",
                    status: "failed_provider",
                    skipReason: errorMessage,
                  });
                }
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

                for (const item of emailItems) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel: "email",
                    status: "sent",
                  });
                }
              }
            }
          }
        }

        // ---- Push branch ----
        if (pushItems.length > 0) {
          if (!deliveryEnabled) {
            for (const item of pushItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "push",
                status: "skipped_disabled",
                skipReason: "ALERTS_DELIVERY_ENABLED=false",
              });
            }
          } else if (allowlist.size > 0 && !allowlist.has(payload.user_id)) {
            for (const item of pushItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "push",
                status: "skipped_allowlist",
                skipReason: `user not in ALERTS_DELIVERY_USER_ALLOWLIST`,
              });
            }
          } else if (!profile.notif_push_enabled) {
            for (const item of pushItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "push",
                status: "skipped_channel_disabled",
                skipReason: "profile.notif_push_enabled=false",
              });
            }
          } else {
            const { data: existingPush } = await supabase
              .from("alert_deliveries")
              .select("id")
              .eq("user_id", payload.user_id)
              .eq("alert_date", payload.alert_date)
              .eq("channel", "push")
              .limit(1);

            if (existingPush && existingPush.length > 0) {
              for (const item of pushItems) {
                await recordAttempt({
                  queueId: item.id,
                  ruleId: item.rule_id,
                  userId: payload.user_id,
                  channel: "push",
                  status: "skipped_dedup_collision",
                  skipReason: "alert_deliveries row already exists for (user, date, push)",
                });
              }
            } else {
              const { data: devices } = await supabase
                .from("user_devices")
                .select("device_token")
                .eq("user_id", payload.user_id);

              if (!devices || devices.length === 0) {
                for (const item of pushItems) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel: "push",
                    status: "skipped_no_device",
                    skipReason: "user has no registered devices",
                  });
                }
              } else {
                const pushMatches = payload.matches.filter((m) => m.notify_push);
                const { title, body, data } = formatPushNotification(pushMatches);
                const messages = devices.map((d) => ({
                  to: d.device_token,
                  title,
                  body,
                  data,
                }));

                try {
                  await sendPushNotifications(messages);

                  await supabase.from("alert_deliveries").insert({
                    user_id: payload.user_id,
                    alert_date: payload.alert_date,
                    channel: "push",
                    payload: { match_count: pushMatches.length, device_count: devices.length },
                  });

                  summary.pushSent++;
                  console.log(`${CONTEXT_TAG} Push sent to user ${payload.user_id} (${devices.length} devices)`);

                  for (const item of pushItems) {
                    await recordAttempt({
                      queueId: item.id,
                      ruleId: item.rule_id,
                      userId: payload.user_id,
                      channel: "push",
                      status: "sent",
                    });
                  }
                } catch (pushErr) {
                  console.error(`${CONTEXT_TAG} Push send failed for user ${payload.user_id}:`, pushErr);
                  summary.errors++;
                  const errorMessage = pushErr instanceof Error ? pushErr.message : String(pushErr);
                  for (const item of pushItems) {
                    await recordAttempt({
                      queueId: item.id,
                      ruleId: item.rule_id,
                      userId: payload.user_id,
                      channel: "push",
                      status: "failed_provider",
                      skipReason: errorMessage,
                    });
                  }
                }
              }
            }
          }
        }

        // 6. Mark queue items as sent (always — even when delivery is disabled —
        //    so the queue cannot accumulate forever during a pause).
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
