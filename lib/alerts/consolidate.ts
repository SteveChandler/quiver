import type { ForecastHour } from "./types";

interface SimilarityRpcResult {
  score: number;
  match_percent: number;
  label: string;
  session_count?: number;
  state?: string;
  reason_bullets?: unknown;
  board_tip?: string | null;
}

interface MatchedWindow {
  window_start: string;
  window_end: string;
  best_hour: string;
  conditions_snapshot: Record<string, unknown>;
}

/**
 * Collapses a time-ordered list of matched hours into contiguous windows.
 *
 * A "contiguous" run is one where each hour is ≤65 minutes after the prior
 * (tolerant of small clock skew; hourly forecasts are on a UTC grid so DST
 * doesn't actually create odd gaps). The `conditions_snapshot` of the window
 * is the RPC result from its peak-score hour — the delivery cron surfaces
 * that as the single headline for the window.
 *
 * Peak-score tiebreaker: earliest timestamp wins, which is the common-sense
 * preference for surfers ("tell me when the good window *starts*").
 */
export function consolidateMatchedHours(
  matched: Array<{
    hour: ForecastHour;
    result: SimilarityRpcResult;
  }>,
): MatchedWindow[] {
  if (matched.length === 0) return [];

  const sorted = [...matched].sort(
    (a, b) =>
      new Date(a.hour.forecast_at).getTime() -
      new Date(b.hour.forecast_at).getTime(),
  );

  const windows: MatchedWindow[] = [];
  let runStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    const isRunBreak =
      i === sorted.length ||
      new Date(sorted[i].hour.forecast_at).getTime() -
        new Date(sorted[i - 1].hour.forecast_at).getTime() >
        65 * 60 * 1000; // >65 minutes = gap (5m tolerance for clock skew)
    if (!isRunBreak) continue;

    const run = sorted.slice(runStart, i);
    // Earliest-timestamp wins on score ties — run is already sorted ASC,
    // so reduce(>, ) picks the first maximal score it encounters.
    const peak = run.reduce((best, curr) =>
      curr.result.score > best.result.score ? curr : best,
    );
    windows.push({
      window_start: run[0].hour.forecast_at,
      window_end: new Date(
        new Date(run[run.length - 1].hour.forecast_at).getTime() +
          60 * 60 * 1000,
      ).toISOString(),
      best_hour: peak.hour.forecast_at,
      conditions_snapshot: {
        similarity_score: peak.result.score,
        match_percent: peak.result.match_percent,
        label: peak.result.label,
        reason_bullets: peak.result.reason_bullets ?? [],
        board_tip: peak.result.board_tip ?? null,
        wave_height: peak.hour.wave_height,
        wave_period: peak.hour.wave_period,
        wind_speed: peak.hour.wind_speed,
        wind_direction_deg: peak.hour.wind_direction_deg,
        tide_height: peak.hour.tide_height,
      },
    });

    runStart = i;
  }

  return windows;
}
