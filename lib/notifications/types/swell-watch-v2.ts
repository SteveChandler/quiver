import { z } from "zod";
import {
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from "./major-swell";

const SWELL_WATCH_NOTIFICATION_SCHEMA_VERSION =
  "swell-watch-notification.v2" as const;

const instantSchema = z.string().datetime({ offset: true });
const partitionSchema = z
  .object({
    height_m: z.number().finite().positive(),
    period_s: z.number().finite().positive(),
    direction_deg: z.number().finite().min(0).lt(360),
  })
  .strict();
const copyContextSchema = z
  .object({ beach_timezone: z.string().min(1) })
  .strict();

const swellWatchV2NotificationPayloadSchema = z
  .object({
    type: z.literal("swell_watch"),
    schema_version: z.literal(SWELL_WATCH_NOTIFICATION_SCHEMA_VERSION),
    regional_event_id: z.string().uuid(),
    beach_id: z.string().uuid(),
    beach_slug: z.string().min(1).optional(),
    forecast_at: instantSchema,
    copy_context: copyContextSchema.optional(),
    target_partition: partitionSchema,
    arrival_at: instantSchema.nullable().optional(),
    peak_at: instantSchema.nullable().optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    if (
      payload.arrival_at !== null &&
      payload.arrival_at !== undefined &&
      payload.peak_at !== null &&
      payload.peak_at !== undefined &&
      Date.parse(payload.peak_at) < Date.parse(payload.arrival_at)
    ) {
      context.addIssue({
        code: "custom",
        path: ["peak_at"],
        message: "peak_at must not precede arrival_at",
      });
    }
  });

export type SwellWatchV2NotificationPayload = z.infer<
  typeof swellWatchV2NotificationPayloadSchema
>;

export type SwellWatchNotificationPayload =
  | (MajorSwellNotificationPayload & { kind: "v1" })
  | (SwellWatchV2NotificationPayload & {
      kind: "v2";
      title: string;
      body: string;
    });

interface BuildSwellWatchCopyInput {
  arrivalAt: string | null | undefined;
  peakAt: string | null | undefined;
  timezone?: string;
  maxBodyLength?: number;
}

const COPY_TITLE = "Swell incoming.";
const COPY_TONE = "Productivity has been cancelled.";
const DEFAULT_MAX_BODY_LENGTH = 140;

function formatWeekday(instant: string | null | undefined, timezone?: string): string | null {
  if (instant === null || instant === undefined || timezone === undefined) return null;
  const timestamp = Date.parse(instant);
  if (!Number.isFinite(timestamp)) return null;

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(new Date(timestamp));
  } catch {
    return null;
  }
}

function truncateCopy(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return "…".slice(0, maxLength);
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildSwellWatchCopy(input: BuildSwellWatchCopyInput): {
  title: string;
  body: string;
} {
  const maxBodyLength = input.maxBodyLength ?? DEFAULT_MAX_BODY_LENGTH;
  if (!Number.isSafeInteger(maxBodyLength) || maxBodyLength <= 0) {
    throw new Error("Swell Watch copy maxBodyLength must be a positive integer");
  }
  const arrival = formatWeekday(input.arrivalAt, input.timezone);
  const peak = formatWeekday(input.peakAt, input.timezone);
  const timing = [
    arrival ? `Arrives ${arrival}.` : null,
    peak ? `Peaks ${peak}.` : null,
  ].filter((value): value is string => value !== null);
  const body = [COPY_TONE, ...timing].join(" ");
  return {
    title: COPY_TITLE,
    body: truncateCopy(body, maxBodyLength),
  };
}

export function parseSwellWatchNotificationPayload(
  value: unknown,
): SwellWatchNotificationPayload {
  if (
    typeof value === "object" &&
    value !== null &&
    "schema_version" in value &&
    value.schema_version === SWELL_WATCH_NOTIFICATION_SCHEMA_VERSION
  ) {
    return parseSwellWatchV2Payload(value);
  }

  return {
    ...parseMajorSwellNotificationPayload(value),
    kind: "v1",
  };
}

function parseSwellWatchV2Payload(value: unknown): SwellWatchNotificationPayload {
  const parsed = swellWatchV2NotificationPayloadSchema.parse(value);
  return {
    ...parsed,
    kind: "v2",
    ...buildSwellWatchCopy({
      arrivalAt: parsed.arrival_at,
      peakAt: parsed.peak_at,
      timezone: parsed.copy_context?.beach_timezone,
    }),
  };
}

export function normalizeSwellWatchNotificationPayload(
  value: unknown,
): SwellWatchNotificationPayload {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return parseSwellWatchNotificationPayload(value);
  }
  const normalized = value as Record<string, unknown>;

  if (normalized.kind === "v1") {
    const { kind: _kind, ...rawV1 } = normalized;
    return {
      ...parseMajorSwellNotificationPayload(rawV1),
      kind: "v1",
    };
  }

  if (normalized.kind === "v2") {
    const { kind: _kind, title: _title, body: _body, ...rawV2 } = normalized;
    return parseSwellWatchV2Payload(rawV2);
  }

  throw new Error("Unknown Swell Watch payload normalization kind");
}

export function buildSwellWatchDedupeKey(
  payload: SwellWatchNotificationPayload,
): string | null {
  if (payload.kind === "v1") return null;
  return `swell_watch:${payload.regional_event_id}`;
}

export function toSwellWatchClientData(
  value: unknown,
): Record<string, unknown> {
  const payload = normalizeSwellWatchNotificationPayload(value);
  if (payload.kind === "v1") {
    return {
      type: "swell_watch",
      beach_id: payload.beach_id,
      ...(payload.beach_slug ? { beach_slug: payload.beach_slug } : {}),
      ...(payload.forecast_at ? { forecast_at: payload.forecast_at } : {}),
    };
  }

  return {
    type: "swell_watch",
    version: "2",
    regional_event_id: payload.regional_event_id,
    beach_id: payload.beach_id,
    ...(payload.beach_slug ? { beach_slug: payload.beach_slug } : {}),
    forecast_at: payload.forecast_at,
    target_partition: payload.target_partition,
    ...(payload.arrival_at ? { arrival_at: payload.arrival_at } : {}),
    ...(payload.peak_at ? { peak_at: payload.peak_at } : {}),
  };
}
