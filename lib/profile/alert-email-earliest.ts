import { z } from "zod";

/** profiles.alert_email_earliest: the local time a condition alert email may start. '09:00' is the rule before the setting existed. */
export const ALERT_EMAIL_EARLIEST_VALUES = ["05:00", "06:00", "07:00", "09:00"] as const;
export type AlertEmailEarliest = (typeof ALERT_EMAIL_EARLIEST_VALUES)[number];
export const DEFAULT_ALERT_EMAIL_EARLIEST: AlertEmailEarliest = "09:00";
export const alertEmailEarliestSchema = z.enum(ALERT_EMAIL_EARLIEST_VALUES);

/**
 * True only for "the column is not there yet" (before 20261117140000 is applied):
 * Postgres undefined_column on a read, PostgREST's schema-cache miss on a write.
 */
export function isMissingAlertEmailEarliestColumn(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message : "";
  if (!text.includes("alert_email_earliest")) return false;
  return code === "42703" || code === "PGRST204";
}
