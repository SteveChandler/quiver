/**
 * GET /api/cron/trial-lifecycle-email
 *
 * Trial-lifecycle email cron. Runs once daily.
 *
 * Drives the three trial-stage emails in the founder-led trial loop
 * (`Brand-Vault/marketing/email-campaign-trial-loop.md`, stages 4, 6, 7):
 *
 *   trial_started — trial day 1. Points at the Pro call layer, which is the
 *                   sprint's defined first-value event.
 *   trial_ending  — trial day 11. States the charge date plainly.
 *   trial_ended   — ~2 days after an unconverted trial lapsed. Asks the one
 *                   objection question. No win-back offer.
 *
 * All three stages are anchored on `user_entitlements.trial_ends_at`, the same
 * column `trial-ending-push-deliver` uses. There is no `trial_started_at`
 * column; day-N is derived as `trial_ends_at - (TRIAL_LENGTH_DAYS - N) days`.
 * If the trial length ever stops being 14 days, TRIAL_LENGTH_DAYS is the only
 * thing to change here — but the derived windows go wrong silently, so the
 * constant must track the live offer.
 *
 * Converted trials fall out for free: RENEWAL nulls `trial_ends_at`, so a
 * converter can never match a window.
 *
 * Dedup is per (user_id, email_type) with no date bound — each stage reaches a
 * user at most once, backed by idx_email_send_log_trial_stages.
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
import {
  formatTrialDate,
  generateTrialEndedEmail,
  generateTrialEndingEmail,
  generateTrialStartedEmail,
  type GeneratedTrialEmail,
  type TrialEmailStage,
} from "@/lib/mailer/trial-lifecycle-emails";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[trial-lifecycle-email]";

/** The live Quiver Pro offer. Every stage window is derived from this. */
const TRIAL_LENGTH_DAYS = 14;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Half-width of each selection window. The cron runs daily, so ±12h around the
 * target instant covers exactly one day's population with no gap and no
 * overlap. The email_send_log dedup absorbs a retry or a schedule change.
 */
const WINDOW_HALF_WIDTH_MS = 12 * HOUR_MS;

/** Day of the trial each stage targets. */
const TRIAL_STARTED_DAY = 1;
const TRIAL_ENDING_DAY = 11;

/**
 * How long after a trial lapses we ask the objection question. Long enough
 * that a late conversion or a billing retry has resolved, short enough that
 * the trial is still fresh.
 */
const TRIAL_ENDED_LOOKBACK_MS = 2 * DAY_MS;

/**
 * Day-1 collides with `first-session-nudge`, which fires 18-30h after signup
 * for users with no logged session — and a trial started during onboarding
 * reaches day 1 inside that same window. That cron carries its own 24h global
 * cooldown, but it runs every 6h and can land first, so the guard has to be
 * mutual.
 *
 * Applied to trial_started only. `trial_ending` is a charge notice and must
 * never be suppressible, and `trial_ended` sits two days clear of any other
 * lifecycle mail. A user skipped here does not get the day-1 email at all —
 * the ±12h window has passed by the next run. That is the deliberate trade:
 * one missed nudge beats two emails in an hour to a brand-new trial user.
 */
const TRIAL_STARTED_QUIET_HOURS = 12;

/**
 * Charge amount by product. An email that names the wrong price is worse than
 * no email, so an unrecognized product is skipped rather than guessed at.
 * Prices are canon: `Brand-Vault/marketing/icp-and-positioning.md`.
 */
const PRICE_BY_PRODUCT_ID: Record<string, string> = {
  "app.quiversurf.surf.pro.monthly": "$4.99/mo",
  "app.quiversurf.surf.pro.annual": "$39.99/yr",
  // Web-checkout annual product observed in production entitlements 2026-08-21;
  // price per canon (Brand-Vault/marketing/icp-and-positioning.md). Verify
  // against the RevenueCat dashboard before the first day-11 send reaches a
  // web subscriber.
  "quiver_pro_web_annual": "$39.99/yr",
};

// ============================================================================
// Type Definitions
// ============================================================================

interface EntitlementRow {
  user_id: string;
  trial_ends_at: string | null;
  product_id: string | null;
  rc_raw: unknown;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  home_beach_id: string | null;
  timezone: string | null;
}

interface Candidate {
  user_id: string;
  email: string;
  display_name: string | null;
  home_beach_id: string | null;
  timezone: string | null;
  trial_ends_at: string;
  product_id: string | null;
}

