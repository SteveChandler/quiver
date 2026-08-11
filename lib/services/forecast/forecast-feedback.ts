import { z } from "zod";

export const FORECAST_FEEDBACK_CONTRACT_VERSION =
  "forecast-feedback-context.v1";
export const FORECAST_FEEDBACK_SCHEMA_VERSION = 1;

const contextRecordSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .default({});

const optionalContextRecordSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional();

const dateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a parseable datetime",
  });

const optionalDateTimeSchema = z
  .string()
  .min(1)
  .nullable()
  .optional()
  .refine((value) => value == null || !Number.isNaN(Date.parse(value)), {
    message: "Must be a parseable datetime",
  });

export const ObservedFaceHeightFtSchema = z
  .number()
  .finite()
  .min(0.5)
  .max(50)
  .refine((value) => Number.isInteger(value * 2), {
    message: "Observed face height must use 0.5 ft increments",
  });

export const ForecastFeedbackClientPayloadSchema = z
  .object({
    beachId: z.string().min(1),
    forecastAt: dateTimeSchema,
    windowStart: optionalDateTimeSchema,
    windowEnd: optionalDateTimeSchema,
    issuedAt: optionalDateTimeSchema,
    predictedAt: optionalDateTimeSchema,
    forecastHorizonHours: z.number().int().min(0).max(168).nullable().optional(),
    feedbackKind: z.enum([
      "forecast_accuracy",
      "surf_call",
      "condition_report",
      "other",
    ]),
    feedbackValue: z.string().min(1).max(120),
    feedbackNote: z.string().max(1000).nullable().optional(),
    observedFaceHeightFt: ObservedFaceHeightFtSchema.nullable().optional(),
    displayedContext: contextRecordSchema,
    sourceModelContext: contextRecordSchema,
    calibrationContext: contextRecordSchema,
    surfCallContext: contextRecordSchema,
    missingFlags: contextRecordSchema,
    auditMetadata: contextRecordSchema,
    clientSource: z.string().min(1).max(80).nullable().optional(),
    clientVersion: z.string().max(120).nullable().optional(),
    sessionId: z.string().max(120).nullable().optional(),
    anonymousClientId: z.string().max(120).nullable().optional(),
    correlationId: z.string().max(120).nullable().optional(),
    requestId: z.string().max(120).nullable().optional(),
    extraContext: optionalContextRecordSchema,
  })
  .superRefine((input, context) => {
    if (input.observedFaceHeightFt == null) return;

    const isMismatch =
      input.feedbackKind === "forecast_accuracy" &&
      (input.feedbackValue === "too_low" || input.feedbackValue === "too_high");
    if (isMismatch || input.feedbackKind === "condition_report") return;

    context.addIssue({
      code: "custom",
      path: ["observedFaceHeightFt"],
      message: "Observed face height is only valid for forecast mismatches",
    });
  });

export type ForecastFeedbackClientPayload = z.infer<
  typeof ForecastFeedbackClientPayloadSchema
>;

export interface SeasideForecastFeedbackPayload {
  user_id: string | null;
  session_id: string | null;
  anonymous_client_id: string | null;
  beach_id: string;
  forecast_at: string;
  window_start: string | null;
  window_end: string | null;
  issued_at: string | null;
  predicted_at: string | null;
  forecast_horizon_hours: number | null;
  feedback_kind: ForecastFeedbackClientPayload["feedbackKind"];
  feedback_value: string;
  feedback_note: string | null;
  displayed_context: Record<string, unknown>;
  source_model_context: Record<string, unknown>;
  calibration_context: Record<string, unknown>;
  surf_call_context: Record<string, unknown>;
  missing_flags: Record<string, unknown>;
  audit_metadata: Record<string, unknown>;
  client_source: string;
  client_version: string | null;
  schema_version: number;
  contract_version: string;
  ingest_path: string;
  request_id: string | null;
  correlation_id: string | null;
}

interface BuildSeasidePayloadOptions {
  userId: string | null;
  ingestPath: string;
  requestId: string;
  correlationId: string;
  clientSource: string;
  clientVersion?: string | null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasContext(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

export function buildSeasideForecastFeedbackPayload(
  input: ForecastFeedbackClientPayload,
  options: BuildSeasidePayloadOptions,
): SeasideForecastFeedbackPayload {
  const displayedContext = input.displayedContext ?? {};
  const sourceModelContext = input.sourceModelContext ?? {};
  const calibrationContext = input.calibrationContext ?? {};
  const surfCallContext = input.surfCallContext ?? {};
  const auditMetadata: Record<string, unknown> = {
    ...(input.auditMetadata ?? {}),
  };
  delete auditMetadata.user_observation;

  if (input.observedFaceHeightFt != null) {
    auditMetadata.user_observation = {
      face_height_ft: input.observedFaceHeightFt,
    };
  }
  const missingFlags: Record<string, unknown> = {
    ...(input.missingFlags ?? {}),
  };

  if (!hasContext(displayedContext)) missingFlags.displayed_context = true;
  if (!hasContext(sourceModelContext)) missingFlags.source_model_context = true;
  if (!hasContext(calibrationContext)) missingFlags.calibration_context = true;
  if (!hasContext(surfCallContext)) missingFlags.surf_call_context = true;

  const clientSource =
    optionalString(input.clientSource) ?? options.clientSource;
  const clientVersion =
    optionalString(input.clientVersion) ??
    optionalString(options.clientVersion) ??
    null;

  return {
    user_id: options.userId,
    session_id: optionalString(input.sessionId),
    anonymous_client_id: optionalString(input.anonymousClientId),
    beach_id: input.beachId,
    forecast_at: input.forecastAt,
    window_start: input.windowStart ?? null,
    window_end: input.windowEnd ?? null,
    issued_at: input.issuedAt ?? null,
    predicted_at: input.predictedAt ?? null,
    forecast_horizon_hours: input.forecastHorizonHours ?? null,
    feedback_kind: input.feedbackKind,
    feedback_value: input.feedbackValue,
    feedback_note: optionalString(input.feedbackNote),
    displayed_context: displayedContext,
    source_model_context: sourceModelContext,
    calibration_context: calibrationContext,
    surf_call_context: surfCallContext,
    missing_flags: missingFlags,
    audit_metadata: {
      ...auditMetadata,
      ...(input.extraContext ? { extra_context: input.extraContext } : {}),
    },
    client_source: clientSource,
    client_version: clientVersion,
    schema_version: FORECAST_FEEDBACK_SCHEMA_VERSION,
    contract_version: FORECAST_FEEDBACK_CONTRACT_VERSION,
    ingest_path: options.ingestPath,
    request_id: optionalString(input.requestId) ?? options.requestId,
    correlation_id: optionalString(input.correlationId) ?? options.correlationId,
  };
}
