import { NextRequest } from "next/server";

import {
  createSuccessResponse,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALERT_TYPES = [
  "forecast_alert",
  "similarity_match",
  "swell_watch",
  "watched_call_update",
] as const;
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
  category?: string;
  cause?: string;
  alert_rule_id?: string;
  recommendation_id?: string;
  prior_recommendation_id?: string;
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

type CanonicalContext =
  | { state: "absent" }
  | { state: "no" }
  | {
      state: "positive";
      selection: Record<string, unknown>;
      forecastRef: Record<string, unknown> | null;
    };

function canonicalContext(
  data: Record<string, unknown>,
): CanonicalContext {
  const decision = data.session_decision;
  if (!isRecord(decision)) return { state: "absent" };
  if (decision.verdict === "no") return { state: "no" };
  if (!isRecord(decision.selection)) return { state: "absent" };
  return {
    state: "positive",
    selection: decision.selection,
    forecastRef: isRecord(decision.selection.forecastRef)
      ? decision.selection.forecastRef
      : null,
  };
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

function stringFromRecord(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = nonEmptyString(record[key]);
    if (value) return value;
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
  const canonical = canonicalContext(data);
  const match =
    canonical.state === "positive"
      ? canonical.selection
      : canonical.state === "absent"
        ? firstMatch(data)
        : null;
  const useTopLevelContext = canonical.state !== "no";
  const contextString = (keys: string[]): string | null => {
    if (!useTopLevelContext) return null;
    if (canonical.state === "positive") {
      return (
        stringFromRecord(canonical.selection, keys) ??
        stringFromRecord(data, keys)
      );
    }
    return stringFromData(data, match, keys);
  };
  const beachName = contextString(["beach_name", "beachName"]);
  const forecastAt =
    canonical.state === "positive"
      ? stringFromRecord(canonical.forecastRef, ["forecast_at", "forecastAt"]) ??
        contextString(["forecast_at", "forecastAt"])
      : contextString(["forecast_at", "forecastAt"]);
  const reason =
    canonical.state === "no"
      ? null
      : nonEmptyString(data.reason) ?? nonEmptyString(data.condition_summary);
  const windowStart =
    canonical.state === "no"
      ? null
      : canonical.state === "positive"
        ? stringFromRecord(canonical.selection, ["window_start", "windowStart"])
      : row.type === "similarity_match"
        ? forecastAt
        : match
          ? stringFromData({}, match, ["window_start", "windowStart"])
          : null;
  const windowEnd =
    canonical.state === "no"
      ? null
      : canonical.state === "positive"
        ? stringFromRecord(canonical.selection, ["window_end", "windowEnd"])
        : row.type === "similarity_match"
          ? null
          : match
            ? stringFromData({}, match, ["window_end", "windowEnd"])
            : null;

  const watched = row.type === "watched_call_update";
  return {
    id: row.id,
    type: row.type,
    title: titleFor(row, data, beachName),
    body: bodyFor(row, data),
    beach_id: contextString(["beach_id", "beachId"]),
    beach_slug: contextString(["beach_slug", "beachSlug"]),
    beach_name: beachName,
    forecast_at: forecastAt,
    alert_date: stringFromData(data, null, ["alert_date", "alertDate"]),
    window_start: watched ? nonEmptyString(data.window_start) : windowStart,
    window_end: watched ? nonEmptyString(data.window_end) : windowEnd,
    reason,
    window_label: canonical.state === "no" ? null : stringFromData(data, match, [
      "window_label",
      "window_local",
      "display_time_label",
    ]),
    score: canonical.state === "no" ? null : finiteNumber(data.score),
    read_at: row.read_at,
    created_at: row.created_at,
    ...(watched && nonEmptyString(data.category)
      ? { category: nonEmptyString(data.category)! }
      : {}),
    ...(watched && nonEmptyString(data.cause)
      ? { cause: nonEmptyString(data.cause)! }
      : {}),
    ...(watched && nonEmptyString(data.alert_rule_id)
      ? { alert_rule_id: nonEmptyString(data.alert_rule_id)! }
      : {}),
    ...(watched && nonEmptyString(data.recommendation_id)
      ? { recommendation_id: nonEmptyString(data.recommendation_id)! }
      : {}),
    ...(watched && nonEmptyString(data.prior_recommendation_id)
      ? { prior_recommendation_id: nonEmptyString(data.prior_recommendation_id)! }
      : {}),
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
