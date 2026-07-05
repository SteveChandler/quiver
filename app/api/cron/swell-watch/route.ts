/**
 * GET /api/cron/swell-watch
 *
 * Forward-looking home-break incoming-swell push + email. Disabled by default
 * and allowlist-gated for rollout. Auth: Authorization: Bearer ***
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Beach } from "@/types/database";
import {
  runHomeBeachPushCron,
  type HomeBeachPushProfileRow,
  type HomeBeachPushSelectArgs,
  type HomeBeachPushSelection,
  type HomeBeachPushRunSummary,
} from "@/lib/cron/home-beach-push-runner";
import { withObservedCron } from "@/lib/cron/observability";
import { detectSwellWatch } from "@/lib/alerts/swell-watch-detector";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";
import { buildBeachEmailLink } from "@/lib/mailer/email-links";
import {
  getBaseUrl,
  MAIL_FROM,
  MAIL_REPLY_TO,
  resend,
} from "@/lib/mailer/client";
import { SwellWatchEmail } from "@/lib/mailer/templates/SwellWatchEmail";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";

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

type SwellWatchEmailProfile = HomeBeachPushProfileRow & {
  email?: string | null;
  display_name?: string | null;
  notif_email_enabled?: boolean | null;
  notif_forecast_alerts?: boolean | null;
};

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

type SwellWatchEmailSkipReason =
  | "disabledPrefs"
  | "noEmail"
  | "claimFailed"
  | "sendFailed";

interface SwellWatchEmailSummary extends HomeBeachPushRunSummary {
  emailSent: number;
  emailSkippedCounts: Record<SwellWatchEmailSkipReason, number>;
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

function createEmailSkippedCounts(): Record<SwellWatchEmailSkipReason, number> {
  return {
    disabledPrefs: 0,
    noEmail: 0,
    claimFailed: 0,
    sendFailed: 0,
  };
}

function incrementEmailSkip(
  counts: Record<SwellWatchEmailSkipReason, number>,
  key: SwellWatchEmailSkipReason
): void {
  counts[key] = (counts[key] ?? 0) + 1;
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

function selectAndBuildSwellWatch({
  profile,
  beach,
  forecasts,
  timezone,
  now,
}: HomeBeachPushSelectArgs): HomeBeachPushSelection<SwellWatchPayload> {
  const event = detectSwellWatch({ forecasts, timezone, now });
  if (!event) {
    return { skipReason: "no_event" };
  }

  const copy = buildSwellWatchCopy({
    beachName: beach.name,
    eventStartDate: event.eventStartDate,
    peakDate: event.peakDate,
    peakHeightFt: event.peakHeightFt,
    peakPeriodS: event.peakPeriodS,
    timezone,
  });

  return {
    payload: {
      beach_id: beach.id,
      ...(beach.slug ? { beach_slug: beach.slug } : {}),
      beach_name: beach.name,
      event_start_date: event.eventStartDate,
      peak_date: event.peakDate,
      peak_height_ft: event.peakHeightFt,
      peak_period_s: event.peakPeriodS,
      forecast_at: event.peakForecastAt,
      title: copy.title,
      body: copy.body,
    },
    dedupeKey: `${NOTIFICATION_TYPE}:${profile.id}:${beach.id}:${event.eventStartDate}`,
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
  profile: SwellWatchEmailProfile;
  beach: Beach;
  timezone: string;
  payload: SwellWatchPayload;
  rateLimiter: ReturnType<typeof createResendRateLimiter>;
  emailLogger: ReturnType<typeof createEmailLogger>;
  baseUrl: string;
}): Promise<"sent" | SwellWatchEmailSkipReason> {
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
    eventStartDate: input.payload.event_start_date,
    peakHeightFt: input.payload.peak_height_ft,
    peakPeriodS: input.payload.peak_period_s,
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

  const issuedAt = new Date().toISOString();
  const { data: sendData, error: sendError } = await resend.emails.send({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to: email,
    subject,
    react: SwellWatchEmail({
      beachName: input.beach.name,
      eventStartDate: input.payload.event_start_date,
      peakDate: input.payload.peak_date,
      peakHeightFt: input.payload.peak_height_ft,
      peakPeriodS: input.payload.peak_period_s,
      forecastAt: input.payload.forecast_at,
      issuedAt,
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
      event_start_date: input.payload.event_start_date,
      peak_date: input.payload.peak_date,
      peak_height_ft: input.payload.peak_height_ft,
      peak_period_s: input.payload.peak_period_s,
      forecast_at: input.payload.forecast_at,
      message_instance_id: messageInstanceId,
    },
  });

  return "sent";
}

async function _GET(request: Request): Promise<Response> {
  const rateLimiter = createResendRateLimiter();
  let emailLogger: ReturnType<typeof createEmailLogger> | null = null;
  const baseUrl = getBaseUrl();

  return runHomeBeachPushCron<SwellWatchPayload>(request, {
    contextTag: CONTEXT_TAG,
    enabledEnv: "SWELL_WATCH_ENABLED",
    allowlistEnv: "SWELL_WATCH_USER_ALLOWLIST",
    type: NOTIFICATION_TYPE,
    lookaheadHours: LOOKAHEAD_HOURS,
    profileSelectExtraFields: [
      "email",
      "display_name",
      "notif_email_enabled",
      "notif_forecast_alerts",
    ],
    createAdditionalSummary: () => ({
      emailSent: 0,
      emailSkippedCounts: createEmailSkippedCounts(),
    }),
    selectAndBuild: selectAndBuildSwellWatch,
    afterEnqueue: async ({ supabase, profile, beach, timezone, selection, summary }) => {
      emailLogger ??= createEmailLogger(supabase, CONTEXT_TAG);
      const emailSummary = summary as SwellWatchEmailSummary;
      const emailResult = await sendSwellWatchEmail({
        supabase,
        profile: profile as SwellWatchEmailProfile,
        beach,
        timezone,
        payload: selection.payload,
        rateLimiter,
        emailLogger,
        baseUrl,
      });

      if (emailResult === "sent") {
        emailSummary.emailSent++;
        return;
      }

      incrementEmailSkip(emailSummary.emailSkippedCounts, emailResult);
      if (emailResult === "sendFailed") {
        emailSummary.errors++;
      }
    },
  });
}

export const GET = withObservedCron(
  "/api/cron/swell-watch",
  _GET,
  SENTRY_MONITOR
);
