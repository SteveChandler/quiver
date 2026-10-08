import { getConditionBoardPick, type BoardForPick } from '@/lib/scoring';
import { toForecastForScoring } from './types';
import { swellInterferenceScorer } from '@/lib/domains/scoring/scorers/swell-interference-scorer';
import { forecastToSnapshot, beachToSpotProfile } from '@/lib/domains/scoring/discovery-adapter';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { BoardClass } from '@/lib/domains/rideability';
import { resolveNativeSkillLevel } from './native-condition-score';
import { boardLengthIn, classFitScore, fitConditions, pickReasonText, resolvePickClass } from './conditions-board-fit';
import { getDirectionDegrees } from '@/lib/utils/number-parsing';
import { parseWaveHeightMidpointFt } from '@/lib/alerts/forecast-parsers';
import { breakTypesMatch } from './break-family';

const LEGACY_BOARD_FIT: Readonly<Record<string, string>> = { not_right: 'not_right', good: 'right', perfect: 'right' };
const LOW_RATING = 2;

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
  /** e.g. 6'4 x 20 x 2.5; length sizes up long fish and twins. */
  dimensions?: string | null;
  sessions?: BoardSession[];
}
export interface RecommendedBoard {
  id: string;
  name: string;
  type: string;
  /** Class the rule scored this board as (a specific name such as "twin pin" beats a generic shortboard type). */
  boardClass: BoardClass;
  reason: string;
  alternates: Omit<RecommendedBoard, 'alternates'>[];
}

// Included in the existing board read; filters on the embedded sessions preserve ownership.
export const PERSONAL_BOARD_SELECT = 'id,name,board_type,volume,dimensions,session_count,sessions(id,user_id,status,deleted_at,rating,arrival_time,session_board_fit,board_fit,beaches!sessions_beach_id_fkey(break_type,preferred_tide_ft_min,preferred_tide_ft_max),session_forecast_snapshots(forecast_snapshot))';

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


// History only nudges a conditions-first pick: it breaks ties between boards that already fit.
const HISTORY_NUDGE_POINTS = 5;
const EVIDENCE_SIMILARITY = 0.35;
const FIT_SENTIMENT: Readonly<Record<string, number>> = { right: 1, wrong_type: -1, too_small: -0.75, too_much_board: -0.75, not_right: -0.75 };
const PICK_FLOOR = 40;
const GOOD_FIT = 60;

function sessionSentiment(session: BoardSession): number {
  const fit = FIT_SENTIMENT[sessionBoardFit(session) ?? ''];
  const rating = session.rating;
  const positive = fit !== undefined && fit > 0 ? fit : rating !== null && rating >= 4 ? 0.4 : 0;
  const negative = fit !== undefined && fit < 0 ? -fit : rating !== null && rating <= LOW_RATING ? 0.6 : 0;
  return Math.max(-1, Math.min(1, positive - negative));
}

/** Bounded (±5 points) nudge from how this board went in similar past conditions. */
export function boardHistoryNudge(board: PersonalBoard, forecast: EnhancedForecastEntity, beach: Beach): number {
  let weight = 0;
  let sentiment = 0;
  for (const session of board.sessions ?? []) {
    if (session.status !== 'completed' || session.deleted_at) continue;
    const snapshot = sessionSnapshot(session);
    if (!snapshot) continue;
    const similarity = conditionSimilarity(snapshot, forecast, session.beaches, beach);
    if (similarity < EVIDENCE_SIMILARITY) continue;
    weight += similarity;
    sentiment += similarity * sessionSentiment(session);
  }
  const net = weight > 0 ? sentiment / (weight + 1.5) : 0;
  return HISTORY_NUDGE_POINTS * Math.max(-1, Math.min(1, net / 0.6));
}

/**
 * One deterministic, conditions-first board rule. All evidence is supplied by the caller.
 * `requestDerived` marks a forecast built from request conditions rather than a stored row.
 */
export function recommendBoard(
  boards: readonly PersonalBoard[],
  forecast: EnhancedForecastEntity,
  beach: Beach,
  experience: unknown,
  options: { requestDerived?: boolean } = {},
): RecommendedBoard | null {
  // Same unknown-skill default as the slot scorer, so a pick and its score agree.
  const skill = resolveNativeSkillLevel(typeof experience === 'string' ? experience : null, 'intermediate');
  if (boards.length === 0 || parseWaveHeightMidpointFt(forecast.wave_height) === null) return null;
  const interference = swellInterferenceScorer.score({
    snapshot: forecastToSnapshot(forecast, options), profile: beachToSpotProfile(beach), window: null, preferences: null,
  }).score;
  const conditions = fitConditions(forecast, beach, interference);
  if (!conditions) return null;
  const ranked = boards.flatMap((board) => {
    const boardClass = resolvePickClass(board);
    if (!boardClass) return [];
    const fit = classFitScore(conditions, skill, boardClass, boardLengthIn(board.dimensions));
    if (fit === null) return [];
    // Power-day safety still vetoes a board whatever its fit.
    if (!getConditionBoardPick(toForecastForScoring(forecast), [board], beach, { kind: 'scored', boardClass })) return [];
    return [{ board, boardClass, score: fit + boardHistoryNudge(board, forecast, beach) }];
  }).sort((a, b) => b.score - a.score || a.board.id.localeCompare(b.board.id));
  const [pick, ...rest] = ranked;
  if (!pick || pick.score < PICK_FLOOR) return null;
  const toBoard = ({ board, boardClass, score }: (typeof ranked)[number]) => ({
    id: board.id, name: board.name, type: board.board_type, boardClass,
    reason: pickReasonText(conditions, skill, board.name, boardClass, score < GOOD_FIT),
  });
  return { ...toBoard(pick), alternates: rest.filter((entry) => entry.score >= PICK_FLOOR).slice(0, 2).map(toBoard) };
}
