/**
 * Water Quality Alert Service (Push)
 *
 * Evaluates recent beach_water_quality status changes and sends push
 * notifications to users who have the affected beach as their home beach.
 *
 * Design constraints:
 * - Status-change-only: only fires when status_changed_at is within the last 24h
 * - Recovery alerts: sends "All Clear" when status transitions back to 'good'
 *   from a previous advisory or closure
 * - Dedup: at most 1 alert/day per user+beach combo (checked via notifications table)
 * - Quiet hours: suppress if user's local time is between 10PM–4AM
 * - Mock users are always skipped
 */

import type { SupabaseServiceClient } from "@/types/supabase";
import { sendPushNotification } from "@/lib/services/push-notifications";
import { getLocalHour, DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";

type WaterQualityStatus = "good" | "advisory" | "closure" | "unknown";

type ChangedBeachRow = {
  id: string;
  beach_id: string;
  status: WaterQualityStatus;
  previous_status: WaterQualityStatus | null;
  status_changed_at: string;
};

type EligibleProfileRow = {
  id: string;
  home_beach_id: string | null;
  notif_push_enabled: boolean;
  notif_water_quality: boolean;
  is_mock: boolean;
  timezone: string | null;
};

type BeachRow = {
  id: string;
  slug: string | null;
  name: string | null;
};

export interface AlertResult {
  beachesWithChanges: number;
  notificationsSent: number;
  notificationsSkipped: number;
  errors: string[];
}

// Quiet hours: suppress notifications between 10 PM and 4 AM local time
const QUIET_HOURS_START = 22; // 10 PM
const QUIET_HOURS_END = 4;    // 4 AM

function isHourInQuietHours(hour: number): boolean {
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

function isWithinQuietHours(timezone: string | null, now: Date = new Date()): boolean {
  const tz = timezone || DEFAULT_TIMEZONE;
  const localHour = getLocalHour(now, tz);
  return isHourInQuietHours(localHour);
}

function buildNotificationContent(
  status: WaterQualityStatus,
  previousStatus: WaterQualityStatus | null,
  beachName: string
): { title: string; body: string } | null {
  // Recovery: good after a previous advisory or closure
  if (
    status === "good" &&
    (previousStatus === "advisory" || previousStatus === "closure")
  ) {
    return {
      title: "All Clear",
      body: `Water quality returned to safe levels at ${beachName}`,
    };
  }

  if (status === "advisory") {
    return {
      title: "Water Advisory",
      body: `Elevated bacteria levels detected at ${beachName}`,
    };
  }

  if (status === "closure") {
    return {
      title: "Water Quality Alert",
      body: `Health advisory issued at ${beachName}`,
    };
  }

  // No notification for 'good' without a prior advisory/closure, or 'unknown'
  return null;
}

export async function processWaterQualityAlerts(
  supabase: SupabaseServiceClient
): Promise<AlertResult> {
  const result: AlertResult = {
    beachesWithChanges: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    errors: [],
  };

  // 1) Find beaches whose status changed in the last 24 hours
  //    (exclude 'unknown' — those have no actionable notification content)
  const { data: changedBeaches, error: beachWqError } = await supabase
    .from("beach_water_quality")
    .select("id, beach_id, status, previous_status, status_changed_at")
    .gt("status_changed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .neq("status", "unknown");

  if (beachWqError) {
    const msg = beachWqError.message || "Failed to query beach_water_quality";
    result.errors.push(msg);
    return result;
  }

  const changed = (changedBeaches || []) as ChangedBeachRow[];
  result.beachesWithChanges = changed.length;

  if (changed.length === 0) {
    return result;
  }

  // 2) Collect the unique beach IDs that changed
  const changedBeachIds = changed.map((r) => r.beach_id);

  // 3) Fetch beach names and slugs for notification copy and deep-link
  const { data: beaches, error: beachesError } = await supabase
    .from("beaches")
    .select("id, slug, name")
    .in("id", changedBeachIds);

  if (beachesError) {
    const msg = beachesError.message || "Failed to load beach rows";
    result.errors.push(msg);
    return result;
  }

  const beachById = new Map<string, BeachRow>();
  (beaches || []).forEach((b: BeachRow) => beachById.set(b.id, b));

  // 4) Find eligible users: home_beach_id in changed set + push enabled + wq notifs on
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, home_beach_id, notif_push_enabled, notif_water_quality, is_mock, timezone")
    .in("home_beach_id", changedBeachIds);

  if (profilesError) {
    const msg = profilesError.message || "Failed to load eligible profiles";
    result.errors.push(msg);
    return result;
  }

  const allProfiles = (profiles || []) as EligibleProfileRow[];

  // Filter to users who have opted in and are not mocks
  const eligibleProfiles = allProfiles.filter(
    (p) =>
      !p.is_mock &&
      p.notif_push_enabled === true &&
      p.notif_water_quality === true &&
      p.home_beach_id !== null
  );

  if (eligibleProfiles.length === 0) {
    return result;
  }

  // 5) Build a map of beach_id -> wq row for efficient lookup
  const wqByBeachId = new Map<string, ChangedBeachRow>();
  changed.forEach((r) => wqByBeachId.set(r.beach_id, r));

  // 6) Dedup: fetch today's water_quality_alert notifications for these users
  //    We check the notifications table for records created today (UTC) to prevent
  //    sending duplicate alerts if the cron fires multiple times within a day.
  const eligibleUserIds = eligibleProfiles.map((p) => p.id);
  const todayUtcStart = new Date();
  todayUtcStart.setUTCHours(0, 0, 0, 0);

  const { data: todayNotifs, error: notifsError } = await supabase
    .from("notifications")
    .select("user_id, data")
    .eq("type", "water_quality_alert")
    .in("user_id", eligibleUserIds)
    .gte("created_at", todayUtcStart.toISOString());

  if (notifsError) {
    // Non-fatal: log and continue without dedup (prefer over-notification to silence)
    console.warn("[WQAlerts] Failed to load today's notifications for dedup:", notifsError);
  }

  // Build a Set of "userId|beachId" combos already notified today
  const alreadyNotifiedToday = new Set<string>();
  (todayNotifs || []).forEach((n) => {
    const data = n.data as Record<string, unknown> | null;
    const beachId = data?.beach_id as string | undefined;
    if (beachId) {
      alreadyNotifiedToday.add(`${n.user_id}|${beachId}`);
    }
  });

  // 7) Process each eligible user
  const now = new Date();

  for (const profile of eligibleProfiles) {
    const beachId = profile.home_beach_id!;
    const wqRow = wqByBeachId.get(beachId);
    const beach = beachById.get(beachId);

    if (!wqRow || !beach) {
      result.notificationsSkipped++;
      continue;
    }

    // Skip if no notification content for this status transition
    const notifContent = buildNotificationContent(
      wqRow.status,
      wqRow.previous_status,
      beach.name || "Your home beach"
    );

    if (!notifContent) {
      result.notificationsSkipped++;
      continue;
    }

    // Quiet hours check
    if (isWithinQuietHours(profile.timezone, now)) {
      console.info(
        `[WQAlerts] Skipping notification for user ${profile.id} - quiet hours ` +
          `(tz: ${profile.timezone || DEFAULT_TIMEZONE})`
      );
      result.notificationsSkipped++;
      continue;
    }

    // Dedup: skip if already sent for this user+beach today
    const dedupeKey = `${profile.id}|${beachId}`;
    if (alreadyNotifiedToday.has(dedupeKey)) {
      result.notificationsSkipped++;
      continue;
    }

    // 8) Send push notification
    try {
      const pushResult = await sendPushNotification({
        userIds: [profile.id],
        title: notifContent.title,
        body: notifContent.body,
        data: {
          type: "water_quality_alert",
          beach_id: beachId,
          beach_slug: beach.slug || "",
          status: wqRow.status,
          url: `/beach/${beach.slug}`,
        },
      });

      // If Firebase is unconfigured or no device tokens, count as skipped (not an error)
      if (pushResult.success === 0 && pushResult.failed === 0) {
        result.notificationsSkipped++;
        continue;
      }

      if (pushResult.failed > 0) {
        result.notificationsSkipped++;
        continue;
      }

      // 9) Record in-app notification (non-fatal if it fails)
      const { error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id: profile.id,
          type: "water_quality_alert",
          data: {
            beach_id: beachId,
            beach_slug: beach.slug,
            beach_name: beach.name,
            status: wqRow.status,
            previous_status: wqRow.previous_status,
            title: notifContent.title,
            body: notifContent.body,
          },
        });

      if (insertError) {
        console.warn(
          `[WQAlerts] Failed to insert notification record for user ${profile.id}:`,
          insertError
        );
        // Still count as sent since push succeeded
      } else {
        // Mark as notified in our local dedup set to guard against
        // the rare case of a user appearing twice in the profile list
        alreadyNotifiedToday.add(dedupeKey);
      }

      result.notificationsSent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown push error";
      console.error(`[WQAlerts] Push failed for user ${profile.id}:`, msg);
      result.errors.push(`user ${profile.id}: ${msg}`);
      result.notificationsSkipped++;
    }
  }

  return result;
}
