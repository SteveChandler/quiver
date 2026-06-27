import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationError,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  ForecastFeedbackClientPayloadSchema,
  buildSeasideForecastFeedbackPayload,
  type ForecastFeedbackClientPayload,
} from "@/lib/services/forecast/forecast-feedback";
import type { Json } from "@/types/database.generated";

export const dynamic = "force-dynamic";

type SeasideFeedbackResponse = {
  ok?: boolean;
  id?: string | null;
  contract_version?: string;
  correlation_id?: string | null;
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
  return (
    normalizedEnv("ML_SERVICE_URL") ?? "https://quiver-ml.fly.dev"
  ).replace(/\/+$/, "");
}

function readMlInternalSecret(): string | null {
  return normalizedEnv("ML_INTERNAL_SECRET") ?? normalizedEnv("INTERNAL_SECRET");
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
  { user, supabase }: AuthenticatedContext,
  input: ForecastFeedbackClientPayload,
): Promise<void> {
  const wasAccurate = forecastAccuracyVoteValue(input);
  if (wasAccurate == null) return;

  const { data: forecast, error: forecastError } = await supabase
    .from("enhanced_forecasts")
    .select("id")
    .eq("beach_id", input.beachId)
    .eq("forecast_at", input.forecastAt)
    .maybeSingle();

  if (forecastError) {
    throw new Error("Forecast vote target lookup failed");
  }

  if (!forecast?.id) {
    throw new Error("Forecast vote target not found");
  }

  const { error } = await supabase
    .from("forecast_accuracy_votes")
    .upsert(
      {
        user_id: user.id,
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

  if (error) {
    throw new Error("Forecast vote storage failed");
  }
}

async function forecastFeedbackHandler(
  request: NextRequest,
  context: AuthenticatedContext,
): Promise<NextResponse> {
  const secret = readMlInternalSecret();
  if (!secret) {
    return createErrorResponse("Feedback service not configured", undefined, 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createValidationError("Invalid feedback payload", {
      body: "Request body must be valid JSON",
    });
  }

  const validation = ForecastFeedbackClientPayloadSchema.safeParse(rawBody);
  if (!validation.success) {
    return createValidationError(
      "Invalid feedback payload",
      validation.error.flatten(),
    );
  }

  const correlationId = validation.data.correlationId ?? randomUUID();
  const requestId = validation.data.requestId ?? randomUUID();

  try {
    await persistForecastAccuracyVote(context, validation.data);
  } catch {
    return createErrorResponse(
      "Forecast vote storage failed",
      { correlationId },
      500,
    );
  }

  const payload = buildSeasideForecastFeedbackPayload(validation.data, {
    userId: context.user.id,
    ingestPath: "quiver-api/forecast-feedback",
    requestId,
    correlationId,
    clientSource: "quiver-web",
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
    return createErrorResponse(
      "Feedback storage failed",
      { correlationId, service: "seaside", status: "network_error" },
      502,
    );
  }

  const responseBody = await parseJsonResponse(response);
  if (!response.ok || responseBody?.ok !== true) {
    return createErrorResponse(
      "Feedback storage failed",
      { correlationId, service: "seaside", status: response.status },
      502,
    );
  }

  return createSuccessResponse({
    id: responseBody.id ?? null,
    contractVersion: responseBody.contract_version ?? payload.contract_version,
    correlationId: responseBody.correlation_id ?? correlationId,
  });
}

export const POST = withAuth(forecastFeedbackHandler, {
  errorMessage: "Failed to submit forecast feedback",
});
