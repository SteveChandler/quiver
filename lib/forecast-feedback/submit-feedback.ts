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

export interface ForecastFeedbackContext {
  user: { id: string };
  supabase: SupabaseServerClient;
}

export interface SubmitForecastFeedbackOptions {
  ingestPath?: string;
  clientSource?: string;
  requireForecast?: boolean;
}

export type SubmitForecastFeedbackResult =
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

async function resolveForecastId(
  supabase: SupabaseServerClient,
  input: ForecastFeedbackClientPayload,
): Promise<{ id: string | null; error: boolean }> {
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("id")
    .eq("beach_id", input.beachId)
    .eq("forecast_at", input.forecastAt)
    .maybeSingle();
  return { id: data?.id ?? null, error: Boolean(error) };
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
): Promise<void> {
  const wasAccurate = forecastAccuracyVoteValue(input);
  if (wasAccurate == null) return;

  const forecast = await resolveForecastId(context.supabase, input);
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

  if (options.requireForecast) {
    const forecast = await resolveForecastId(context.supabase, input);
    if (forecast.error) {
      return { success: false, reason: "forecast_lookup_failed", correlationId };
    }
    if (!forecast.id) {
      return { success: false, reason: "forecast_not_found", correlationId };
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
    await persistForecastAccuracyVote(context, input);
  } catch {
    return { success: false, reason: "vote_storage_failed", correlationId };
  }

  const payload = buildSeasideForecastFeedbackPayload(input, {
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
    const { data, error } = await serviceClient
      .from("forecast_feedback_contexts")
      .insert(
        payload as Database["public"]["Tables"]["forecast_feedback_contexts"]["Insert"],
      )
      .select("id,contract_version,correlation_id")
      .single();
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