interface StageSummary {
  candidates: number;
  sent: number;
  skipped: {
    alreadySent: number;
    noEmailPref: number;
    suppressed: number;
    unknownPrice: number;
    sandbox: number;
    recentEmail: number;
    sendFailed: number;
  };
}

interface RunSummary {
  stages: Record<TrialEmailStage, StageSummary>;
  sent: number;
  errors: number;
  durationMs: number;
}

function emptyStageSummary(): StageSummary {
  return {
    candidates: 0,
    sent: 0,
    skipped: {
      alreadySent: 0,
      noEmailPref: 0,
      suppressed: 0,
      unknownPrice: 0,
      sandbox: 0,
      recentEmail: 0,
      sendFailed: 0,
    },
  };
}

// ============================================================================
// Selection
// ============================================================================

/**
 * The window `trial_ends_at` must fall in for a trial that is on day `day`
 * right now. Day 1 of a 14-day trial ends in 13 days.
 */
function windowForTrialDay(
  now: number,
  day: number
): { start: string; end: string } {
  const centre = now + (TRIAL_LENGTH_DAYS - day) * DAY_MS;
  return {
    start: new Date(centre - WINDOW_HALF_WIDTH_MS).toISOString(),
    end: new Date(centre + WINDOW_HALF_WIDTH_MS).toISOString(),
  };
}

/** Sandbox purchases are not trials. See the 0-to-100 plan's trial definition. */
function isSandbox(rcRaw: unknown): boolean {
  return (
    typeof rcRaw === "object" &&
    rcRaw !== null &&
    (rcRaw as { environment?: unknown }).environment === "SANDBOX"
  );
}

async function selectEntitlements(
  supabase: SupabaseClient,
  stage: TrialEmailStage,
  now: number
): Promise<EntitlementRow[]> {
  const columns = "user_id, trial_ends_at, product_id, rc_raw";

  if (stage === "trial_ended") {
    // Lapsed without converting: the entitlement is gone but the trial
    // boundary is still on the row. EXPIRATION does not clear trial_ends_at,
    // and RENEWAL nulls it, so converters cannot appear here.
    const centre = now - TRIAL_ENDED_LOOKBACK_MS;
    const { data, error } = await supabase
      .from("user_entitlements")
      .select(columns)
      .eq("is_pro", false)
      .gte(
        "trial_ends_at",
        new Date(centre - WINDOW_HALF_WIDTH_MS).toISOString()
      )
      .lte(
        "trial_ends_at",
        new Date(centre + WINDOW_HALF_WIDTH_MS).toISOString()
      );
    if (error) {
      throw new Error(`Failed to query user_entitlements: ${error.message}`);
    }
    return (data ?? []) as unknown as EntitlementRow[];
  }

  const day = stage === "trial_started" ? TRIAL_STARTED_DAY : TRIAL_ENDING_DAY;
  const window = windowForTrialDay(now, day);
  const { data, error } = await supabase
    .from("user_entitlements")
    .select(columns)
    .eq("is_trialing", true)
    .gte("trial_ends_at", window.start)
    .lte("trial_ends_at", window.end);
  if (error) {
    throw new Error(`Failed to query user_entitlements: ${error.message}`);
  }
  return (data ?? []) as unknown as EntitlementRow[];
}

/**
 * Narrows an entitlement window down to sendable candidates: not already sent
 * this stage, email enabled, has an address, not sandbox, not suppressed.
 */
