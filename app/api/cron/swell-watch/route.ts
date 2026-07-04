/**
 * GET /api/cron/swell-watch
 *
 * Forward-looking home-break incoming-swell push + email. Disabled by default
 * and allowlist-gated for rollout. Auth: Authorization: Bearer <CRON_SECRET>.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { detectSwellWatch, type SwellWatchEvent } from "@/lib/alerts/swell-watch-detector";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { buildBeachEmailLink } from "@/lib/mailer/email-links";
import {
  getBaseUrl,
  MAIL_FROM,
  MAIL_REPLY_TO,
  resend,
} from "@/lib/mailer/client";
import { SwellWatchEmail } from "@/lib/mailer/templates/SwellWatchEmail";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[swell-watch]";
const NOTIFICATION_TYPE = "swell_watch";
const EMAIL_TYPE = "swell_watch";
const EMAIL_ALERT_TYPE = "swell_watch_email";
const LOOKAHEAD_HOURS = 10 * 24;
const EMAIL_DEDUPE_HOURS = 96;
const SENTRY_MONITOR = {
  slug: "swell-watch",
  schedule: "0 15 * * *",
  maxRuntimeMinutes: 5,
};

interface SwellWatchProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  home_beach_id: string | null;
  timezone?: string | null;
  notif_push_enabled?: boolean | null;
  notif_reminders?: boolean | null;
  notif_email_enabled?: boolean | null;
  notif_forecast_alerts?: boolean | null;
}

interface SwellWatchPayload {
  beach_id: string;
  beach_slug?: string;
  beach_name: string;
  event_start_date: string;
  peak_date: string;
  peak_height_ft: number;
  peak_period_s: number;
  forecast_at: string;
  title: string;
  body: string;
}

interface SwellWatchSelection {
  event: SwellWatchEvent;
  payload: SwellWatchPayload;
  dedupeKey: string;
}

interface SwellWatchRunSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  sent: number;
  duplicates: number;
  emailSent: number;
  testAllowlistActive: boolean;
  skippedCounts: Record<string, number>;
  emailSkippedCounts: Record<string, number>;
  errors: number;
  durationMs: number;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function weekdayName(dateKey: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(new Date(`${dateKey}T12:00:00.000Z`));
  } catch {
    return dateKey;
  }
}

function createSkippedCounts(): Record<string, number> {
  return {
    disabledPrefs: 0,
    noHomeBeach: 0,
    notInAllowlist: 0,
    noBeach: 0,
    noForecast: 0,
    enqueueFailed: 0,
  };
}

function createEmailSkippedCounts(): Record<string, number> {
  return {
    disabledPrefs: 0,
    noEmail: 0,
    claimFailed: 0,
    sendFailed: 0,
  };
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function parseAllowlist(envName: string): Set<string> {
  const raw = process.env[envName] ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

async function loadProfiles(supabase: any): Promise<SwellWatchProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, display_name, home_beach_id, timezone, notif_push_enabled, notif_reminders, notif_email_enabled, notif_forecast_alerts"
    )
    .not("home_beach_id", "is", null);

  if (error) {
    throw new Error(`Failed to query profiles: ${error.message}`);
  }
  return (data ?? []) as SwellWatchProfileRow[];
}

async function loadBeaches(
  supabase: any,
  beachIds: string[]
): Promise<Map<string, Beach>> {
  if (beachIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("beaches")
    .select("*")
    .in("id", beachIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to query beaches: ${error.message}`);
  }

  const byId = new Map<string, Beach>();
  for (const row of (data ?? []) as Beach[]) {
    byId.set(row.id, row);
  }
  return byId;
}

async function loadForecasts(
  supabase: any,
  beachId: string,
  now: Date
): Promise<EnhancedForecastEntity[]> {
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .gte("forecast_at", now.toISOString())
    .lt("forecast_at", horizon.toISOString())
    .order("forecast_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to query forecasts for ${beachId}: ${error.message}`);
  }
  return (data ?? []) as EnhancedForecastEntity[];
}

export function buildSwellWatchCopy(input: {
  beachName: string;
  eventStartDate: string;
  peakDate: string;
  peakHeightFt: number;
  peakPeriodS: number;
  timezone: string;
}): { title: string; body: string } {
  const startDay = weekdayName(input.eventStartDate, input.timezone);
  const peakDay = weekdayName(input.peakDate, input.timezone);
  return {
    title: `Swell incoming — ${input.beachName}`,
    body: `${startDay}: building to ${formatNumber(input.peakHeightFt)} ft @ ${formatNumber(input.peakPeriodS)}s. Peak ${peakDay}.`,
  };
}

function buildSwellWatchEmailSubject(input: {
  beachName: string;
  eventStartDate: string;
  peakHeightFt: number;
  peakPeriodS: number;
  timezone: string;
}): string {
  const startDay = weekdayName(input.eventStartDate, input.timezone);
  return `Swell incoming ${startDay} — ${input.beachName}: ${formatNumber(input.peakHeightFt)} ft @ ${formatNumber(input.peakPeriodS)}s`;
}

function selectAndBuildSwellWatch(input: {
  profile: SwellWatchProfileRow;
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  timezone: string;
  now: Date;
}): SwellWatchSelection | { skipReason: string } {
  const event = detectSwellWatch({
    forecasts: input.forecasts,
    timezone: input.timezone,
    now: input.now,
  });
  if (!event) {
    return { skipReason: "no_event" };
  }

  const copy = buildSwellWatchCopy({
    beachName: input.beach.name,
    eventStartDate: event.eventStartDate,
    peakDate: event.peakDate,
    peakHeightFt: event.peakHeightFt,
    peakPeriodS: event.peakPeriodS,
    timezone: input.timezone,
  });

  return {
    event,
    payload: {
      beach_id: input.beach.id,
      ...(input.beach.slug ? { beach_slug: input.beach.slug } : {}),
      beach_name: input.beach.name,
      event_start_date: event.eventStartDate,
      peak_date: event.peakDate,
      peak_height_ft: event.peakHeightFt,
      peak_period_s: event.peakPeriodS,
      forecast_at: event.peakForecastAt,
      title: copy.title,
      body: copy.body,
    },
    dedupeKey: `${NOTIFICATION_TYPE}:${input.profile.id}:${input.beach.id}:${event.eventStartDate}`,
  };
}

async function claimSwellWatchEmailSlot(
  supabase: SupabaseClient,
  userId: string,
  beachId: string
): Promise<boolean> {
  const { data: claimed, error } = await supabase.rpc(
    "claim_forecast_delivery_slot",
    {
      p_user_id: userId,
      p_beach_id: beachId,
      p_alert_type: EMAIL_ALERT_TYPE,
      p_dedupe_hours: EMAIL_DEDUPE_HOURS,
    }
  );

  if (error) {
    console.error(`${CONTEXT_TAG} Error claiming email slot for ${userId}:`, error);
    return false;
  }

  return claimed === true;
}

async function sendSwellWatchEmail(input: {
  supabase: SupabaseClient;
  profile: SwellWatchProfileRow;
  beach: Beach;
  timezone: string;
  event: SwellWatchEvent;
  rateLimiter: ReturnType<typeof createResendRateLimiter>;
  emailLogger: ReturnType<typeof createEmailLogger>;
  baseUrl: string;
}): Promise<"sent" | "disabledPrefs" | "noEmail" | "claimFailed" | "sendFailed"> {
  if (
    input.profile.notif_email_enabled === false ||
    input.profile.notif_forecast_alerts === false
  ) {
    return "disabledPrefs";
  }

  const email = input.profile.email?.trim();
  if (!email) return "noEmail";

  const claimed = await claimSwellWatchEmailSlot(
    input.supabase,
    input.profile.id,
    input.beach.id
  );
  if (!claimed) return "claimFailed";

  const subject = buildSwellWatchEmailSubject({
    beachName: input.beach.name,
    eventStartDate: input.event.eventStartDate,
    peakHeightFt: input.event.peakHeightFt,
    peakPeriodS: input.event.peakPeriodS,
    timezone: input.timezone,
  });
  const messageInstanceId = crypto.randomUUID();
  const ctaUrl = buildBeachEmailLink({
    origin: input.baseUrl,
    beachSlug: input.beach.slug ?? input.beach.id,
    emailType: EMAIL_TYPE,
    utmMedium: EMAIL_TYPE,
    utmCampaign: EMAIL_TYPE,
    source: "swell_watch_email",
    messageInstanceId,
  });
  const manageUrl = `${input.baseUrl}/settings`;
  const unsubscribeToken = generateEmailUnsubscribeToken(input.profile.id);
  const unsubscribeUrl =
    `${input.baseUrl}/api/alerts/unsubscribe-email?user_id=${input.profile.id}` +
    `&token=${unsubscribeToken}`;

  await input.rateLimiter.throttle();

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to: email,
    subject,
    react: SwellWatchEmail({
      beachName: input.beach.name,
      eventStartDate: input.event.eventStartDate,
      peakDate: input.event.peakDate,
      peakHeightFt: input.event.peakHeightFt,
      peakPeriodS: input.event.peakPeriodS,
      forecastAt: input.event.peakForecastAt,
      timezone: input.timezone,
      ctaUrl,
      manageUrl,
      unsubscribeUrl,
    }),
  });

  if (sendError) {
    console.error(`${CONTEXT_TAG} Email send failed for ${input.profile.id}:`, sendError);
    return "sendFailed";
  }

  await input.emailLogger.logDelivery({
    userId: input.profile.id,
    emailType: EMAIL_TYPE,
    subject,
    bestBeachId: input.beach.id,
    resendMessageId: sendData?.id,
    meta: {
      beach_name: input.beach.name,
      beach_slug: input.beach.slug,
      event_start_date: input.event.eventStartDate,
      peak_date: input.event.peakDate,
      peak_height_ft: input.event.peakHeightFt,
      peak_period_s: input.event.peakPeriodS,
      forecast_at: input.event.peakForecastAt,
      message_instance_id: messageInstanceId,
    },
  });

  return "sent";
}

async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const summary: SwellWatchRunSummary = {
      skipped: false,
      evaluated: 0,
      candidates: 0,
      sent: 0,
      duplicates: 0,
      emailSent: 0,
      testAllowlistActive: false,
      skippedCounts: createSkippedCounts(),
      emailSkippedCounts: createEmailSkippedCounts(),
      errors: 0,
      durationMs: 0,
    };

    if (process.env.SWELL_WATCH_ENABLED !== "true") {
      summary.skipped = true;
      summary.reason = "disabled";
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(summary);
    }

    const allowlist = parseAllowlist("SWELL_WATCH_USER_ALLOWLIST");
    summary.testAllowlistActive = allowlist.size > 0;
    const supabase = createSupabaseServiceRoleClient();
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);
    const baseUrl = getBaseUrl();
    const profiles = await loadProfiles(supabase);
    const eligibleProfiles: SwellWatchProfileRow[] = [];

    for (const profile of profiles) {
      summary.evaluated++;
      if (!profile.home_beach_id) {
        increment(summary.skippedCounts, "noHomeBeach");
        continue;
      }
      if (
        profile.notif_push_enabled === false ||
        profile.notif_reminders === false
      ) {
        increment(summary.skippedCounts, "disabledPrefs");
        continue;
      }
      if (allowlist.size > 0 && !allowlist.has(profile.id)) {
        increment(summary.skippedCounts, "notInAllowlist");
        continue;
      }
      eligibleProfiles.push(profile);
    }

    summary.candidates = eligibleProfiles.length;
    const beachIds = Array.from(
      new Set(
        eligibleProfiles
          .map((profile) => profile.home_beach_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const beachesById = await loadBeaches(supabase, beachIds);
    const now = new Date();

    for (const profile of eligibleProfiles) {
      try {
        const beachId = profile.home_beach_id;
        if (!beachId) continue;
        const beach = beachesById.get(beachId);
        if (!beach) {
          increment(summary.skippedCounts, "noBeach");
          continue;
        }

        const timezone = resolveBeachTimezone(profile.timezone ?? beach.timezone);
        const forecasts = await loadForecasts(supabase, beachId, now);
        if (forecasts.length === 0) {
          increment(summary.skippedCounts, "noForecast");
          continue;
        }

        const selection = selectAndBuildSwellWatch({
          profile,
          beach,
          forecasts,
          timezone,
          now,
        });
        if ("skipReason" in selection) {
          increment(summary.skippedCounts, selection.skipReason);
          continue;
        }

        const enqueueResult = await enqueueNotification(
          {
            type: NOTIFICATION_TYPE,
            recipientUserId: profile.id,
            payload: selection.payload as unknown as Record<string, unknown>,
            dedupeKey: selection.dedupeKey,
          },
          supabase
        );

        if (enqueueResult.enqueued) {
          summary.sent++;
        } else if (enqueueResult.reason === "duplicate") {
          summary.duplicates++;
        } else {
          increment(summary.skippedCounts, "enqueueFailed");
          summary.errors++;
          continue;
        }

        const emailResult = await sendSwellWatchEmail({
          supabase,
          profile,
          beach,
          timezone,
          event: selection.event,
          rateLimiter,
          emailLogger,
          baseUrl,
        });

        if (emailResult === "sent") {
          summary.emailSent++;
        } else {
          increment(summary.emailSkippedCounts, emailResult);
          if (emailResult === "sendFailed") summary.errors++;
        }
      } catch (profileError) {
        console.error(`${CONTEXT_TAG} Error processing ${profile.id}:`, profileError);
        summary.errors++;
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return createSuccessResponse(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/swell-watch",
  _GET,
  SENTRY_MONITOR
);
