import { getConditionBoardPick, type BoardForPick } from '@/lib/scoring';
import { toForecastForScoring } from './types';
import { swellInterferenceScorer } from '@/lib/domains/scoring/scorers/swell-interference-scorer';
import { forecastToSnapshot, beachToSpotProfile } from '@/lib/domains/scoring/discovery-adapter';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { normalizeBoardClass, getRideabilityBand, type BoardClass } from '@/lib/domains/rideability';
import { resolveNativeSkillLevel, scoreNativeForecastSlot } from './native-condition-score';
import { getDirectionDegrees } from '@/lib/utils/number-parsing';
import { parseWaveHeightMidpointFt } from '@/lib/alerts/forecast-parsers';
import { breakTypesMatch } from './break-family';

// not_right is the legacy sessions.board_fit negative; it carries a generic negative's weight, not wrong_type's.
const BOARD_FIT_WEIGHT: Readonly<Record<string, number>> = { right: 1, too_small: -1, too_much_board: -1, wrong_type: -2, not_right: -1 };
const NEGATIVE_BOARD_FIT: ReadonlySet<string> = new Set(['too_small', 'too_much_board', 'wrong_type', 'not_right']);
const LEGACY_BOARD_FIT: Readonly<Record<string, string>> = { not_right: 'not_right', good: 'right', perfect: 'right' };
const LOW_RATING = 2;

// Habit may lift a board only so far: a board whose physical fit trails the best-fitting board the user
// actually rides (>= ESTABLISHED_MATCHES similar sessions) by more than MAX_PHYSICAL_GAP cannot be the top pick.
const MAX_PHYSICAL_GAP = 12;
const ESTABLISHED_MATCHES = 3;

export interface BoardSession {
  id: string;
  user_id?: string;
  status: string;
  deleted_at: string | null;
  rating: number | null;
  arrival_time: string | null;
  session_board_fit: string | null;
  /** Legacy fit written by some clients while session_board_fit stays null; session_board_fit wins when present. */
  board_fit?: string | null;
  beaches?: Pick<Beach, 'break_type' | 'preferred_tide_ft_min' | 'preferred_tide_ft_max'> | null;
  session_forecast_snapshots?: { forecast_snapshot: Record<string, unknown> } | { forecast_snapshot: Record<string, unknown> }[] | null;
}
export interface PersonalBoard extends BoardForPick {
  sessions?: BoardSession[];
}
export interface RecommendedBoard {
  id: string;
  name: string;
  type: string;
  /** Class the rule scored this board as (type first, then name, as SQL does). */
  boardClass: BoardClass;
  reason: string;
  alternates: Omit<RecommendedBoard, 'alternates'>[];
}

// Included in the existing board read; filters on the embedded sessions preserve ownership.
export const PERSONAL_BOARD_SELECT = 'id,name,board_type,volume,session_count,sessions(id,user_id,status,deleted_at,rating,arrival_time,session_board_fit,board_fit,beaches!sessions_beach_id_fkey(break_type,preferred_tide_ft_min,preferred_tide_ft_max),session_forecast_snapshots(forecast_snapshot))';

function sessionSnapshot(session: BoardSession): Record<string, unknown> | undefined {
  const snapshots = session.session_forecast_snapshots;
  return (Array.isArray(snapshots) ? snapshots[0] : snapshots)?.forecast_snapshot;
}

function sessionBoardFit(session: BoardSession): string | null {
  return session.session_board_fit ?? LEGACY_BOARD_FIT[session.board_fit ?? ''] ?? null;
}