async function buildCandidates(
  supabase: SupabaseClient,
  stage: TrialEmailStage,
  rows: EntitlementRow[],
  summary: StageSummary
): Promise<Candidate[]> {
  const live = rows.filter(
    (row): row is EntitlementRow & { trial_ends_at: string } => {
      if (row.trial_ends_at === null) return false;
      if (isSandbox(row.rc_raw)) {
        summary.skipped.sandbox++;
        return false;
      }
      return true;
    }
  );

  if (live.length === 0) return [];

  const userIds = live.map((row) => row.user_id);

  // Stage dedup: once per user, ever. Re-sending day-1 copy to someone on a
  // repeat trial reads worse than staying quiet.
  const { data: sentRows, error: sentError } = await supabase
    .from("email_send_log")
    .select("user_id")
    .eq("email_type", stage)
    .in("user_id", userIds);

  if (sentError) {
    // Fail closed: without the dedup read we cannot prove we won't double-send.
    throw new Error(`Failed to query email_send_log: ${sentError.message}`);
  }

  const alreadySent = new Set((sentRows ?? []).map((r) => r.user_id as string));
  summary.skipped.alreadySent = alreadySent.size;

  const unsentIds = userIds.filter((id) => !alreadySent.has(id));
  if (unsentIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, home_beach_id, timezone")
    .in("id", unsentIds)
    .eq("notif_email_enabled", true);

  if (profileError) {
    throw new Error(`Failed to query profiles: ${profileError.message}`);
  }

  const profileById = new Map(
    ((profiles ?? []) as unknown as ProfileRow[]).map((p) => [p.id, p])
  );
  summary.skipped.noEmailPref = unsentIds.length - profileById.size;

  const withEmail: Candidate[] = [];
  for (const row of live) {
    if (alreadySent.has(row.user_id)) continue;
    const profile = profileById.get(row.user_id);
    if (!profile?.email) continue;
    withEmail.push({
      user_id: row.user_id,
      email: profile.email,
      display_name: profile.display_name,
      home_beach_id: profile.home_beach_id,
      timezone: profile.timezone,
      trial_ends_at: row.trial_ends_at,
      product_id: row.product_id,
    });
  }

  const unsuppressed = await filterSuppressedRecipients(supabase, withEmail);
  summary.skipped.suppressed = withEmail.length - unsuppressed.length;

  if (stage !== "trial_started" || unsuppressed.length === 0) {
    return unsuppressed;
  }

  return quietHoursFilter(supabase, unsuppressed, summary);
}

/**
 * Drops candidates who received any Quiver email in the last
 * TRIAL_STARTED_QUIET_HOURS. See the constant for why this is day-1 only.
 */
async function quietHoursFilter(
  supabase: SupabaseClient,
  candidates: Candidate[],
  summary: StageSummary
): Promise<Candidate[]> {
  const since = new Date(
    Date.now() - TRIAL_STARTED_QUIET_HOURS * HOUR_MS
  ).toISOString();

  const { data, error } = await supabase
    .from("email_send_log")
    .select("user_id")
    .gte("sent_at", since)
    .in(
      "user_id",
      candidates.map((c) => c.user_id)
    );

  if (error) {
    // Fail closed: an unreadable log cannot prove the inbox is quiet.
    console.error(
      `${CONTEXT_TAG} Quiet-hours check failed, skipping day-1 sends:`,
      error
    );
    summary.skipped.recentEmail = candidates.length;
    return [];
  }

  const recent = new Set((data ?? []).map((r) => r.user_id as string));
  const quiet = candidates.filter((c) => !recent.has(c.user_id));
  summary.skipped.recentEmail = candidates.length - quiet.length;
  return quiet;
}

// ============================================================================
// Content
// ============================================================================

async function resolveBeach(
  supabase: SupabaseClient,
  beachId: string | null
): Promise<{ name: string | null; slug: string | null }> {
  if (!beachId) return { name: null, slug: null };
  const { data } = await supabase
    .from("beaches")
    .select("name, slug")
    .eq("id", beachId)
    .maybeSingle();
  return { name: data?.name ?? null, slug: data?.slug ?? null };
}

/**
 * Returns null when this candidate must be skipped for content reasons — today
 * that is only an unrecognized product on the charge-date email.
 */
function buildEmail(
  stage: TrialEmailStage,
  candidate: Candidate,
  common: {
    baseUrl: string;
    beachName: string | null;
    beachSlug: string | null;
    unsubscribeUrl: string;
    messageInstanceId: string;
  },
  summary: StageSummary
): GeneratedTrialEmail | null {
  const input = { ...common, displayName: candidate.display_name };

  if (stage === "trial_started") return generateTrialStartedEmail(input);
  if (stage === "trial_ended") return generateTrialEndedEmail(input);

  const price = candidate.product_id
    ? PRICE_BY_PRODUCT_ID[candidate.product_id]
    : undefined;

  if (!price) {
    summary.skipped.unknownPrice++;
    console.warn(
      `${CONTEXT_TAG} Skipping trial_ending for user ${candidate.user_id}: unrecognized product ${candidate.product_id ?? "null"}`
    );
    return null;
  }

  const boundary = formatTrialDate(candidate.trial_ends_at, candidate.timezone);

  return generateTrialEndingEmail({
    ...input,
    trialEndsOn: boundary,
    // The first charge lands when the trial ends — same day, stated twice on
    // purpose so the reader never has to infer it.
    chargeOn: boundary,
    price,
    manageUrl: `${common.baseUrl}/settings`,
  });
}

// ============================================================================
// Stage runner
// ============================================================================

async function runStage(
  supabase: SupabaseClient,
  stage: TrialEmailStage,
  now: number,
  baseUrl: string,
  rateLimiter: ReturnType<typeof createResendRateLimiter>,
  emailLogger: ReturnType<typeof createEmailLogger>
): Promise<{ summary: StageSummary; errors: number }> {
  const summary = emptyStageSummary();
  let errors = 0;

  const rows = await selectEntitlements(supabase, stage, now);
  if (rows.length === 0) {
    console.log(`${CONTEXT_TAG} ${stage}: no entitlements in window`);
    return { summary, errors };
  }

  const candidates = await buildCandidates(supabase, stage, rows, summary);
  summary.candidates = candidates.length;

  console.log(
    `${CONTEXT_TAG} ${stage}: ${candidates.length} candidates from ${rows.length} in window`
  );

  for (const candidate of candidates) {
    try {
      const beach = await resolveBeach(supabase, candidate.home_beach_id);
      const messageInstanceId = crypto.randomUUID();
      const unsubscribeToken = generateEmailUnsubscribeToken(candidate.user_id);
      const unsubscribeUrl =
        `${baseUrl}/api/alerts/unsubscribe-email?user_id=${candidate.user_id}` +
        `&token=${unsubscribeToken}`;

      const email = buildEmail(
        stage,
        candidate,
        {
          baseUrl,
          beachName: beach.name,
          beachSlug: beach.slug,
          unsubscribeUrl,
          messageInstanceId,
        },
        summary
      );

      if (!email) continue;

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
          `${CONTEXT_TAG} ${stage}: send failed for user ${candidate.user_id}:`,
          sendError
        );
        summary.skipped.sendFailed++;
        errors++;
        continue;
      }

      await emailLogger.logDelivery({
        userId: candidate.user_id,
        emailType: stage,
        subject: email.subject,
        bestBeachId: candidate.home_beach_id ?? undefined,
        resendMessageId: sendData?.id,
        meta: {
          stage,
          trial_ends_at: candidate.trial_ends_at,
          product_id: candidate.product_id,
          beach_name: beach.name,
          message_instance_id: messageInstanceId,
        },
      });

      summary.sent++;
      console.log(`${CONTEXT_TAG} ${stage}: sent to user ${candidate.user_id}`);
    } catch (error) {
      console.error(
        `${CONTEXT_TAG} ${stage}: unexpected failure for user ${candidate.user_id}:`,
        error
      );
      errors++;
    }
  }

  return { summary, errors };
}

