#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDirectionScoringExcludedSlugs } from '@/lib/flags/direction-scoring';
import { directionInput } from '@/lib/services/discovery/window-selector/window-scorer';
import { scoreNativeConditionBreakdown, nativeScoreInputsFromForecast } from '@/lib/scoring/native-condition-score';
import { getQualityLabel } from '@/lib/utils/score-color-utils';
import { classifyWindQuality } from '@/lib/utils/wind-quality';
import { getDirectionDegrees } from '@/lib/services/discovery/window-selector/direction-utils';
import type { BeachTerrainConfig } from '@/lib/utils/wave-height-transformer';
import type { EnhancedForecastEntity } from '@/types/forecast';

export interface BacktestRow {
  beachSlug: string;
  oldScore: number;
  newScore: number;
  rating: number;
  oldLabel: string;
  newLabel: string;
  onshore: boolean;
  outOfWindow: boolean;
}

export type GateStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT DATA';

function averageRanks(values: number[]): number[] {
  return values.map((value) => {
    const sorted = [...values].sort((a, b) => a - b);
    const first = sorted.indexOf(value);
    const last = sorted.lastIndexOf(value);
    return (first + last) / 2 + 1;
  });
}

export function rankCorrelation(rows: Array<{ score: number; rating: number }>): number {
  if (rows.length < 2) return 0;
  const scores = averageRanks(rows.map((row) => row.score));
  const ratings = averageRanks(rows.map((row) => row.rating));
  const scoreMean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const ratingMean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const numerator = scores.reduce((sum, score, i) => sum + (score - scoreMean) * (ratings[i] - ratingMean), 0);
  const denominator = Math.sqrt(scores.reduce((sum, score) => sum + (score - scoreMean) ** 2, 0) * ratings.reduce((sum, rating) => sum + (rating - ratingMean) ** 2, 0));
  return denominator === 0 ? 0 : numerator / denominator;
}

export function bootstrapMean(values: number[], resamples = 1000, seed = 793): [number, number] {
  if (!values.length) return [0, 0];
  let state = seed >>> 0;
  const samples: number[] = [];
  for (let i = 0; i < resamples; i++) {
    let total = 0;
    for (let j = 0; j < values.length; j++) {
      state = (1664525 * state + 1013904223) >>> 0;
      total += values[state % values.length];
    }
    samples.push(total / values.length);
  }
  samples.sort((a, b) => a - b);
  return [samples[Math.floor(resamples * 0.025)], samples[Math.floor(resamples * 0.975)]];
}

export function nearestForecast<T extends { beach_id: string; forecast_at: string }>(forecasts: T[], beachId: string, arrivalTime: string): T | null {
  const arrival = new Date(arrivalTime).getTime();
  return forecasts.filter((row) => row.beach_id === beachId).reduce<T | null>((nearest, row) => {
    const delta = Math.abs(new Date(row.forecast_at).getTime() - arrival);
    if (delta > 3 * 60 * 60 * 1000) return nearest;
    return !nearest || delta < Math.abs(new Date(nearest.forecast_at).getTime() - arrival) ? row : nearest;
  }, null);
}

export function inSwellWindow(direction: number | null, center: number | null, halfwidth: number | null): boolean {
  if (direction == null || center == null || halfwidth == null) return false;
  const distance = Math.abs(((direction - center + 540) % 360) - 180);
  return distance <= halfwidth;
}

function bootstrapProportion(values: boolean[]): [number, number] {
  return bootstrapMean(values.map((value) => value ? 1 : 0));
}

function bootstrapCorrelation(rows: Array<{ score: number; rating: number }>): [number, number] {
  if (!rows.length) return [0, 0];
  let state = 793;
  const samples: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const sample = rows.map(() => {
      state = (1664525 * state + 1013904223) >>> 0;
      return rows[state % rows.length];
    });
    samples.push(rankCorrelation(sample));
  }
  samples.sort((a, b) => a - b);
  return [samples[25], samples[975]];
}

function gate(sampleCount: number, condition: boolean): GateStatus {
  return sampleCount < 20 ? 'INSUFFICIENT DATA' : condition ? 'PASS' : 'FAIL';
}

