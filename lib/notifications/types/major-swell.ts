import { z } from "zod";

export const MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION =
  "major-swell-notification.v1" as const;

const instantSchema = z.string().datetime({ offset: true });
const cohortsSchema = z.array(
  z.enum(["beginner", "intermediate", "unknown"]),
);
const enforcementSchema = z.object({
  hold_id: z.string().uuid(),
  hold_record_id: z.string().uuid(),
  hold_valid_until: instantSchema,
}).strict();

const baseSchema = z.object({
  schema_version: z.literal(MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION),
  beach_id: z.string().uuid(),
  beach_slug: z.string().min(1).optional(),
  beach_name: z.string().min(1),
  awareness_severity: z.enum(["significant", "major"]),
  would_suppress_cohorts: cohortsSchema,
  title: z.string().min(1),
  body: z.string().min(1),
});

const physicalEventSchema = {
  event_start_date: z.string().date(),
  peak_date: z.string().date(),
  peak_height_ft: z.number().positive(),
  peak_period_s: z.number().positive(),
  forecast_at: instantSchema,
};

const shadowFields = {
  awareness_mode: z.literal("shadow"),
  automation_enabled: z.literal(false),
  enforcement: z.null(),
};

const enforceFields = {
  awareness_mode: z.literal("enforce"),
  automation_enabled: z.literal(true),
  enforcement: enforcementSchema,
};

const forecastTrendSchema = baseSchema.extend({
  ...physicalEventSchema,
  ...shadowFields,
  awareness_signal: z.literal("forecast_trend"),
  official_evidence_refs: z.array(z.string().min(1)).length(0),
}).strict();

const officialAdvisorySchema = baseSchema.extend({
  event_start_date: z.null(),
  peak_date: z.null(),
  peak_height_ft: z.null(),
  peak_period_s: z.null(),
  forecast_at: z.null(),
  ...shadowFields,
  awareness_signal: z.literal("official_advisory"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

const officialAdvisoryEnforceSchema = baseSchema.extend({
  event_start_date: z.null(),
  peak_date: z.null(),
  peak_height_ft: z.null(),
  peak_period_s: z.null(),
  forecast_at: z.null(),
  ...enforceFields,
  awareness_signal: z.literal("official_advisory"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

const corroboratedShadowSchema = baseSchema.extend({
  ...physicalEventSchema,
  ...shadowFields,
  awareness_signal: z.literal("corroborated"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

const corroboratedEnforceSchema = baseSchema.extend({
  ...physicalEventSchema,
  ...enforceFields,
  awareness_signal: z.literal("corroborated"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

export const majorSwellNotificationPayloadSchema = z.union([
  forecastTrendSchema,
  officialAdvisorySchema,
  officialAdvisoryEnforceSchema,
  corroboratedShadowSchema,
  corroboratedEnforceSchema,
]);

export type MajorSwellNotificationPayload = z.infer<
  typeof majorSwellNotificationPayloadSchema
>;

const legacyForecastTrendSchema = z.object({
  schema_version: z.undefined(),
  beach_id: z.string().min(1),
  beach_slug: z.string().min(1).optional(),
  beach_name: z.string().min(1),
  event_start_date: z.string().date(),
  peak_date: z.string().date(),
  peak_height_ft: z.number().positive(),
  peak_period_s: z.number().positive(),
  forecast_at: instantSchema,
  awareness_mode: z.literal("shadow"),
  automation_enabled: z.literal(false).optional(),
  awareness_signal: z.literal("forecast_trend"),
  awareness_severity: z.enum(["significant", "major"]),
  official_evidence_refs: z.array(z.string()).optional(),
  would_suppress_cohorts: cohortsSchema.optional(),
  title: z.string().min(1),
  body: z.string().min(1),
}).passthrough();

export function parseMajorSwellNotificationPayload(
  value: unknown,
): MajorSwellNotificationPayload {
  const current = majorSwellNotificationPayloadSchema.safeParse(value);
  if (current.success) return current.data;

  const legacy = legacyForecastTrendSchema.parse(value);
  return forecastTrendSchema.parse({
    ...legacy,
    schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    automation_enabled: false,
    official_evidence_refs: [],
    would_suppress_cohorts:
      legacy.would_suppress_cohorts ??
      ["beginner", "intermediate", "unknown"],
    enforcement: null,
  });
}
