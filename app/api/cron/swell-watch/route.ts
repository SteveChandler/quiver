/**
 * GET /api/cron/swell-watch
 *
 * Forward-looking major-swell shadow evaluation across every active beach.
 * It never enqueues or sends. Disabled by default.
 * Auth: Authorization: Bearer ***
 */

import { withObservedCron } from "@/lib/cron/observability";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { evaluateMajorSwellAwarenessShadow } from "@/lib/recommendations/major-swell-awareness/shadow-evaluator";
import {
  loadNwsSwellAdvisories,
  loadOfficialSwellAdvisories,
} from "@/lib/recommendations/major-swell-awareness/official-advisory-adapter";
import {
  MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from "@/lib/notifications/types/major-swell";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { z } from "zod";
import { verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { loadSwellWatchAcquisitionScope } from "@/lib/alerts/swell-watch/provider-run-store";
import { acquisitionConfig, acquireSwellWatchCohort } from "@/lib/alerts/swell-watch/acquisition";
import { enqueueAttestedSwellWatchCohort } from "@/lib/alerts/swell-watch/enqueue-candidates";
import { createSwellWatchObservability } from "@/lib/alerts/swell-watch/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[swell-watch]";
const LOOKAHEAD_HOURS = 10 * 24;
const EVALUATION_CONCURRENCY = 8;
const SENTRY_MONITOR = {
  slug: "swell-watch",
  schedule: "0 15 * * *",
  maxRuntimeMinutes: 5,
};

interface SwellWatchSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  sent: number;
  shadowMatches: number;
  duplicates: number;
  testAllowlistActive: false;
  skippedCounts: Record<string, number>;
  errors: number;
  durationMs: number;
  automationEnabled: false;
  shadowEvaluations: MajorSwellNotificationPayload[];
}

type SwellWatchBeach = Beach & {
  nws_forecast_zone?: string | null;
};

type SwellWatchSelection =
  | { payload: MajorSwellNotificationPayload }
  | { skipReason: string };

type SwellWatchEvaluation =
  | {
      state: "match";
      payload: MajorSwellNotificationPayload;
      noForecast: boolean;
    }
  | { state: "skip"; reason: string; noForecast: boolean }
  | { state: "error"; beachId: string; error: unknown };

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function createSummary(): SwellWatchSummary {
  return {
    skipped: false,
    evaluated: 0,
    candidates: 0,
    sent: 0,
    shadowMatches: 0,
    duplicates: 0,
    testAllowlistActive: false,
    skippedCounts: {},
    errors: 0,
    durationMs: 0,
    automationEnabled: false,
    shadowEvaluations: [],
  };
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runNext = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => runNext(),
    ),
  );
  return results;
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