export function evaluateGates(rows: BacktestRow[]): Record<string, GateStatus> {
  const oldEpic = rows.filter((row) => row.oldLabel === 'EPIC');
  const newEpic = rows.filter((row) => row.newLabel === 'EPIC');
  const oldEpicBad = oldEpic.filter((row) => row.onshore || row.outOfWindow).length / Math.max(oldEpic.length, 1);
  const newEpicBad = newEpic.filter((row) => row.onshore || row.outOfWindow).length / Math.max(newEpic.length, 1);
  const labels = ['EPIC', 'GOOD', 'FAIR', 'RIDEABLE', 'MEH'];
  const means = (key: 'oldLabel' | 'newLabel') => labels.map((label) => {
    const values = rows.filter((row) => row[key] === label).map((row) => row.rating);
    return values.length >= 5 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }).filter((value): value is number => value != null);
  const oldMeans = means('oldLabel');
  const newMeans = means('newLabel');
  const oldMonotonic = oldMeans.every((value, i) => i === 0 || oldMeans[i - 1] >= value);
  const newMonotonic = newMeans.every((value, i) => i === 0 || newMeans[i - 1] >= value);
  const oldRank = rankCorrelation(rows.map((row) => ({ score: row.oldScore, rating: row.rating })));
  const newRank = rankCorrelation(rows.map((row) => ({ score: row.newScore, rating: row.rating })));
  const oldCI = bootstrapCorrelation(rows.map((row) => ({ score: row.oldScore, rating: row.rating })));
  const newCI = bootstrapCorrelation(rows.map((row) => ({ score: row.newScore, rating: row.rating })));
  const overlap = Math.max(oldCI[0], newCI[0]) <= Math.min(oldCI[1], newCI[1]);
  return {
    epic_onshore_or_out_of_window: gate(rows.length, newEpicBad < oldEpicBad),
    rating_label_order: gate(rows.length, !oldMonotonic || newMonotonic),
    spearman: gate(rows.length, newRank >= oldRank || overlap),
  };
}

function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service credentials.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchPages<T>(load: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await load(from, from + 999);
    if (page.error) throw page.error;
    rows.push(...(page.data ?? []));
    if (!page.data || page.data.length < 1000) return rows;
  }
}

function printHelp(): void {
  console.log('Usage: yarn tsx scripts/backtest-direction-scoring.ts [--help] [--days <n>] [--out <path>]\nREAD-ONLY: direction-score backtest over real-user rated sessions.');
}

function parseArgs(): { days: number; out: string | null } {
  const daysIndex = process.argv.indexOf('--days');
  const outIndex = process.argv.indexOf('--out');
  return { days: daysIndex >= 0 ? Number(process.argv[daysIndex + 1]) || 60 : 60, out: outIndex >= 0 ? process.argv[outIndex + 1] ?? null : null };
}

