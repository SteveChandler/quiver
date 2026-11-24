import { z } from "zod";

export const DAILY_CALL_SCHEMA_VERSION = "daily-call.v1" as const;

export const dailyCallPayloadSchema = z.object({
  schema_version: z.literal(DAILY_CALL_SCHEMA_VERSION),
  anchor_source: z.enum(["location", "home", "none"]).optional(),
  beach_id: z.string().uuid(),
  beach_slug: z.string().min(1),
  beach_name: z.string().min(1),
  alert_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  window_local: z.string().min(1),
  options: z.array(z.object({
    beach_id: z.string().uuid(),
    beach_slug: z.string().min(1),
    beach_name: z.string().min(1),
    window_start: z.string().datetime(),
    window_end: z.string().datetime(),
    window_local: z.string().min(1),
    wave_height_ft: z.number().nullable(),
    relation: z.enum(["home", "favorite", "custom", "nearby"]),
  })).max(2).optional(),
  drivers: z.array(
    z.object({
      kind: z.enum(["tide", "wind", "swell", "daylight"]),
      edge: z.enum(["start", "end"]),
      at: z.string().datetime(),
      approximate: z.boolean(),
      label: z.string(),
    }),
  ),
  // Null when the forecast row has no value; no app or SQL reads these fields.
  wave_height_ft: z.number().nullable(),
  wave_period_s: z.number().nullable(),
  swell_dir: z.string().nullable(),
  wind_label: z.string(),
  tide_label: z.string().nullable(),
  reason: z.string().min(1),
  title: z.string().min(1).max(40),
  title_id: z.string(),
  comparison: z.string().nullable(),
  swell_event_key: z.string().nullable(),
  decision_id: z.string(),
  session_decision: z.unknown(),
});

export type DailyCallPayload = z.infer<typeof dailyCallPayloadSchema>;

export function parseDailyCallPayload(input: unknown): DailyCallPayload {
  return dailyCallPayloadSchema.parse(input);
}