// ============================================================================
// Main Handler
// ============================================================================

const STAGES: TrialEmailStage[] = [
  "trial_started",
  "trial_ending",
  "trial_ended",
];

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

    const supabase = await createSupabaseServiceRoleClient();
    const baseUrl = getBaseUrl();
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    const summary: RunSummary = {
      stages: {
        trial_started: emptyStageSummary(),
        trial_ending: emptyStageSummary(),
        trial_ended: emptyStageSummary(),
      },
      sent: 0,
      errors: 0,
      durationMs: 0,
    };

    for (const stage of STAGES) {
      const result = await runStage(
        supabase,
        stage,
        startTime,
        baseUrl,
        rateLimiter,
        emailLogger
      );
      summary.stages[stage] = result.summary;
      summary.sent += result.summary.sent;
      summary.errors += result.errors;
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `${CONTEXT_TAG} Run complete: ${summary.sent} sent, ${summary.errors} errors in ${summary.durationMs}ms`
    );

    return createSuccessResponse(
      await withCronOutcome(
        {
          job: "/api/cron/trial-lifecycle-email",
          unit: "emails_sent",
          expectedMin: 1,
          getProduced: (value: { summary: RunSummary }) => value.summary.sent,
          legitimatelyZero: (value: { summary: RunSummary }) =>
            STAGES.every(
              (stage) => value.summary.stages[stage].candidates === 0
            )
              ? {
                  reason:
                    "No trial reached a day-1, day-11, or lapsed-trial boundary this cycle",
                }
              : undefined,
        },
        async () => ({ summary })
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/trial-lifecycle-email", _GET);