function summarize(rows: BacktestRow[], includeBeachSplit = true): Record<string, unknown> {
  const labels = ['EPIC', 'GOOD', 'FAIR', 'RIDEABLE', 'MEH'];
  const labelStats = (key: 'oldLabel' | 'newLabel') => Object.fromEntries(labels.map((label) => {
    const values = rows.filter((row) => row[key] === label).map((row) => row.rating);
    return [label, { count: values.length, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, ci: bootstrapMean(values) }];
  }));
  const scoreStats = (key: 'oldScore' | 'newScore') => ({ spearman: rankCorrelation(rows.map((row) => ({ score: row[key], rating: row.rating }))), ci: bootstrapCorrelation(rows.map((row) => ({ score: row[key], rating: row.rating }))) });
  const badShare = (key: 'oldLabel' | 'newLabel', accepted: string[]) => {
    const selected = rows.filter((row) => accepted.includes(row[key]));
    return { count: selected.length, share: selected.length ? selected.filter((row) => row.onshore || row.outOfWindow).length / selected.length : 0, ci: bootstrapProportion(selected.map((row) => row.onshore || row.outOfWindow)) };
  };
  const byBeach = includeBeachSplit ? Object.fromEntries(Array.from(new Set(rows.map((row) => row.beachSlug))).map((slug) => {
    const beachRows = rows.filter((row) => row.beachSlug === slug);
    return [slug, beachRows.length >= 10 ? summarize(beachRows, false) : { count: beachRows.length, omitted: true }];
  })) : undefined;
  return { count: rows.length, old: scoreStats('oldScore'), new: scoreStats('newScore'), ratingByLabel: { old: labelStats('oldLabel'), new: labelStats('newLabel') }, onshoreOrOutOfWindow: { epic: { old: badShare('oldLabel', ['EPIC']), new: badShare('newLabel', ['EPIC']) }, epicOrGood: { old: badShare('oldLabel', ['EPIC', 'GOOD']), new: badShare('newLabel', ['EPIC', 'GOOD']) } }, byBeach, gates: evaluateGates(rows), rows };
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) return printHelp();
  const { days, out } = parseArgs();
  const service = db();
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const beaches = await fetchPages<Record<string, unknown>>((from, to) => service.from('beaches').select('id,slug,shoaling_factors,wind_offshore_deg,wind_offshore_tol_deg,swell_window_center_deg,swell_window_halfwidth_deg,swell_access_factors').not('shoaling_factors', 'is', null).range(from, to) as never);
  const eligible = beaches.filter((beach) => typeof beach.slug === 'string' && !getDirectionScoringExcludedSlugs().has(beach.slug));
  const beachIds = eligible.map((beach) => String(beach.id));
  const sessions = beachIds.length ? await fetchPages<Record<string, unknown>>((from, to) => service.from('sessions').select('id,beach_id,user_id,arrival_time,rating,wave_height_ft').in('beach_id', beachIds).not('rating', 'is', null).gte('arrival_time', start.toISOString()).lt('arrival_time', end.toISOString()).range(from, to) as never) : [];
  const userIds = Array.from(new Set(sessions.map((session) => session.user_id).filter(Boolean)));
  const profiles = userIds.length ? await fetchPages<Record<string, unknown>>((from, to) => service.from('profiles').select('id,deleted_at,is_mock,analytics_is_real_user,is_system_account').in('id', userIds).range(from, to) as never) : [];
  const realUsers = new Set(profiles.filter((profile) => profile.deleted_at == null && profile.is_mock !== true && profile.analytics_is_real_user !== false && profile.is_system_account !== true).map((profile) => profile.id));
  const realSessions = sessions.filter((session) => realUsers.has(session.user_id));
  const forecasts = beachIds.length ? await fetchPages<Record<string, unknown>>((from, to) => service.from('enhanced_forecasts').select('beach_id,forecast_at,wave_height,wave_period,wave_direction,swell_1_height,swell_1_period,swell_1_direction,wind_speed,wind_direction,wind_direction_deg,tide_height,tide_status').in('beach_id', beachIds).gte('forecast_at', new Date(start.getTime() - 10800000).toISOString()).lte('forecast_at', new Date(end.getTime() + 10800000).toISOString()).range(from, to) as never) : [];
  const byId = new Map(eligible.map((beach) => [String(beach.id), beach]));
  const rows: BacktestRow[] = [];
  let noForecast = 0;
  for (const session of realSessions) {
    const forecast = nearestForecast(forecasts as Array<{ beach_id: string; forecast_at: string }>, String(session.beach_id), String(session.arrival_time)) as Record<string, unknown> | null;
    if (!forecast) { noForecast++; continue; }
    const beach = byId.get(String(session.beach_id))! as BeachTerrainConfig & { wind_offshore_deg?: number | null; wind_offshore_tol_deg?: number | null; };
    const typed = forecast as unknown as EnhancedForecastEntity;
    const direction = directionInput(typed, beach, true);
    const inputs = nativeScoreInputsFromForecast(typed);
    const oldScore = scoreNativeConditionBreakdown(inputs).score;
    const newScore = scoreNativeConditionBreakdown(inputs, undefined, undefined, direction).score;
    const swellDirection = getDirectionDegrees(forecast.swell_1_direction ?? forecast.wave_direction, null);
    const windDirection = getDirectionDegrees(forecast.wind_direction_deg, forecast.wind_direction);
    const windLabel = windDirection != null && beach.wind_offshore_deg != null ? classifyWindQuality(windDirection, beach.wind_offshore_deg, beach.wind_offshore_tol_deg ?? 45).label : null;
    rows.push({ beachSlug: String(byId.get(String(session.beach_id))?.slug), oldScore, newScore, rating: Number(session.rating), oldLabel: getQualityLabel(oldScore), newLabel: getQualityLabel(newScore), onshore: windLabel === 'onshore', outOfWindow: !inSwellWindow(swellDirection, beach.swell_window_center_deg ?? null, beach.swell_window_halfwidth_deg ?? null) });
  }
  const summary = { days, calibratedBeaches: eligible.length, realSessions: realSessions.length, matchedSessions: rows.length, noForecastRows: noForecast, ...summarize(rows) };
  console.log(`calibrated beaches=${eligible.length} real-user sessions=${realSessions.length} matched=${rows.length} no forecast row=${noForecast}`);
  console.log(JSON.stringify(summary, null, 2));
  for (const [name, status] of Object.entries(summary.gates)) console.log(`${name}: ${status}`);
  if (out) writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
