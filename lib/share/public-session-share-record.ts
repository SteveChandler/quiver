import { formatWindSpeed } from "@/lib/formatters/surf-data";
import { createPublicReadClient } from "@/lib/supabase/server";
import { sessionRatingStars } from "@/lib/share/session-rating";

/** What a PUBLIC session row says. Empty strings mean the surfer logged nothing there. */
export interface PublicSessionShareRecord {
  rating: number | null;
  beach: string;
  /** Empty when the beach has no timezone to place the date in. */
  date: string;
  waveHeight: string;
  windLabel: string;
  windSpeed: string;
  tagline: string;
  hasBoard: boolean;
}

export type PublicSessionShareLookup =
  | { status: "found"; record: PublicSessionShareRecord }
  /** Private, deleted or missing: the anon read returns no row. */
  | { status: "not-public" }
  /** The read failed or timed out, so nothing is known about the row. */
  | { status: "error" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOKUP_TIMEOUT_MS = 1500;

function isQuiverHost(hostname: string, requestHost: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === requestHost.toLowerCase() ||
    host === "quiversurf.app" ||
    host.endsWith(".quiversurf.app")
  );
}

/**
 * Both apps put the session page URL (`/sessions/{id}`) in the card's `shareUrl`.
 * A URL on another host is not a Quiver session page, so it gives no id.
 */
export function sessionIdFromShareUrl(
  value: string | null,
  requestHost: string,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!isQuiverHost(url.hostname, requestHost)) return null;
    const match = url.pathname.match(/^\/sessions\/([^/]+)\/?$/);
    const id = match ? decodeURIComponent(match[1]) : "";
    return UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function formatFeet(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function waveHeightText(row: {
  wave_height_ft: unknown;
  wave_height_min_ft: unknown;
  wave_height_max_ft: unknown;
}): string {
  const min = formatFeet(row.wave_height_min_ft);
  const max = formatFeet(row.wave_height_max_ft);
  if (min && max) return min === max ? min : `${min}-${max}`;
  return formatFeet(row.wave_height_ft);
}

function formatSessionDate(
  raw: string | null,
  timeZone: string | null,
): string {
  if (!raw || !timeZone) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
  } catch {
    return "";
  }
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

interface SessionShareRow {
  rating: unknown;
  beach_name: string | null;
  arrival_time: string | null;
  wave_height_ft: unknown;
  wave_height_min_ft: unknown;
  wave_height_max_ft: unknown;
  wind_direction: string | null;
  wind_speed_mph: unknown;
  notes: string | null;
  description: string | null;
  board_id: string | null;
  beach: { name: string | null; timezone: string | null } | null;
}

function toRecord(row: SessionShareRow): PublicSessionShareRecord {
  const mph =
    row.wind_speed_mph === null || row.wind_speed_mph === undefined
      ? NaN
      : Number(row.wind_speed_mph);
  return {
    rating: sessionRatingStars(row.rating),
    beach: trimmed(row.beach?.name) || trimmed(row.beach_name),
    date: formatSessionDate(row.arrival_time, row.beach?.timezone ?? null),
    waveHeight: waveHeightText(row),
    windLabel: trimmed(row.wind_direction),
    windSpeed: Number.isFinite(mph) ? formatWindSpeed(mph) : "",
    // Same order as the web session page: description, then notes.
    tagline: trimmed(row.description) || trimmed(row.notes),
    // boards are owner-only under RLS, so the name stays from the URL; the id says whether one was logged.
    hasBoard: Boolean(row.board_id),
  };
}

async function lookupOnce(
  sessionId: string,
): Promise<PublicSessionShareLookup> {
  try {
    const supabase = createPublicReadClient();
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "rating, beach_name, arrival_time, wave_height_ft, wave_height_min_ft, wave_height_max_ft, wind_direction, wind_speed_mph, notes, description, board_id, beach:beaches(name, timezone)",
      )
      .eq("id", sessionId)
      .eq("is_public", true)
      .is("deleted_at", null)
      .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS))
      .maybeSingle();
    if (error) return { status: "error" };
    if (!data) return { status: "not-public" };
    return {
      status: "found",
      record: toRecord(data as unknown as SessionShareRow),
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * Reads what the surfer logged for a PUBLIC session. The card is cached publicly,
 * so this uses a cookie-less anon client and filters to public, live rows.
 * One retry: a reused connection can stall past the timeout, and a card without
 * the surfer's rating is the cost of giving up.
 */
export async function lookupPublicSessionShare(
  sessionId: string,
): Promise<PublicSessionShareLookup> {
  const first = await lookupOnce(sessionId);
  return first.status === "error" ? lookupOnce(sessionId) : first;
}
