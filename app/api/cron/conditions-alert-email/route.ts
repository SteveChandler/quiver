/**
 * GET /api/cron/conditions-alert-email
 *
 * Conditions alert cron job: sends daily alerts when a user's home beach
 * has excellent conditions (score >= 70/100). The RPC selects on a stored
 * conditions_score; each candidate is then re-verified against fresh forecasts
 * before sending, and a fresh score below MIN_SCORE skips the email.
 *
 * Runs daily at 14:30 UTC (6:30 AM Pacific), 30 min after daily-intel generation.
 *
 * Candidate selection via RPC:
 * 1. User's home beach has conditions_score >= 70 today
 * 2. User hasn't been active in the app today (no user_events)
 * 3. User hasn't received ANY email today (one email per user per day)
 * 4. User has forecast alerts enabled
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { ConditionsAlertEmail } from "@/lib/mailer/templates/ConditionsAlertEmail";
import { formatDatabaseTime } from "@/lib/email/email-formatters";
import { filterSuppressedRecipients } from "@/lib/email/suppression";
import type { ConditionsAlertCandidate } from "@/lib/email/email-types";
import { enrichBeachSignals } from "@/lib/email/signal-enrichment";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { evaluateDigestMatch } from "@/lib/services/forecast-digest-service";
import type { BeachMetadata, EnhancedForecastEntity as MagicHourForecast } from "@/lib/services/magic-hour";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { withObservedCron } from "@/lib/cron/observability";
import {
  pickBestNativeForecastSlot,
  resolveNativeSkillLevel,
} from "@/lib/scoring/native-condition-score";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for processing all users

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[conditions-alert-email]";
const MIN_SCORE = 70; // Minimum conditions_score (0-100 scale) to trigger email
const DEDUPE_HOURS = 20; // Cooldown for claim_forecast_delivery_slot dedup
const ALERT_TYPE = "conditions_alert";

// ============================================================================
// Type Definitions
// ============================================================================

interface RunSummary {
  candidates: number;
  sent: number;
  durationMs: number;
  skipped: {
    claimFailed: number;
    rescoreFailed: number;
    scoreBelowFloor: number;
    sendFailed: number;
  };
}

type ProcessingStatus =
  | "success"
  | "claim_failed"
  | "rescore_failed"
  | "score_below_floor"
  | "send_failed";

interface ProcessingResult {
  status: ProcessingStatus;
  error?: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Atomically claim the conditions alert delivery slot.
 * Uses the same RPC as forecast-digest-email for consistency.
 */
async function claimDeliverySlot(
  supabase: SupabaseClient,
  userId: string,
  beachId: string
): Promise<boolean> {
  const { data: claimed, error } = await supabase.rpc(
    "claim_forecast_delivery_slot",
    {
      p_user_id: userId,
      p_beach_id: beachId,
      p_alert_type: ALERT_TYPE,
      p_dedupe_hours: DEDUPE_HOURS,
    }
  );

  if (error) {
    console.error(
      `${CONTEXT_TAG} Error claiming slot for user ${userId}:`,
      error
    );
    // Fail closed for conditions alert: don't send on error to avoid spam
    return false;
  }

  return claimed === true;
}

/**
 * Build a mono dateline for the masthead, e.g. "FRI · JUN 13", in the beach's
 * Pacific-default timezone. Errors degrade to an empty string.
 */
function buildDateline(date: Date): string {
  try {
    const weekday = date
      .toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "America/Los_Angeles",
      })
      .toUpperCase();
    const monthDay = date
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Los_Angeles",
      })
      .toUpperCase();
    return `${weekday} · ${monthDay}`;
  } catch {
    return "";
  }
}

/**
 * Compose a tide summary like "2.1 ft, incoming" from a forecast row. Returns
 * null when no usable tide datum exists so the template can omit the cell.
 */
function formatTideDescription(
  forecast: { tide_height?: string | null; tide_status?: string | null } | null
): string | null {
  if (!forecast) return null;
  const parsed = parseFloat(forecast.tide_height ?? "");
  const heightPart = Number.isFinite(parsed) ? `${parsed.toFixed(1)} ft` : null;
  const status = forecast.tide_status?.trim() || null;
  if (heightPart && status) return `${heightPart}, ${status}`;
  return heightPart ?? status;
}

interface DigestWhyContent {
  whyText: string[];
  crowdWarning: string | null;
}

const EMPTY_WHY: DigestWhyContent = { whyText: [], crowdWarning: null };

/**
 * Derive the personalized "why this matches" bullets + crowd warning by reusing
 * the digest service's multi-gate evaluation. Degrades to empty content when the
 * beach metadata or forecasts are unavailable — a missing playbook section must
 * never block the send.
 */
function deriveWhyContent(
  beach: BeachMetadata | null,
  forecasts: MagicHourForecast[]
): DigestWhyContent {
  if (!beach || forecasts.length === 0) {
    return EMPTY_WHY;
  }
  try {
    // Skill level is not in the alert candidate payload; the digest service
    // defaults a null user level to 'intermediate', which is the right neutral.
    const match = evaluateDigestMatch(forecasts, beach, null, null);
    return {
      whyText: match.whyText,
      crowdWarning: match.crowdWarning,
    };
  } catch (error) {
    console.warn(`${CONTEXT_TAG} deriveWhyContent failed:`, error);
    return EMPTY_WHY;
  }
}

