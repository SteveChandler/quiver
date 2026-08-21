/**
 * GET /api/cron/trial-invitation-email
 *
 * One-time invitation for engaged free users to start a Quiver Pro trial.
 * The feature gate keeps the warm-backlog flush under operator control.
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  sendEmail,
  MAIL_FROM,
  MAIL_REPLY_TO,
  getBaseUrl,
} from "@/lib/mailer/client";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { filterSuppressedRecipients } from "@/lib/email/suppression";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { generateTrialInvitationEmail } from "@/lib/mailer/trial-invitation-email";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[trial-invitation-email]";
const EMAIL_TYPE = "trial_invitation";
const MIN_SIGNUP_AGE_DAYS = 3;
const MAX_SENDS_PER_RUN = 15;
const QUERY_CHUNK_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string;
  created_at: string;
}

interface Candidate {
  user_id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string;
  signup_at: string;
}

interface RunSummary {
  enabled: true;
  candidates: number;
  sent: number;
  errors: number;
  durationMs: number;
  skipped: {
    entitlement: number;
    alreadySent: number;
    noEngagement: number;
    suppressed: number;
    overCap: number;
    sendFailed: number;
  };
}

function emptySummary(): RunSummary {
  return {
    enabled: true,
    candidates: 0,
    sent: 0,
    errors: 0,
    durationMs: 0,
    skipped: {
      entitlement: 0,
      alreadySent: 0,
      noEngagement: 0,
      suppressed: 0,
      overCap: 0,
      sendFailed: 0,
    },
  };
}

async function selectProfiles(
  supabase: SupabaseClient,
  now: number
): Promise<ProfileRow[]> {
  const oldestAllowedSignup = new Date(
    now - MIN_SIGNUP_AGE_DAYS * DAY_MS
  ).toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, home_beach_id, created_at")
    .not("onboarding_completed_at", "is", null)
    .not("home_beach_id", "is", null)
    .not("email", "is", null)
    // NPC/bot profiles get sessions written by the npc-activity cron, so they
    // pass the engagement gate; 7 matched every other audience filter when
    // this was probed on 2026-08-21. Bots never get campaign email.
    .eq("is_mock", false)
    .eq("notif_email_enabled", true)
    .lte("created_at", oldestAllowedSignup)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to query profiles: ${error.message}`);
  }

  return (data ?? []) as unknown as ProfileRow[];
}

async function selectUserIds(
  supabase: SupabaseClient,
  table: "user_entitlements" | "email_send_log" | "favorite_beaches" | "sessions" | "alert_rules",
  userIds: string[],
  emailType?: string
): Promise<Set<string>> {
  const found = new Set<string>();

  for (let offset = 0; offset < userIds.length; offset += QUERY_CHUNK_SIZE) {
    const chunk = userIds.slice(offset, offset + QUERY_CHUNK_SIZE);
    let query = supabase.from(table).select("user_id").in("user_id", chunk);
    if (emailType) {
      query = query.eq("email_type", emailType);
    }
    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query ${table}: ${error.message}`);
    }

    for (const row of data ?? []) {
      found.add(row.user_id as string);
    }
  }

  return found;
}

async function buildCandidates(
  supabase: SupabaseClient,
  profiles: ProfileRow[],
  summary: RunSummary
): Promise<Candidate[]> {
  if (profiles.length === 0) return [];

  const profileIds = profiles.map((profile) => profile.id);
  const entitledIds = await selectUserIds(
    supabase,
    "user_entitlements",
    profileIds
  );
  summary.skipped.entitlement = entitledIds.size;

  const withoutEntitlements = profiles.filter(
    (profile) => !entitledIds.has(profile.id)
  );
  if (withoutEntitlements.length === 0) return [];

  const unentitledIds = withoutEntitlements.map((profile) => profile.id);
  const alreadySentIds = await selectUserIds(
    supabase,
    "email_send_log",
    unentitledIds,
    EMAIL_TYPE
  );
  summary.skipped.alreadySent = alreadySentIds.size;

  const unsentProfiles = withoutEntitlements.filter(
    (profile) => !alreadySentIds.has(profile.id)
  );
  if (unsentProfiles.length === 0) return [];

  const unsentIds = unsentProfiles.map((profile) => profile.id);
  const engagedIds = new Set<string>();
  for (const table of [
    "favorite_beaches",
    "sessions",
    "alert_rules",
  ] as const) {
    const tableIds = await selectUserIds(supabase, table, unsentIds);
    for (const userId of tableIds) engagedIds.add(userId);
  }

  const engagedProfiles = unsentProfiles.filter((profile) =>
    engagedIds.has(profile.id)
  );
  summary.skipped.noEngagement = unsentProfiles.length - engagedProfiles.length;

  const candidates: Candidate[] = engagedProfiles.map((profile) => ({
    user_id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    home_beach_id: profile.home_beach_id,
    signup_at: profile.created_at,
  }));
  const unsuppressed = await filterSuppressedRecipients(supabase, candidates);
  summary.skipped.suppressed = candidates.length - unsuppressed.length;
  summary.candidates = unsuppressed.length;
  summary.skipped.overCap = Math.max(
    0,
    unsuppressed.length - MAX_SENDS_PER_RUN
  );

  return unsuppressed.slice(0, MAX_SENDS_PER_RUN);
}

async function resolveBeachName(
  supabase: SupabaseClient,
  beachId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("beaches")
    .select("name")
    .eq("id", beachId)
    .maybeSingle();
  return data?.name ?? null;
}

async function runEnabled(startTime: number): Promise<{ summary: RunSummary }> {
  const supabase = await createSupabaseServiceRoleClient();
  const baseUrl = getBaseUrl();
  const rateLimiter = createResendRateLimiter();
  const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);
  const summary = emptySummary();

  const profiles = await selectProfiles(supabase, startTime);
  const candidates = await buildCandidates(supabase, profiles, summary);

  for (const candidate of candidates) {
    try {
      const beachName = await resolveBeachName(supabase, candidate.home_beach_id);
      const messageInstanceId = crypto.randomUUID();
      const unsubscribeToken = generateEmailUnsubscribeToken(candidate.user_id);
      const unsubscribeUrl =
        `${baseUrl}/api/alerts/unsubscribe-email?user_id=${candidate.user_id}` +
        `&token=${unsubscribeToken}`;
      const email = generateTrialInvitationEmail({
        baseUrl,
        displayName: candidate.display_name,
        beachName,
        unsubscribeUrl,
        messageInstanceId,
      });

      await rateLimiter.throttle();

      const { data: sendData, error: sendError } = await sendEmail({
        from: MAIL_FROM,
        replyTo: MAIL_REPLY_TO,
        to: candidate.email,
        subject: email.subject,
        react: email.react,
        text: email.text,
        unsubscribeUrl,
      });

      if (sendError) {
        console.error(
          `${CONTEXT_TAG} Send failed for user ${candidate.user_id}:`,
          sendError
        );
        summary.skipped.sendFailed++;
        summary.errors++;
        continue;
      }

      await emailLogger.logDelivery({
        userId: candidate.user_id,
        emailType: EMAIL_TYPE,
        subject: email.subject,
        bestBeachId: candidate.home_beach_id,
        resendMessageId: sendData?.id,
        meta: {
          message_instance_id: messageInstanceId,
          beach_name: beachName,
          signup_at: candidate.signup_at,
        },
      });

      summary.sent++;
    } catch (error) {
      console.error(
        `${CONTEXT_TAG} Unexpected failure for user ${candidate.user_id}:`,
        error
      );
      summary.errors++;
    }
  }

  summary.durationMs = Date.now() - startTime;
  return { summary };
}

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    if (process.env.TRIAL_INVITATION_EMAIL_ENABLED !== "true") {
      return createSuccessResponse(
        await withCronOutcome(
          {
            job: "/api/cron/trial-invitation-email",
            unit: "emails_sent",
            expectedMin: 1,
            getProduced: (value) => value.summary.sent,
            legitimatelyZero: () => ({
              reason:
                "Trial invitation sends are disabled until the operator enables TRIAL_INVITATION_EMAIL_ENABLED",
            }),
          },
          async () => ({
            summary: { enabled: false, candidates: 0, sent: 0 },
          })
        )
      );
    }

    return createSuccessResponse(
      await withCronOutcome(
        {
          job: "/api/cron/trial-invitation-email",
          unit: "emails_sent",
          expectedMin: 1,
          getProduced: (value: { summary: RunSummary }) => value.summary.sent,
          legitimatelyZero: (value: { summary: RunSummary }) =>
            value.summary.candidates === 0
              ? { reason: "No eligible trial invitation candidates this cycle" }
              : undefined,
        },
        () => runEnabled(startTime)
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/trial-invitation-email", _GET);