function numeric(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
function tideDirection(value: unknown): string | null {
  const s = String(value ?? '').toLowerCase();
  if (/rising|incoming|flood/.test(s)) return 'incoming';
  if (/falling|outgoing|ebb/.test(s)) return 'outgoing';
  return null;
}
function relativeTide(height: unknown, beach: BoardSession['beaches']): number | null {
  const h = numeric(height);
  if (h === null) return null;
  const lo = beach?.preferred_tide_ft_min;
  const hi = beach?.preferred_tide_ft_max;
  return lo != null && hi != null ? h - (lo + hi) / 2 : null;
}

// User-facing "like this" claims need closer conditions than the evidence-weighting cutoff.
export const LIKE_THIS_SIMILARITY = 0.7;

/**
 * Period used to compare a forecast row or a session snapshot. Open-Meteo rows store the tallest
 * partition's period in wave_period beside the whole-sea height, while CDIP/NWS rows and most history
 * store the whole-sea period; wave_period_om is the Open-Meteo whole-sea mean, the like-for-like value.
 * Similarity only: displays, physical fit, alerts and stored rows keep wave_period.
 * Twin of similarity_period in compute_user_match_scores (20260929120000_match_score_om_similarity_period.sql).
 */
export function similarityPeriod(row: { data_source?: unknown; wave_period?: unknown; wave_period_om?: unknown }): number | null {
  if (String(row.data_source ?? '').toUpperCase() === 'OPEN_METEO') {
    const meanPeriod = numeric(row.wave_period_om);
    if (meanPeriod !== null && meanPeriod > 0) return meanPeriod;
  }
  return numeric(row.wave_period);
}

// ponytail: fixed condition bandwidths; calibrate on held-out board-fit feedback when enough labels accumulate.
export function conditionSimilarity(snapshot: Record<string, unknown>, forecast: EnhancedForecastEntity, historicalBeach: BoardSession['beaches'], beach: Beach): number {
  const height = parseWaveHeightMidpointFt(String(snapshot.wave_height ?? ''));
  const currentHeight = parseWaveHeightMidpointFt(forecast.wave_height);
  if (height === null || currentHeight === null) return 0;
  const pairs: Array<[number | null, number | null, number, number]> = [
    [height, currentHeight, 1.5, 0.4],
    [similarityPeriod(snapshot), similarityPeriod(forecast), 4, 0.25],
    [numeric(snapshot.wind_speed), numeric(forecast.wind_speed), 8, 0.2],
    [relativeTide(snapshot.tide_height, historicalBeach), relativeTide(forecast.tide_height, beach), 2, 0.15],
  ];
  let distance = 0;
  for (const [past, current, width, importance] of pairs) {
    if (past !== null && current !== null) distance += importance * ((past - current) / width) ** 2;
  }
  const pastWind = getDirectionDegrees(numeric(snapshot.wind_direction_deg), typeof snapshot.wind_direction === 'string' ? snapshot.wind_direction : null);
  const currentWind = getDirectionDegrees(forecast.wind_direction_deg, forecast.wind_direction);
  if (pastWind !== null && currentWind !== null) {
    const difference = Math.abs(pastWind - currentWind) % 360;
    distance += 0.1 * (Math.min(difference, 360 - difference) / 90) ** 2;
  }
  const pastDirection = tideDirection(snapshot.tide_status);
  const direction = tideDirection(forecast.tide_status);
  if (pastDirection && direction && pastDirection !== direction) distance += 0.25;
  if (!breakTypesMatch(historicalBeach?.break_type, beach.break_type)) distance += 0.5;
  // Height / period² is the available wave-steepness proxy.
  const period = similarityPeriod(snapshot);
  const currentPeriod = similarityPeriod(forecast);
  if (period && currentPeriod) distance += 0.15 * ((height / period ** 2 - currentHeight / currentPeriod ** 2) / 0.04) ** 2;
  return Math.exp(-distance / 2);
}

/** One deterministic board rule. All evidence is supplied by the caller. */
export function recommendBoard(
  boards: readonly PersonalBoard[],
  forecast: EnhancedForecastEntity,
  beach: Beach,
  experience: unknown,
): RecommendedBoard | null {
  // Same unknown-skill default as the slot scorer, so a pick and its score agree.
  const skill = resolveNativeSkillLevel(typeof experience === 'string' ? experience : null, 'intermediate');
  const height = parseWaveHeightMidpointFt(forecast.wave_height);
  if (height === null) return null;
  const at = Date.parse(forecast.forecast_at);
  if (boards.length === 0) return null;
  const interference = swellInterferenceScorer.score({
    snapshot: forecastToSnapshot(forecast), profile: beachToSpotProfile(beach), window: null, preferences: null,
  }).score;
  const evidence = boards.map((board) => ({
    board,
    sessions: (board.sessions ?? []).filter((s) => s.status === 'completed' && !s.deleted_at)
      .flatMap((session) => {
        const snapshot = sessionSnapshot(session);
        return snapshot ? [{ session, snapshot, weight: conditionSimilarity(snapshot, forecast, session.beaches, beach) }] : [];
      }),
  }));
  const totalWeight = evidence.flatMap((entry) => entry.sessions).filter((entry) => entry.weight >= 0.35).reduce((sum, entry) => sum + entry.weight, 0);
  const historyBlend = totalWeight / (totalWeight + 5);
  const ranked = evidence.flatMap(({ board, sessions }) => {
    const type = normalizeBoardClass(board.board_type) ?? normalizeBoardClass(board.name);
    if (!type) return [];
    const band = getRideabilityBand(skill, type);
    // Habit cannot compensate for being outside the board's physical range.
    if (height < band.acceptable.min || height > band.acceptable.max) return [];
    if (!getConditionBoardPick(toForecastForScoring(forecast), [board], beach, { kind: "scored", boardClass: type })) return [];
    const physical = scoreNativeForecastSlot(forecast, skill, band) - (band.prefersClean ? (100 - interference) * 0.1 : 0);
    if (physical < 40) return [];
    const matched = sessions.filter((entry) => entry.weight >= 0.35);
    const weight = matched.reduce((sum, entry) => sum + entry.weight, 0);
    const others = evidence.filter((entry) => entry.board.id !== board.id)
      .flatMap((entry) => entry.sessions).filter((entry) => entry.weight >= 0.35 && entry.session.rating !== null);
    const otherWeight = others.reduce((sum, entry) => sum + entry.weight, 0);
    const baseline = otherWeight > 0 ? others.reduce((sum, entry) => sum + entry.weight * entry.session.rating!, 0) / otherWeight : 3;
    let ratingWeight = 0;
    let ratingSum = 0;
    let feedback = 0;
    let habitWeight = 0;
    for (const entry of matched) {
      const fit = sessionBoardFit(entry.session);
      const negative = fit !== null && NEGATIVE_BOARD_FIT.has(fit);
      const rating = entry.session.rating;
      if (rating !== null) {
        ratingWeight += entry.weight;
        const delta = rating - baseline;
        ratingSum += entry.weight * (negative ? Math.min(delta, 0) : delta);
      }
      feedback += entry.weight * (BOARD_FIT_WEIGHT[fit ?? ''] ?? 0);
      // A session that went badly shows the board was ridden, not preferred; it must not build habit.
      if (!negative && !(rating !== null && rating <= LOW_RATING)) habitWeight += entry.weight;
    }
    const recency = sessions.reduce((best, entry) => {
      const age = (at - Date.parse(entry.session.arrival_time ?? '')) / 86_400_000;
      return Number.isFinite(age) && age >= 0 ? Math.max(best, Math.exp(-age / 90)) : best;
    }, 0);
    const boardBlend = weight / (weight + 5);
    const habitBlend = habitWeight / (habitWeight + 5);
    const personal = physical * 0.5 + 50 * habitBlend
      + boardBlend * ((ratingWeight ? 12 * ratingSum / ratingWeight : 0) + (weight ? 25 * feedback / weight : 0))
      + 3 * Math.min(1, sessions.length / 20) + 2 * recency;
    const score = physical * (1 - historyBlend) + personal * historyBlend;
    const likeThis = sessions.filter((entry) => entry.weight >= LIKE_THIS_SIMILARITY);
    const heights = likeThis.map(({ snapshot }) => parseWaveHeightMidpointFt(String(snapshot.wave_height ?? ''))!).filter(Number.isFinite);
    const reason = likeThis.length >= 3
      ? `You ride ${board.name} on ${Math.floor(Math.min(...heights))}-${Math.ceil(Math.max(...heights))} ft days like this (${likeThis.length} sessions)`
      : `${board.name} fits these conditions; limited similar session history`;
    return [{ id: board.id, name: board.name, type: board.board_type, boardClass: type, reason, score, matchedCount: matched.length, physical }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!ranked.length) return null;
  const established = ranked.filter((candidate) => candidate.matchedCount >= ESTABLISHED_MATCHES);
  const reference = Math.max(...(established.length ? established : ranked).map((candidate) => candidate.physical));
  const fits = (candidate: (typeof ranked)[number]) => candidate.physical >= reference - MAX_PHYSICAL_GAP;
  const ordered = [...ranked.filter(fits), ...ranked.filter((candidate) => !fits(candidate))];
  const alternates = ordered.slice(1).sort((a, b) => Number(b.matchedCount >= ESTABLISHED_MATCHES) - Number(a.matchedCount >= ESTABLISHED_MATCHES) || b.score - a.score || a.id.localeCompare(b.id));
  const picks = [ordered[0], ...alternates.slice(0, 2)].map(({ score: _score, matchedCount: _count, physical: _physical, ...board }) => board);
  return { ...picks[0], alternates: picks.slice(1) };
}
