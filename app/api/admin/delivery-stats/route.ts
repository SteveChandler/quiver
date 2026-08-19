import { NextRequest } from "next/server";
import {
  withAdminAuth,
  createSuccessResponse,
} from "@/lib/middleware/api-wrappers";
import { aggregateByKey, sumByField } from "@/lib/utils/aggregation-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Configuration constants
const DEFAULT_STATS_DAYS = 7;
const MAX_STATS_DAYS = 30; // Limit to prevent excessive data transfer
const MAX_RECENT_RUNS = 10;
const MAX_DIGEST_RUNS_QUERY = 50;

/**
 * GET /api/admin/delivery-stats
 *
 * Returns email and push notification delivery statistics.
 * Query params: ?days=7 (default 7, max 30)
 */
export const GET = withAdminAuth(
  async (request: NextRequest, { supabase }) => {
    // Parse and validate days parameter
    const daysParam = request.nextUrl.searchParams.get("days");
    const parsedDays = daysParam ? parseInt(daysParam, 10) : DEFAULT_STATS_DAYS;
    const days = Number.isNaN(parsedDays)
      ? DEFAULT_STATS_DAYS
      : Math.min(Math.max(parsedDays, 1), MAX_STATS_DAYS);
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Parallel queries for efficiency
    const [
      digestRunsResult,
      emailLogsResult,
      pushLogsResult,
      deviceCountResult,
      activeLegacyCountResult,
    ] = await Promise.all([
      // Recent digest runs
      supabase
        .from("digest_run_stats")
        .select(
          "id, run_started_at, run_completed_at, status, duration_ms, eligible_users, emails_sent, emails_sent_quick, push_sent, push_failed, push_no_tokens",
        )
        .gte("run_started_at", since)
        .order("run_started_at", { ascending: false })
        .limit(MAX_DIGEST_RUNS_QUERY),

      // Email counts by type
      supabase
        .from("email_send_log")
        .select("email_type, local_date")
        .gte("sent_at", since),

      // Push notification counts by status (cast: table missing from generated types)
      (supabase as any)
        .from("push_notification_log")
        .select("notification_type, status, sent_at")
        .gte("sent_at", since) as Promise<{
        data: Array<{
          notification_type: string;
          status: string;
          sent_at: string;
        }> | null;
        error: unknown;
      }>,

      // Total active devices, with adoption state retained for rollout visibility.
      supabase
        .from("user_devices")
        .select("platform", { count: "exact" })
        .is("retired_at", null),

      supabase
        .from("user_devices")
        .select("id", { count: "exact", head: true })
        .is("retired_at", null)
        .is("installation_id", null),
    ]);

    if (deviceCountResult.error) {
      throw new Error(
        `Failed to count active devices: ${String(deviceCountResult.error)}`,
      );
    }
    if (activeLegacyCountResult.error) {
      throw new Error(
        `Failed to count active legacy devices: ${String(activeLegacyCountResult.error)}`,
      );
    }
    if (
      deviceCountResult.count == null ||
      activeLegacyCountResult.count == null
    ) {
      throw new Error("Active device adoption counts were unavailable");
    }

    // Aggregate stats using utility functions
    const emailsByType = aggregateByKey(
      emailLogsResult.data,
      (log) => log.email_type,
    );
    const emailsByDate = aggregateByKey(
      emailLogsResult.data,
      (log) => log.local_date,
    );
    const pushByStatus = aggregateByKey(
      pushLogsResult.data,
      (log) => log.status,
    );
    const pushByType = aggregateByKey(
      pushLogsResult.data,
      (log) => log.notification_type,
    );
    const activeDeviceRows = (deviceCountResult.data ?? []) as Array<{
      platform: string | null;
    }>;
    const devicesByPlatform = aggregateByKey(
      activeDeviceRows,
      (device) => device.platform ?? "unknown",
    );
    const activeLegacy = activeLegacyCountResult.count ?? 0;
    const activeDeviceTotal = deviceCountResult.count ?? 0;
    const activeIdentified = Math.max(0, activeDeviceTotal - activeLegacy);

    const stats = {
      period: { days, since },

      digestRuns: {
        total: digestRunsResult.data?.length || 0,
        recent: digestRunsResult.data?.slice(0, MAX_RECENT_RUNS) || [],
        totals: {
          emailsSent: sumByField(digestRunsResult.data, (r) => r.emails_sent),
          emailsSentQuick: sumByField(
            digestRunsResult.data,
            (r) => r.emails_sent_quick,
          ),
          pushSent: sumByField(digestRunsResult.data, (r) => r.push_sent),
          pushFailed: sumByField(digestRunsResult.data, (r) => r.push_failed),
        },
      },

      emails: {
        total: emailLogsResult.data?.length || 0,
        byType: emailsByType,
        byDate: emailsByDate,
      },

      pushNotifications: {
        total: pushLogsResult.data?.length || 0,
        byStatus: pushByStatus,
        byType: pushByType,
      },

      devices: {
        total: deviceCountResult.count || 0,
        byPlatform: devicesByPlatform,
        activeIdentified,
        activeLegacy,
        identifiedAdoptionPercentage:
          activeDeviceTotal > 0
            ? Math.round((activeIdentified / activeDeviceTotal) * 10000) / 100
            : null,
      },

      generatedAt: new Date().toISOString(),
    };

    return createSuccessResponse(stats);
  },
  { errorMessage: "Failed to fetch delivery statistics" },
);