/**
 * Process a single conditions alert candidate: claim slot, send email, log delivery.
 */
async function processCandidate(
  candidate: ConditionsAlertCandidate,
  supabase: SupabaseClient,
  baseUrl: string,
  rateLimiter: ReturnType<typeof createResendRateLimiter>,
  emailLogger: ReturnType<typeof createEmailLogger>
): Promise<ProcessingResult> {
  // 1. Atomically claim the delivery slot. This happens before the fresh
  // score floor check on purpose: borderline stored-score candidates still
  // consume the daily alert attempt so the cron does not retry them all day.
  const claimed = await claimDeliverySlot(
    supabase,
    candidate.user_id,
    candidate.home_beach_id
  );

  if (!claimed) {
    return { status: "claim_failed" };
  }

  // 2. Re-verify the alert against fresh forecasts. The RPC selects on a stored
  // conditions_score (~30 min old, from daily-intel); this re-scores today's
  // slots so a degraded window doesn't get a stale "excellent conditions" email.
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  let freshScore = candidate.conditions_score;
  let dayForecasts: MagicHourForecast[] = [];
  let selectedForecast: MagicHourForecast | null = null;
  let rescoreFailed = false;

  // experience_level is absent from the candidate RPC until migration
  // 20260618133000 ships, and null for users who never set a level. Fall back
  // to the neutral 'intermediate' (the same default deriveWhyContent relies on
  // below) rather than the global 'beginner' safety default — beginner caps
  // acceptable waves at 4ft, which would zero-score every chest-high-plus day
  // and suppress alerts the daily-intel pipeline already approved.
  const userExperienceLevel = resolveNativeSkillLevel(
    candidate.experience_level,
    "intermediate"
  );

  try {
    const { data: forecasts } = await supabase
      .from("enhanced_forecasts")
      .select(
        "id, beach_id, forecast_at, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction_deg, tide_height, tide_status, swell_1_period, created_at, updated_at"
      )
      .eq("beach_id", candidate.home_beach_id)
      .gte("forecast_at", `${todayStr}T00:00:00Z`)
      .lt("forecast_at", `${todayStr}T23:59:59Z`)
      .order("forecast_at", { ascending: true })
      .limit(12);

    if (forecasts?.length) {
      dayForecasts = forecasts as unknown as MagicHourForecast[];
      const bestForecast = pickBestNativeForecastSlot(
        forecasts as unknown as EnhancedForecastEntity[],
        userExperienceLevel
      );
      if (bestForecast) {
        freshScore = bestForecast.score;
        selectedForecast = bestForecast.forecast as unknown as MagicHourForecast;
      }
    }
    // No fresh slots (empty result, not an error): fall through on the stored
    // score, which the RPC already gated at >= MIN_SCORE. This is the only
    // best-effort path — an actual fetch/scoring *error* fails closed below.
  } catch (rescoreError) {
    // Fail closed: the stored conditions_score is always >= MIN_SCORE (the RPC
    // gates on it), so falling back to it on an error would bypass the floor
    // check and send an alert we could not freshly verify. Skip instead —
    // consistent with claimDeliverySlot's fail-closed policy. The slot stays
    // claimed (see step 1) so a transient error doesn't trigger all-day retries.
    rescoreFailed = true;
    console.warn(
      `${CONTEXT_TAG} Re-score failed for ${candidate.beach_name}, failing closed:`,
      rescoreError
    );
  }

  if (rescoreFailed) {
    return { status: "rescore_failed" };
  }

  if (freshScore < MIN_SCORE) {
    console.log(
      `${CONTEXT_TAG} Skipping ${candidate.beach_name}: fresh score ${freshScore} below ${MIN_SCORE}`
    );
    return { status: "score_below_floor" };
  }

  // Beach thresholds power the personalized why-bullets only. This is fetched
  // AFTER the floor gate (so we skip the query for candidates we won't email)
  // and is best-effort: a metadata failure must never block a send backed by a
  // verified score, so it degrades to empty why-content (deriveWhyContent
  // tolerates a null beach) rather than failing closed.
  let beachMeta: BeachMetadata | null = null;
  try {
    const { data: beach } = await supabase
      .from("beaches")
      .select(
        "id, name, slug, wind_offshore_deg, wind_offshore_tol_deg, preferred_tide_ft_min, preferred_tide_ft_max, skill_level, swell_window_center_deg, swell_window_halfwidth_deg, timezone"
      )
      .eq("id", candidate.home_beach_id)
      .single();

    if (beach) {
      beachMeta = {
        id: beach.id,
        name: beach.name,
        slug: beach.slug,
        skill_level: beach.skill_level,
        swell_window_center_deg: beach.swell_window_center_deg,
        swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
        wind_offshore_deg: beach.wind_offshore_deg,
        wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
        preferred_tide_ft_min: beach.preferred_tide_ft_min,
        preferred_tide_ft_max: beach.preferred_tide_ft_max,
        timezone: beach.timezone ?? undefined,
      };
    }
  } catch (beachError) {
    console.warn(
      `${CONTEXT_TAG} Beach metadata fetch failed for ${candidate.beach_name}, sending without why-bullets:`,
      beachError
    );
  }

  // 3. Enrich surf-decision signals + derive the personalized why bullets.
  // enrichBeachSignals degrades each field to null independently; deriveWhyContent
  // returns empty content when the beach/forecasts are missing — neither blocks.
  const signals = await enrichBeachSignals(
    supabase as SupabaseClient<Database>,
    candidate.home_beach_id,
    todayStr
  );
  const why = deriveWhyContent(beachMeta, dayForecasts);

  // 4. Format best window + tide summary.
  const bestWindow =
    candidate.best_window_start && candidate.best_window_end
      ? {
          start: formatDatabaseTime(candidate.best_window_start) || "",
          end: formatDatabaseTime(candidate.best_window_end) || "",
        }
      : null;
  const tideDescription = formatTideDescription(
    selectedForecast ?? dayForecasts[0] ?? null
  );

  // 5. Prepare email content
  const ctaUrl = `${baseUrl}${buildBeachUrl({ slug: candidate.beach_slug, city: candidate.beach_city, state: candidate.beach_state })}`;
  const manageUrl = `${baseUrl}/settings`;
  const unsubscribeUrl = `${baseUrl}/settings`;
  const emailSubject = `${candidate.beach_name}: ${freshScore} today`;
  const dateline = buildDateline(now);

  // 6. Rate limit and send email
  await rateLimiter.throttle();

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to: candidate.email,
    subject: emailSubject,
    react: ConditionsAlertEmail({
      beachName: candidate.beach_name,
      conditionsScore: freshScore,
      surfDescription: candidate.surf_description,
      windDescription: candidate.wind_description,
      tideDescription,
      bestWindow,
      dateline,
      signals,
      why,
      ctaUrl,
      manageUrl,
      unsubscribeUrl,
    }),
  });

  if (sendError) {
    console.error(
      `${CONTEXT_TAG} Failed to send to user ${candidate.user_id}:`,
      sendError
    );
    return { status: "send_failed", error: sendError };
  }

  // 7. Log to email_send_log for tracking
  await emailLogger.logDelivery({
    userId: candidate.user_id,
    emailType: "conditions_alert",
    subject: emailSubject,
    bestScore: freshScore,
    bestBeachId: candidate.home_beach_id,
    resendMessageId: sendData?.id,
    meta: {
      beach_name: candidate.beach_name,
      beach_slug: candidate.beach_slug,
    },
  });

  console.log(
    `${CONTEXT_TAG} Sent to user ${candidate.user_id} for ${candidate.beach_name} (score: ${freshScore})`
  );

  return { status: "success" };
}

