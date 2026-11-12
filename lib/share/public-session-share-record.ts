import { createPublicReadClient } from "@/lib/supabase/server";
import { sessionRatingStars } from "@/lib/share/session-rating";

export interface PublicSessionShareRecord {
  rating: number | null;
  waveHeight: string;
  hasBoard: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOKUP_TIMEOUT_MS = 1500;

/** Both apps put the session page URL (`/sessions/{id}`) in the card's `shareUrl`. */
export function sessionIdFromShareUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const match = new URL(value).pathname.match(/^\/sessions\/([^/]+)\/?$/);
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

/**
 * Reads what the surfer logged for a PUBLIC session. The card is cached publicly,
 * so this uses a cookie-less anon client and filters to public, live rows: a private
 * session returns null and the card keeps the caller's URL params.
 */
export async function readPublicSessionShareRecord(
  sessionId: string,
): Promise<PublicSessionShareRecord | null> {
  try {
    const supabase = createPublicReadClient();
    const query = supabase
      .from("sessions")
      .select(
        "rating, wave_height_ft, wave_height_min_ft, wave_height_max_ft, board_id",
      )
      .eq("id", sessionId)
      .eq("is_public", true)
      .is("deleted_at", null)
      .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS))
      .maybeSingle();
    const { data, error } = await query;
    if (error || !data) return null;

    return {
      rating: sessionRatingStars(data.rating),
      waveHeight: waveHeightText(data),
      // boards are owner-only under RLS, so the name stays from the URL; the id says whether one was logged.
      hasBoard: Boolean(data.board_id),
    };
  } catch {
    return null;
  }
}
