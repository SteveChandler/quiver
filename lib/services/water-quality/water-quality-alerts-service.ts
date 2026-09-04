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
import { enqueueNotification } from "@/lib/notifications/enqueue";

import { currentWaterQuality } from "./current-status";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";

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

// Phase 3e: quiet-hours and producer-level dedup are now handled by the
// notifications-deliver worker via the registry's `quietHours` config and
// the partial unique index on (recipient_user_id, type, dedupe_key).

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

  // A closure is unambiguously more urgent than an advisory. The worker
  // rebuilds the user-facing title/body from `status` via the registry's
  // buildPushPayload, so this copy only needs to keep the same severity
  // ordering for any caller that reads it directly.
  if (status === "closure") {
    return {
      title: "Beach Closed",
      body: `High bacteria levels at ${beachName} — don't enter the water`,
    };
  }

  if (status === "advisory") {
    return {
      title: "Water Advisory",
      body: `Elevated bacteria levels detected at ${beachName}`,
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

  // County alerts own covered beaches; sample transitions must not send stale alerts or all-clears.
  const changed = (await currentWaterQuality((changedBeaches || []) as ChangedBeachRow[], supabase as unknown as WaterQualityHoldClient))
    .filter((row) => row.status !== "unknown" && !row.county_advisory_status);
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

  // 4) Find eligible users: home_beach_id in changed set + wq notifs on. The
  //    delivery worker applies the per-channel master prefs (push/in_app), so
  //    the producer only gates on the per-type opt-in here.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, home_beach_id, notif_water_quality, is_mock, timezone")
    .in("home_beach_id", changedBeachIds);

  if (profilesError) {
    const msg = profilesError.message || "Failed to load eligible profiles";
    result.errors.push(msg);
    return result;
  }

  const allProfiles = (profiles || []) as EligibleProfileRow[];

  // Gate only on the per-type opt-in (notif_water_quality). The channel set is
  // now push + in_app, and the notifications-deliver worker applies each
  // channel's master pref per-channel (push -> notif_push_enabled,
  // in_app -> notif_inapp_enabled). Pre-excluding on notif_push_enabled here
  // would wrongly drop users who have push off but in-app on — they should
  // still get the inbox row. Push-off users are still correctly skipped on the
  // push channel by the worker.
  const eligibleProfiles = allProfiles.filter(
    (p) =>
      !p.is_mock &&
      p.notif_water_quality === true &&
      p.home_beach_id !== null
  );

  if (eligibleProfiles.length === 0) {
    return result;
  }

  // 5) Build a map of beach_id -> wq row for efficient lookup
  const wqByBeachId = new Map<string, ChangedBeachRow>();
  changed.forEach((r) => wqByBeachId.set(r.beach_id, r));

  // 6) Phase 3e: enqueue per eligible user. The notifications-deliver worker
  //    handles devices/FCM, in-app inbox row, master+per-type prefs, quiet
  //    hours, and same-day dedup via the partial unique index.
  for (const profile of eligibleProfiles) {
    const beachId = profile.home_beach_id!;
    const wqRow = wqByBeachId.get(beachId);
    const beach = beachById.get(beachId);

    if (!wqRow || !beach) {
      result.notificationsSkipped++;
      continue;
    }

    // Skip if no notification content for this status transition.
    // (buildNotificationContent returns null for non-notify transitions;
    // the worker rebuilds title/body from `status` so we only need the
    // transition gate here, not the copy.)
    const notifContent = buildNotificationContent(
      wqRow.status,
      wqRow.previous_status,
      beach.name || "Your home beach"
    );

    if (!notifContent) {
      result.notificationsSkipped++;
      continue;
    }

    const localDate = new Date(wqRow.status_changed_at)
      .toISOString()
      .slice(0, 10);

    try {
      const enqueueResult = await enqueueNotification({
        type: "water_quality",
        recipientUserId: profile.id,
        entityType: "beach",
        entityId: beachId,
        payload: {
          beach_id: beachId,
          beach_name: beach.name || "Your home beach",
          beach_slug: beach.slug || "",
          status: wqRow.status,
          previous_status: wqRow.previous_status,
          status_changed_at: wqRow.status_changed_at,
        },
        dedupeKey: `water_quality:${profile.id}:${beachId}:${localDate}`,
      });

      if (enqueueResult.enqueued) {
        result.notificationsSent++;
      } else if (enqueueResult.reason === "duplicate") {
        result.notificationsSkipped++;
      } else {
        console.error(
          `[WQAlerts] Enqueue failed for user ${profile.id}:`,
          enqueueResult
        );
        result.errors.push(`user ${profile.id}: ${enqueueResult.reason}`);
        result.notificationsSkipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown enqueue error";
      console.error(`[WQAlerts] Enqueue threw for user ${profile.id}:`, msg);
      result.errors.push(`user ${profile.id}: ${msg}`);
      result.notificationsSkipped++;
    }
  }

  return result;
}