// ============================================================================
// Main Handler
// ============================================================================

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Validate cron auth
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    console.log(`${CONTEXT_TAG} Starting conditions alert email run`);

    const supabase = await createSupabaseServiceRoleClient();

    // Initialize summary
    const summary: RunSummary = {
      candidates: 0,
      sent: 0,
      durationMs: 0,
      skipped: {
        claimFailed: 0,
        rescoreFailed: 0,
        scoreBelowFloor: 0,
        sendFailed: 0,
      },
    };

    // 2. Get conditions alert candidates via RPC
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      "get_conditions_alert_candidates",
      {
        p_min_score: MIN_SCORE,
      }
    );

    if (candidatesError) {
      throw new Error(
        `Failed to fetch conditions alert candidates: ${candidatesError.message}`
      );
    }

    console.log(`${CONTEXT_TAG} Found ${candidates?.length ?? 0} candidates`);

    if (!candidates || candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse({ summary });
    }

    const deliverable = await filterSuppressedRecipients(
      supabase,
      candidates as ConditionsAlertCandidate[]
    );
    summary.candidates = deliverable.length;
    const baseUrl = getBaseUrl();

    // Initialize shared utilities
    const rateLimiter = createResendRateLimiter();
    const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

    // 3. Process each candidate
    for (const candidate of deliverable) {
      try {
        const result = await processCandidate(
          candidate,
          supabase,
          baseUrl,
          rateLimiter,
          emailLogger
        );

        switch (result.status) {
          case "success":
            summary.sent++;
            break;
          case "claim_failed":
            summary.skipped.claimFailed++;
            break;
          case "rescore_failed":
            summary.skipped.rescoreFailed++;
            break;
          case "score_below_floor":
            summary.skipped.scoreBelowFloor++;
            break;
          case "send_failed":
            summary.skipped.sendFailed++;
            break;
        }
      } catch (candidateError) {
        console.error(
          `${CONTEXT_TAG} Error processing candidate ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.sendFailed++;
      }
    }

    summary.durationMs = Date.now() - startTime;

    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} emails sent, ${summary.candidates} candidates, ${summary.durationMs}ms`
    );
    console.log(`   Skipped breakdown:`, summary.skipped);

    return createSuccessResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/conditions-alert-email", _GET);