function buildSwellWatchCopy(input: {
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

async function selectAndBuildSwellWatch({
  supabase,
  beach,
  forecasts,
  timezone,
  now,
}: {
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  beach: SwellWatchBeach;
  forecasts: EnhancedForecastEntity[];
  timezone: string;
  now: Date;
}): Promise<SwellWatchSelection> {
  const ledgerAdvisories = await loadOfficialSwellAdvisories({
    supabase,
    beachId: beach.id,
    timezone,
    now,
  });
  let nwsAdvisories: Awaited<ReturnType<typeof loadNwsSwellAdvisories>> = [];
  try {
    nwsAdvisories = await loadNwsSwellAdvisories({
      zone: beach.nws_forecast_zone,
      beachId: beach.id,
      now,
    });
  } catch (error) {
    console.warn(`${CONTEXT_TAG} NWS advisory fetch failed for ${beach.id}:`, error);
  }
  const awareness = evaluateMajorSwellAwarenessShadow({
    beachId: beach.id,
    forecasts,
    timezone,
    now,
    officialAdvisories: [...ledgerAdvisories, ...nwsAdvisories],
  });
  const event = awareness.event;
  if (awareness.signal === "none") {
    return { skipReason: "no_event" };
  }

  const copy = event
    ? buildSwellWatchCopy({
        beachName: beach.name,
        eventStartDate: event.eventStartDate,
        peakDate: event.peakDate,
        peakHeightFt: event.peakHeightFt,
        peakPeriodS: event.peakPeriodS,
        timezone,
      })
    : {
        title: `Official surf hazard signal — ${beach.name}`,
        body: "An official coastal advisory is active in the forecast window.",
      };

  const payload = parseMajorSwellNotificationPayload({
    schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    beach_id: beach.id,
    ...(beach.slug ? { beach_slug: beach.slug } : {}),
    beach_name: beach.name,
    event_start_date: event?.eventStartDate ?? null,
    peak_date: event?.peakDate ?? null,
    peak_height_ft: event?.peakHeightFt ?? null,
    peak_period_s: event?.peakPeriodS ?? null,
    forecast_at: event?.peakForecastAt ?? null,
    awareness_mode: "shadow",
    automation_enabled: false,
    awareness_signal: awareness.signal,
    awareness_severity: awareness.severity ?? "significant",
    official_evidence_refs: awareness.officialEvidenceRefs,
    would_suppress_cohorts: awareness.wouldSuppressCohorts,
    enforcement: null,
    title: copy.title,
    body: copy.body,
  });

  return { payload };
}

async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401,
    );
  }

  const summary = createSummary();
  if (process.env.SWELL_WATCH_ENABLED !== "true") {
    summary.skipped = true;
    summary.reason = "disabled";
    summary.durationMs = Date.now() - startedAt;
    return createSuccessResponse(summary);
  }
  // The legacy shadow path stays read-only. A future enqueue path must first
  // receive a provider-issued completed-batch identity from forecast ingestion.
  if (process.env.SWELL_WATCH_PUSH_ENABLED === "true") {
    summary.skipped = true;
    summary.reason = "missing_immutable_issuance";
    summary.durationMs = Date.now() - startedAt;
    return createSuccessResponse(summary);
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data: beachRows, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: true });
    if (beachError) {
      throw new Error(`Failed to load active beaches: ${beachError.message}`);
    }

    const beaches = (beachRows ?? []) as SwellWatchBeach[];
    const now = new Date();
    const horizon = new Date(
      now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000,
    );
    summary.candidates = beaches.length;
    summary.evaluated = beaches.length;
    const evaluations = await mapWithConcurrency(
      beaches,
      EVALUATION_CONCURRENCY,
      async (beach): Promise<SwellWatchEvaluation> => {
        try {
          const { data: forecastRows, error: forecastError } = await supabase
            .from("enhanced_forecasts")
            .select("*")
            .eq("beach_id", beach.id)
            .gte("forecast_at", now.toISOString())
            .lt("forecast_at", horizon.toISOString())
            .order("forecast_at", { ascending: true });
          if (forecastError) {
            throw new Error(
              `Failed to load forecasts for ${beach.id}: ${forecastError.message}`,
            );
          }
          const forecasts = (forecastRows ?? []) as EnhancedForecastEntity[];
          const noForecast = forecasts.length === 0;

          const selection = await selectAndBuildSwellWatch({
            supabase,
            beach,
            forecasts,
            timezone: resolveBeachTimezone(beach.timezone),
            now,
          });
          if ("skipReason" in selection) {
            return {
              state: "skip",
              reason: selection.skipReason,
              noForecast,
            };
          }

          return { state: "match", payload: selection.payload, noForecast };
        } catch (error) {
          return { state: "error", beachId: beach.id, error };
        }
      },
    );

    for (const evaluation of evaluations) {
      if (evaluation.state === "error") {
        console.error(
          `${CONTEXT_TAG} Error evaluating beach ${evaluation.beachId}:`,
          evaluation.error,
        );
        summary.errors += 1;
        continue;
      }
      if (evaluation.noForecast) {
        increment(summary.skippedCounts, "noForecast");
      }
      if (evaluation.state === "skip") {
        increment(summary.skippedCounts, evaluation.reason);
        continue;
      }

      summary.shadowMatches += 1;
      if (summary.shadowEvaluations.length < 100) {
        summary.shadowEvaluations.push(evaluation.payload);
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

const producerConfig = acquisitionConfig.extend({
  policy: z.custom<SwellWatchPolicy>((value) => verifySwellWatchPolicy(value) && value.provenance === "production_approved"
    && value.schema_version === "swell-watch-policy.v2" && value.approval_evidence !== null),
}).strict();

/** Acquisition never completes or enqueues; the completed-run callback is a separate request. */
async function _POST(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  if (process.env.SWELL_WATCH_ENABLED !== "true") return createSuccessResponse({ skipped: true, reason: "disabled", enqueued: 0 });
  let operation: { provider_batch_id: string } | { action: "acquire" };
  try {
    operation = z.union([z.object({ provider_batch_id: z.uuid() }).strict(),
      z.object({ action: z.literal("acquire") }).strict()]).parse(await request.json());
  } catch {
    return createErrorResponse("Invalid request", "Expected a completed provider batch ID or acquisition action", 400);
  }
  let config: ({ action: "acquire" } & z.infer<typeof acquisitionConfig>)
    | ({ action: "complete"; providerBatchId: string } & z.infer<typeof producerConfig>);
  try {
    const raw = JSON.parse(process.env.SWELL_WATCH_PRODUCER_CONFIG ?? "null");
    config = "action" in operation
      ? { ...acquisitionConfig.parse(raw), action: "acquire" }
      : { ...producerConfig.parse(raw), action: "complete", providerBatchId: operation.provider_batch_id };
  } catch {
    return createErrorResponse("Producer unavailable", "Valid server-side producer configuration is required", 503);
  }
  const diagnostics = createSwellWatchObservability();
  try {
    const supabase = createSupabaseServiceRoleClient();
    if (config.action === "acquire") {
      const stored = await acquireSwellWatchCohort(config.cohort, supabase);
      return createSuccessResponse({ ...stored, qualification: "prototype_unqualified", enqueued: 0 });
    }
    const scopes = await loadSwellWatchAcquisitionScope(config.cohort, supabase);
    const result = await enqueueAttestedSwellWatchCohort({ providerBatchId: config.providerBatchId, forecastDays: 7,
      now: new Date().toISOString(), policy: config.policy, scopes },
    supabase as unknown as Parameters<typeof enqueueAttestedSwellWatchCohort>[1], diagnostics);
    return createSuccessResponse({ ...result, diagnostics: diagnostics.snapshot() });
  } catch {
    diagnostics.record("error");
    const acquisition = "action" in operation;
    console.error(acquisition ? "[swell-watch] acquisition failed" : "[swell-watch] completed-run processing failed", diagnostics.snapshot());
    return createErrorResponse("Producer failed", acquisition ? "Provider acquisition failed" : "Completed-run processing failed", 500);
  }
}

export const POST = withObservedCron("/api/cron/swell-watch", async (request) => {
  const response = await _POST(request);
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
}, SENTRY_MONITOR);
