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
  type ForecastFeedbackClientPayload,
} from "@/lib/services/forecast/forecast-feedback";
import {
  isForecastFeedbackServiceConfigured,
  submitForecastFeedback,
} from "@/lib/forecast-feedback/submit-feedback";

export const dynamic = "force-dynamic";

async function forecastFeedbackHandler(
  request: NextRequest,
  context: AuthenticatedContext,
): Promise<NextResponse> {
  if (!isForecastFeedbackServiceConfigured()) {
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

  const result = await submitForecastFeedback(context, validation.data);
  if (result.success) return createSuccessResponse(result.data);
  if (result.reason === "not_configured") {
    return createErrorResponse("Feedback service not configured", undefined, 500);
  }
  if (result.reason === "vote_storage_failed") {
    return createErrorResponse(
      "Forecast vote storage failed",
      { correlationId: result.correlationId },
      500,
    );
  }
  if (result.reason === "network_error") {
    return createErrorResponse(
      "Feedback storage failed",
      { correlationId: result.correlationId, service: "seaside", status: "network_error" },
      502,
    );
  }
  return createErrorResponse(
    "Feedback storage failed",
    { correlationId: result.correlationId, service: "seaside", status: result.status },
    502,
  );
}

export const POST = withAuth(forecastFeedbackHandler, {
  errorMessage: "Failed to submit forecast feedback",
});
