import { z } from "zod";

export const DAILY_CALL_SCHEMA_VERSION = "daily-call.v1" as const;

export const dailyCallPayloadSchema = z.object({
  schema_version: z.literal(DAILY_CALL_SCHEMA_VERSION),
  beach_id: z.string().uuid(),
  beach_slug: z.string().min(1),
  beach_name: z.string().min(1),
  alert_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  window_local: z.string().min(1),
  drivers: z.array(
    z.object({
      kind: z.enum(["tide", "wind", "swell", "daylight"]),
      edge: z.enum(["start", "end"]),
      at: z.string().datetime(),
      approximate: z.boolean(),
      label: z.string(),
    }),
  ),
  wave_height_ft: z.number(),
  wave_period_s: z.number(),
  swell_dir: z.string(),
  wind_label: z.string(),
  tide_label: z.string(),
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
