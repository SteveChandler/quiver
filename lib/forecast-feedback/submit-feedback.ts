import { randomUUID } from "crypto";
import {
  buildSeasideForecastFeedbackPayload,
  type ForecastFeedbackClientPayload,
} from "@/lib/services/forecast/forecast-feedback";
import { createServiceRoleClient } from "@/lib/supabase";
import type { SupabaseServerClient } from "@/types/supabase";
import type { Database, Json } from "@/types/database.generated";

type ExistingFeedbackContext = {
  id: string;
  contract_version: string;
  correlation_id: string | null;
};

interface ForecastFeedbackContext {
  user: { id: string };
  supabase: SupabaseServerClient;
}

interface SubmitForecastFeedbackOptions {
  ingestPath?: string;
  clientSource?: string;
  requireForecast?: boolean;
}

type CallFeedbackRow = {
  id: string;
  contract_version: string;
  correlation_id: string | null;
};

type SubmitForecastFeedbackResult =
  | {
      success: true;
      data: {
        id: string | null;
        contractVersion: string;
        correlationId: string;
      };
    }
  | {
      success: false;
      reason:
        | "forecast_lookup_failed"
        | "forecast_not_found"
        | "invalid_board"
        | "vote_storage_failed"
        | "storage_failed";
      correlationId: string;
    };

const FORECAST_ACCURACY_VOTE_VALUES: Record<string, boolean> = {
  about_right: true,
  too_low: false,
  too_high: false,
};

function normalizedEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const normalized = value.replace(/\\n/g, "").trim();
  return normalized ? normalized : null;
}

async function findExistingFeedbackContext(
  userId: string,
  requestId: string,
  ingestPath: string,
): Promise<ExistingFeedbackContext | null> {
  try {
    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient
      .from("forecast_feedback_contexts")
      .select("id,contract_version,correlation_id")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .eq("ingest_path", ingestPath)
      .maybeSingle();
    if (error) return null;
    return (data as ExistingFeedbackContext | null) ?? null;
  } catch {
    return null;
  }
}

/** A bridged hour sits less than 3 h after the stored row it was bridged from. */
const BRIDGED_HOUR_REACH_MS = 3 * 60 * 60 * 1000;

/** How a vote on an hour with no stored row reached the row it is filed against. */
interface ForecastTargetResolution {
  requested_forecast_at: string;
  resolved_forecast_at: string;
  resolved_forecast_id: string;
  source: "hourly_bridge_provenance" | "prior_stored_row";
}

interface ForecastTarget {
  id: string | null;
  error: boolean;
  resolution: ForecastTargetResolution | null;
}

/** raw_forecast.hourly_bridge.from, when the client forwards it in sourceModelContext. */
function bridgeProvenanceFrom(input: ForecastFeedbackClientPayload): string | null {
  const bridge = input.sourceModelContext?.hourly_bridge;
  if (!bridge || typeof bridge !== "object") return null;
  const from = (bridge as Record<string, unknown>).from;
  return typeof from === "string" && Number.isFinite(Date.parse(from)) ? from : null;
}

/**
 * The stored row a vote targets. An hour with no stored row is a bridged hour (discovery fills
 * the hours between 3-hourly rows): the vote goes to the row it was bridged from, named by the
 * client's provenance when it sends one, otherwise the latest stored row before the hour and
 * less than 3 h earlier.
 */
