import { NextRequest } from "next/server";

import {
  createSuccessResponse,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALERT_TYPES = ["forecast_alert", "similarity_match", "swell_watch"] as const;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 7;
const MAX_ROWS = 100;

type AlertType = (typeof ALERT_TYPES)[number];

interface NotificationRow {
  id: string;
  type: AlertType;
  data: unknown;
  read_at: string | null;
  created_at: string;
}

interface AlertActivityItem {
  id: string;
  type: AlertType;
  title: string;
  body: string;
  beach_id: string | null;
  beach_slug: string | null;
  beach_name: string | null;
  forecast_at: string | null;
  alert_date: string | null;
  window_start: string | null;
  window_end: string | null;
  reason: string | null;
  window_label: string | null;
  score: number | null;
  read_at: string | null;
  created_at: string;
}

function parseDays(rawDays: string | null): number {
  const parsed = Number(rawDays);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_DAYS;
  return Math.min(Math.floor(parsed), MAX_DAYS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstMatch(data: Record<string, unknown>): Record<string, unknown> | null {
  const matches = data.matches;
  if (!Array.isArray(matches)) return null;
  const first = matches.find(isRecord);
  return first ?? null;
}

function stringFromData(
  data: Record<string, unknown>,
  match: Record<string, unknown> | null,
  keys: string[],
): string | null {
  for (const key of keys) {
    const fromData = nonEmptyString(data[key]);
    if (fromData) return fromData;
    const fromMatch = match ? nonEmptyString(match[key]) : null;
    if (fromMatch) return fromMatch;
  }
  return null;
}

function titleFor(
  row: NotificationRow,
  data: Record<string, unknown>,
  beachName: string | null,
): string {
  const explicit = nonEmptyString(data.title);
  if (explicit) return explicit;

  if (row.type === "similarity_match") {
    const label = nonEmptyString(data.label);
    const prefix = label ? `${label} match` : "Match";
    return beachName ? `${prefix} at ${beachName}` : prefix;
  }

  return "Forecast alert";
}

function bodyFor(row: NotificationRow, data: Record<string, unknown>): string {
  const explicit = nonEmptyString(data.body);
  if (explicit) return explicit;

  if (row.type === "similarity_match") {
    return (
      nonEmptyString(data.reason) ??
      nonEmptyString(data.condition_summary) ??
      "A watched surf window matched your preferences."
    );
  }

  return "A watched surf window is lining up.";
}

function normalizeActivityItem(row: NotificationRow): AlertActivityItem {
  const data = isRecord(row.data) ? row.data : {};
  const match = firstMatch(data);
  const beachName = stringFromData(data, match, ["beach_name", "beachName"]);
  const forecastAt = stringFromData(data, match, ["forecast_at", "forecastAt"]);
  const reason =
    nonEmptyString(data.reason) ?? nonEmptyString(data.condition_summary);
  const windowStart =
    row.type === "similarity_match"
      ? forecastAt
      : match
        ? nonEmptyString(match.window_start)
        : null;
  const windowEnd =
    row.type === "similarity_match"
      ? null
      : match
        ? nonEmptyString(match.window_end)
        : null;

  return {
    id: row.id,
    type: row.type,
    title: titleFor(row, data, beachName),
    body: bodyFor(row, data),
    beach_id: stringFromData(data, match, ["beach_id", "beachId"]),
    beach_slug: stringFromData(data, match, ["beach_slug", "beachSlug"]),
    beach_name: beachName,
    forecast_at: forecastAt,
    alert_date: stringFromData(data, match, ["alert_date", "alertDate"]),
    window_start: windowStart,
    window_end: windowEnd,
    reason,
    window_label: stringFromData(data, match, [
      "window_label",
      "window_local",
      "display_time_label",
    ]),
    score: finiteNumber(data.score),
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

export const GET = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const url = new URL(request.url);
    const days = parseDays(url.searchParams.get("days"));
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await (supabase as any)
      .from("notifications")
      .select("id, type, data, read_at, created_at")
      .eq("user_id", user.id)
      .in("type", ALERT_TYPES)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      throw new Error(error.message);
    }

    const activity = ((data ?? []) as NotificationRow[]).map(
      normalizeActivityItem,
    );

    return createSuccessResponse({ days, activity });
  },
  { errorMessage: "Failed to fetch alert activity" },
);
