import { getConditionBoardPick, type BoardForPick } from './board-pick';
import { toForecastForScoring } from './types';
import { swellInterferenceScorer } from '@/lib/domains/scoring/scorers/swell-interference-scorer';
import { forecastToSnapshot, beachToSpotProfile } from '@/lib/domains/scoring/discovery-adapter';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { normalizeBoardClass, getRideabilityBand } from '@/lib/domains/rideability';
import { parseSkillLevel } from '@/lib/domains/user-preferences/skill-level';
import { scoreNativeForecastSlot } from './native-condition-score';
import { getDirectionDegrees } from '@/lib/utils/number-parsing';
import { parseWaveHeightMidpointFt } from '@/lib/alerts/forecast-parsers';

export interface BoardSession {
  id: string;
  user_id?: string;
  status: string;
  deleted_at: string | null;
  rating: number | null;
  arrival_time: string | null;
  session_board_fit: string | null;
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
  reason: string;
  alternates: Omit<RecommendedBoard, 'alternates'>[];
}

// Included in the existing board read; filters on the embedded sessions preserve ownership.
export const PERSONAL_BOARD_SELECT = 'id,name,board_type,volume,session_count,sessions(id,user_id,status,deleted_at,rating,arrival_time,session_board_fit,beaches!sessions_beach_id_fkey(break_type,preferred_tide_ft_min,preferred_tide_ft_max),session_forecast_snapshots(forecast_snapshot))';

function sessionSnapshot(session: BoardSession): Record<string, unknown> | undefined {
  const snapshots = session.session_forecast_snapshots;
  return (Array.isArray(snapshots) ? snapshots[0] : snapshots)?.forecast_snapshot;
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

// ponytail: fixed condition bandwidths; calibrate on held-out board-fit feedback when enough labels accumulate.
function similarity(snapshot: Record<string, unknown>, forecast: EnhancedForecastEntity, historicalBeach: BoardSession['beaches'], beach: Beach): number {
  const height = parseWaveHeightMidpointFt(String(snapshot.wave_height ?? ''));
  const currentHeight = parseWaveHeightMidpointFt(forecast.wave_height);
  if (height === null || currentHeight === null) return 0;
  const pairs: Array<[number | null, number | null, number, number]> = [
    [height, currentHeight, 1.5, 0.4],
    [numeric(snapshot.wave_period), numeric(forecast.wave_period), 4, 0.25],
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
  if (historicalBeach?.break_type && beach.break_type && historicalBeach.break_type !== beach.break_type) distance += 0.5;
  // Height / period² is the available wave-steepness proxy.
  const period = numeric(snapshot.wave_period);
  const currentPeriod = numeric(forecast.wave_period);
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
  const skill = parseSkillLevel(typeof experience === 'string' ? experience : null) ?? 'beginner';
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
        return snapshot ? [{ session, snapshot, weight: similarity(snapshot, forecast, session.beaches, beach) }] : [];
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
    for (const entry of matched) {
      if (entry.session.rating !== null) {
        ratingWeight += entry.weight;
        ratingSum += entry.weight * (entry.session.rating - baseline);
      }
      const fit = entry.session.session_board_fit;
      feedback += entry.weight * (fit === 'right' ? 1 : ['too_small', 'too_much_board', 'wrong_type'].includes(fit ?? '') ? -1 : 0);
    }
    const recency = sessions.reduce((best, entry) => {
      const age = (at - Date.parse(entry.session.arrival_time ?? '')) / 86_400_000;
      return Number.isFinite(age) && age >= 0 ? Math.max(best, Math.exp(-age / 90)) : best;
    }, 0);
    const boardBlend = weight / (weight + 5);
    const personal = physical * 0.5 + 50 * boardBlend
      + boardBlend * ((ratingWeight ? 12 * ratingSum / ratingWeight : 0) + (weight ? 25 * feedback / weight : 0))
      + 3 * Math.min(1, sessions.length / 20) + 2 * recency;
    const score = physical * (1 - historyBlend) + personal * historyBlend;
    const heights = matched.map(({ snapshot }) => parseWaveHeightMidpointFt(String(snapshot.wave_height ?? ''))!).filter(Number.isFinite);
    const reason = matched.length >= 3
      ? `You ride ${board.name} on ${Math.floor(Math.min(...heights))}-${Math.ceil(Math.max(...heights))} ft days like this (${matched.length} sessions)`
      : `${board.name} fits these conditions; limited similar session history`;
    return [{ id: board.id, name: board.name, type: board.board_type, reason, score, matchedCount: matched.length }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!ranked.length) return null;
  const alternates = ranked.slice(1).sort((a, b) => Number(b.matchedCount >= 3) - Number(a.matchedCount >= 3) || b.score - a.score || a.id.localeCompare(b.id));
  const picks = [ranked[0], ...alternates.slice(0, 2)].map(({ score: _score, matchedCount: _count, ...board }) => board);
  return { ...picks[0], alternates: picks.slice(1) };
}
