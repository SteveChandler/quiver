/**
 * Pure picker for the similarity-alerts cron.
 *
 * Given a flat array of (already-scored, already-ready) slots across one or
 * more candidate beaches for a single user, returns the single best slot to
 * fire an alert on, or null if nothing qualifies.
 *
 * Selection rules:
 *  1. Drop slots with score < scoreThreshold or non-finite score.
 *  2. Drop slots whose forecast_at falls in the user-local night window
 *     [rejectStartHourLocal, 24) ∪ [0, rejectEndHourLocal). Defaults are
 *     22:00 and 06:00 — no surf alert at 3am even if the score is high.
 *     Each slot's `beach_timezone` is used for the local-hour conversion so a
 *     west-coast slot and an east-coast slot at the same UTC are evaluated
 *     against their own local clocks.
 *  3. Sort by match score, match confidence, physical utility, earliest
 *     forecast, then a stable beach/window ID.
 *  4. Return the head, or null on empty.
 *
 * The surfability filters live upstream in the cron — by the time the picker
 * sees the slots, the caller has already decided which forecasts are eligible.
 * This keeps the picker pure and unit-testable.
 */

export interface ScoredSlot {
  beach_id: string;
  beach_name: string;
  beach_slug: string;
  forecast_at: string; // ISO timestamp (UTC)
  beach_timezone: string; // IANA timezone for the picked beach
  score: number;
  label: string | null;
  reason: string | null;
  match_confidence?: "low" | "medium" | "high";
  condition_score?: number;
  /**
   * Conditions snapshot fields stamped at scoring time so the cron can
   * forward them into the notifications payload (window_local label,
   * wave_height_ft, wave_period_s) without re-fetching the forecast row.
   *
   * The schema (`lib/notifications/types/similarity-match.ts`) requires
   * window_local + wave_height_ft + wave_period_s; the picker passes the
   * winning slot's values straight through.
   */
  window_local: string;
  wave_height_ft: number;
  wave_period_s: number;
}

export interface PickArgs {
  scoredSlots: ScoredSlot[];
  scoreThreshold: number;
  rejectStartHourLocal: number;
  rejectEndHourLocal: number;
}

function getLocalHour(iso: string, timezone: string): number {
  try {
    const d = new Date(iso);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hourStr = formatter.format(d);
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
  } catch {
    return new Date(iso).getUTCHours();
  }
}

function inNightWindow(hour: number, start: number, end: number): boolean {
  // start=22, end=6: night is [22, 24) ∪ [0, 6)
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function pickBestSimilaritySlot(args: PickArgs): ScoredSlot | null {
  const { scoredSlots, scoreThreshold, rejectStartHourLocal, rejectEndHourLocal } = args;

  const eligible = scoredSlots.filter((s) => {
    if (!Number.isFinite(s.score)) return false;
    if (s.score < scoreThreshold) return false;
    const hour = getLocalHour(s.forecast_at, s.beach_timezone);
    if (inNightWindow(hour, rejectStartHourLocal, rejectEndHourLocal)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const confidenceRank = { low: 0, medium: 1, high: 2 };
    const confidenceDelta =
      confidenceRank[b.match_confidence ?? "low"] -
      confidenceRank[a.match_confidence ?? "low"];
    if (confidenceDelta !== 0) return confidenceDelta;
    const aCondition = Number.isFinite(a.condition_score)
      ? a.condition_score!
      : Number.NEGATIVE_INFINITY;
    const bCondition = Number.isFinite(b.condition_score)
      ? b.condition_score!
      : Number.NEGATIVE_INFINITY;
    if (aCondition !== bCondition) return bCondition - aCondition;
    const startDelta =
      new Date(a.forecast_at).getTime() - new Date(b.forecast_at).getTime();
    if (startDelta !== 0) return startDelta;
    return `${a.beach_id}:${a.forecast_at}`.localeCompare(
      `${b.beach_id}:${b.forecast_at}`,
    );
  });

  return eligible[0];
}
