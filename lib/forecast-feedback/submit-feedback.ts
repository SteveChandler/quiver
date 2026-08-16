import { randomUUID } from "crypto";
import {
  buildSeasideForecastFeedbackPayload,
  type ForecastFeedbackClientPayload,
} from "@/lib/services/forecast/forecast-feedback";
import { createServiceRoleClient } from "@/lib/supabase";
import type { SupabaseServerClient } from "@/types/supabase";
import type { Json } from "@/types/database.generated";

type SeasideFeedbackResponse = {
  ok?: boolean;
  id?: string | null;
  contract_version?: string;
  correlation_id?: string | null;
};

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
        | "not_configured"
        | "forecast_lookup_failed"
        | "forecast_not_found"
        | "vote_storage_failed"
        | "network_error"
        | "seaside_error";
      correlationId: string;
      status?: number;
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

function readMlServiceUrl(): string {
  return (normalizedEnv("ML_SERVICE_URL") ?? "https://quiver-ml.fly.dev").replace(
    /\/+$/,
    "",
  );
}

function readMlInternalSecret(): string | null {
  return normalizedEnv("ML_INTERNAL_SECRET") ?? normalizedEnv("INTERNAL_SECRET");
}

export function isForecastFeedbackServiceConfigured(): boolean {
  return readMlInternalSecret() !== null;
}

async function parseJsonResponse(
  response: Response,
): Promise<SeasideFeedbackResponse | null> {
  try {
    return (await response.json()) as SeasideFeedbackResponse;
  } catch {
    return null;
  }
}

async function findExistingFeedbackContext(
  userId: string,
  requestId: string,
): Promise<ExistingFeedbackContext | null> {
  try {
    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient
      .from("forecast_feedback_contexts")
      .select("id,contract_version,correlation_id")
      .eq("user_id", userId)
      .eq("request_id", requestId)
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
  const secret = readMlInternalSecret();
  const correlationId = input.correlationId ?? randomUUID();
  const requestId = input.requestId ?? randomUUID();

  if (!secret) {
    return { success: false, reason: "not_configured", correlationId };
  }

  if (options.requireForecast) {
    const forecast = await resolveForecastId(context.supabase, input);
    if (forecast.error) {
      return { success: false, reason: "forecast_lookup_failed", correlationId };
    }
    if (!forecast.id) {
      return { success: false, reason: "forecast_not_found", correlationId };
    }
  }

  const existing = await findExistingFeedbackContext(context.user.id, requestId);
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
    ingestPath: options.ingestPath ?? "quiver-api/forecast-feedback",
    requestId,
    correlationId,
    clientSource: options.clientSource ?? "quiver-web",
    clientVersion:
      normalizedEnv("VERCEL_GIT_COMMIT_SHA") ??
      normalizedEnv("NEXT_PUBLIC_VERCEL_ENV"),
  });

  let response: Response;
  try {
    response = await fetch(`${readMlServiceUrl()}/internal/forecast-feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    const recovered = await findExistingFeedbackContext(context.user.id, requestId);
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
    return { success: false, reason: "network_error", correlationId };
  }

  const responseBody = await parseJsonResponse(response);
  if (!response.ok || responseBody?.ok !== true) {
    const recovered = await findExistingFeedbackContext(context.user.id, requestId);
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
      reason: "seaside_error",
      correlationId,
      status: response.status,
    };
  }

  return {
    success: true,
    data: {
      id: responseBody.id ?? null,
      contractVersion: responseBody.contract_version ?? payload.contract_version,
      correlationId: responseBody.correlation_id ?? correlationId,
    },
  };
}
