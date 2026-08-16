/**
 * Sentry Cron Monitoring Helpers
 *
 * Wraps cron handlers with Sentry check-ins so we get alerted
 * when Vercel cron scheduling silently stops (e.g. during rapid deployments).
 *
 * Monitors auto-create in Sentry on first check-in.
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

export type CronMonitorConfig = {
  /** Unique slug identifying this monitor in Sentry (e.g. "forecast-enhanced-shard-0") */
  slug: string;
  /** Crontab schedule string (e.g. "0 *\/2 * * *") */
  schedule: string;
  /** Max expected runtime in minutes (default: 6, allows for 5-min Vercel limit + buffer) */
  maxRuntimeMinutes?: number;
  /** Minutes before expected time that check-in is accepted (default: 10) */
  checkinMarginMinutes?: number;
};

/**
 * Start a Sentry cron check-in (status: in_progress).
 * Returns a checkInId to pass to `completeCronCheckIn`.
 */
export function startCronCheckIn(config: CronMonitorConfig): string {
  try {
    return Sentry.captureCheckIn(
      {
        monitorSlug: config.slug,
        status: "in_progress",
      },
      {
        schedule: { type: "crontab", value: config.schedule },
        checkinMargin: config.checkinMarginMinutes ?? 10,
        maxRuntime: config.maxRuntimeMinutes ?? 6,
        timezone: "Etc/UTC",
      }
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Sentry Cron] Failed to start check-in", config.slug, err);
    }
    return "";
  }
}

/**
 * Complete a Sentry cron check-in with ok or error status.
 */
export async function completeCronCheckIn(
  checkInId: string,
  slug: string,
  status: "ok" | "error",
  durationMs?: number,
): Promise<void> {
  if (!checkInId) return;
  try {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: slug,
      status,
      ...(durationMs !== undefined ? { duration: durationMs / 1000 } : {}),
    });
    await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Sentry Cron] Failed to complete check-in", slug, status, err);
    }
  }
}

/**
 * Schedules for the 4-shard enhanced forecast sync configuration.
 * Must match vercel.json entries.
 */
const ENHANCED_SHARD_SCHEDULES: Record<number, string> = {
  0: "0 */2 * * *",
  1: "30 */2 * * *",
  2: "0 1-23/2 * * *",
  3: "30 1-23/2 * * *",
};

/**
 * Get the Sentry monitor slug for an enhanced forecast shard.
 */
export function getEnhancedShardMonitorSlug(shard: number | undefined): string {
  return shard !== undefined
    ? `forecast-enhanced-shard-${shard}`
    : "forecast-enhanced-unsharded";
}

/**
 * Get the schedule for an enhanced forecast shard.
 * Falls back to every-2-hours if shard is unknown.
 */
export function getEnhancedShardSchedule(shard: number | undefined): string {
  if (shard !== undefined && shard in ENHANCED_SHARD_SCHEDULES) {
    return ENHANCED_SHARD_SCHEDULES[shard];
  }
  return "0 */2 * * *";
}