async function resolveForecastTarget(
  supabase: SupabaseServerClient,
  input: ForecastFeedbackClientPayload,
): Promise<ForecastTarget> {
  const exact = await supabase
    .from("enhanced_forecasts")
    .select("id")
    .eq("beach_id", input.beachId)
    .eq("forecast_at", input.forecastAt)
    .maybeSingle();
  if (exact.error) return { id: null, error: true, resolution: null };
  if (exact.data?.id) return { id: exact.data.id, error: false, resolution: null };

  const requestedMs = Date.parse(input.forecastAt);
  const floorMs = requestedMs - BRIDGED_HOUR_REACH_MS;
  const within = (ms: number): boolean => ms > floorMs && ms < requestedMs;
  const resolved = (
    row: { id: string; forecast_at: string },
    source: ForecastTargetResolution["source"],
  ): ForecastTarget => ({
    id: row.id,
    error: false,
    resolution: {
      requested_forecast_at: input.forecastAt,
      resolved_forecast_at: row.forecast_at,
      resolved_forecast_id: row.id,
      source,
    },
  });

  const provenanceFrom = bridgeProvenanceFrom(input);
  if (provenanceFrom && within(Date.parse(provenanceFrom))) {
    const named = await supabase
      .from("enhanced_forecasts")
      .select("id, forecast_at")
      .eq("beach_id", input.beachId)
      .eq("forecast_at", new Date(provenanceFrom).toISOString())
      .maybeSingle();
    if (named.error) return { id: null, error: true, resolution: null };
    if (named.data?.id) return resolved(named.data, "hourly_bridge_provenance");
  }

  const prior = await supabase
    .from("enhanced_forecasts")
    .select("id, forecast_at")
    .eq("beach_id", input.beachId)
    .lt("forecast_at", new Date(requestedMs).toISOString())
    .gt("forecast_at", new Date(floorMs).toISOString())
    .order("forecast_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prior.error) return { id: null, error: true, resolution: null };
  return prior.data?.id && within(Date.parse(prior.data.forecast_at))
    ? resolved(prior.data, "prior_stored_row")
    : { id: null, error: false, resolution: null };
}

function forecastAccuracyVoteValue(
  input: ForecastFeedbackClientPayload,
): boolean | null {
  if (input.feedbackKind !== "forecast_accuracy") return null;
  return FORECAST_ACCURACY_VOTE_VALUES[input.feedbackValue] ?? null;
}

function nonEmptyJsonRecordOrNull(
  value: Record<string, unknown> | undefined,
): Json | null {
  if (!value || Object.keys(value).length === 0) return null;
  return value as Json;
}

async function persistForecastAccuracyVote(
  context: ForecastFeedbackContext,
  input: ForecastFeedbackClientPayload,
  resolveTarget: () => Promise<ForecastTarget>,
): Promise<void> {
  const wasAccurate = forecastAccuracyVoteValue(input);
  if (wasAccurate == null) return;

  const forecast = await resolveTarget();
  if (forecast.error) throw new Error("Forecast vote target lookup failed");
  if (!forecast.id) throw new Error("Forecast vote target not found");

  const { error } = await context.supabase
    .from("forecast_accuracy_votes")
    .upsert(
      {
        user_id: context.user.id,
        forecast_id: forecast.id,
        beach_id: input.beachId,
        was_accurate: wasAccurate,
        actual_conditions: nonEmptyJsonRecordOrNull(input.displayedContext),
        notes: input.feedbackNote?.trim() || null,
        photo_url: null,
      },
      { onConflict: "user_id,forecast_id" },
    )
    .select("id")
    .single();

  if (error) throw new Error("Forecast vote storage failed");
}

export async function submitForecastFeedback(
  context: ForecastFeedbackContext,
  input: ForecastFeedbackClientPayload,
  options: SubmitForecastFeedbackOptions = {},
): Promise<SubmitForecastFeedbackResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const requestId = input.requestId ?? randomUUID();
  const ingestPath = options.ingestPath ?? "quiver-api/forecast-feedback";
  // Resolved at most once, and only when a vote or requireForecast needs the row.
  const target: { pending: Promise<ForecastTarget> | null } = { pending: null };
  const resolveTarget = (): Promise<ForecastTarget> =>
    (target.pending ??= resolveForecastTarget(context.supabase, input));

  if (options.requireForecast) {
    const forecast = await resolveTarget();
    if (forecast.error) {
      return { success: false, reason: "forecast_lookup_failed", correlationId };
    }
    if (!forecast.id) {
      return { success: false, reason: "forecast_not_found", correlationId };
    }
  }

  if (input.feedbackKind === "call_check" && input.boardId) {
    const { data: board, error: boardError } = await context.supabase
      .from("boards")
      .select("id")
      .eq("id", input.boardId)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (boardError || !board) {
      return { success: false, reason: "invalid_board", correlationId };
    }
  }

  const existing = await findExistingFeedbackContext(
    context.user.id,
    requestId,
    ingestPath,
  );
  if (existing) {
    return {
      success: true,
      data: {
        id: existing.id,
        contractVersion: existing.contract_version,
        correlationId: existing.correlation_id ?? correlationId,
      },
    };
  }

  try {
    await persistForecastAccuracyVote(context, input, resolveTarget);
  } catch {
    return { success: false, reason: "vote_storage_failed", correlationId };
  }

  // The stored context keeps the hour the client showed; the audit trail names the row a
  // bridged hour was filed against. The key is server-owned, so a client value never stands.
  const resolution = target.pending ? (await target.pending).resolution : null;
  const auditMetadata: Record<string, unknown> = { ...(input.auditMetadata ?? {}) };
  delete auditMetadata.forecast_target;
  if (resolution) auditMetadata.forecast_target = resolution;
  const auditedInput: ForecastFeedbackClientPayload = { ...input, auditMetadata };
  const payload = buildSeasideForecastFeedbackPayload(auditedInput, {
    userId: context.user.id,
    ingestPath,
    requestId,
    correlationId,
    clientSource: options.clientSource ?? "quiver-web",
    clientVersion:
      normalizedEnv("VERCEL_GIT_COMMIT_SHA") ??
      normalizedEnv("NEXT_PUBLIC_VERCEL_ENV"),
  });

  const serviceClient = createServiceRoleClient();
  try {
    const { data, error } = await (serviceClient
      .from("forecast_feedback_contexts")
      .insert(
        payload as Database["public"]["Tables"]["forecast_feedback_contexts"]["Insert"],
      )
      .select("id,contract_version,correlation_id")
      .single() as unknown as Promise<{ data: CallFeedbackRow | null; error: { message: string } | null }>);
    if (error || !data) throw new Error("Forecast feedback storage failed");
    return {
      success: true,
      data: {
        id: data.id,
        contractVersion: data.contract_version,
        correlationId: data.correlation_id ?? correlationId,
      },
    };
  } catch {
    const recovered = await findExistingFeedbackContext(
      context.user.id,
      requestId,
      ingestPath,
    );
    if (recovered) {
      return {
        success: true,
        data: {
          id: recovered.id,
          contractVersion: recovered.contract_version,
          correlationId: recovered.correlation_id ?? correlationId,
        },
      };
    }
    return {
      success: false,
      reason: "storage_failed",
      correlationId,
    };
  }
}
