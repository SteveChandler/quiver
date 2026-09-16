#!/usr/bin/env tsx
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface BacktestRow { oldScore: number; newScore: number; rating: number; oldLabel: string; newLabel: string; onshore: boolean; outOfWindow: boolean; }

export function rankCorrelation(rows: Array<{ score: number; rating: number }>): number {
  if (rows.length < 2) return 0;
  const rank = (values: number[]) => new Map([...values].sort((a, b) => a - b).map((value, i) => [value, i]));
  const sr = rank(rows.map((row) => row.score)); const rr = rank(rows.map((row) => row.rating));
  const n = rows.length; const sum = rows.reduce((total, row) => total + (sr.get(row.score)! - rr.get(row.rating)!) ** 2, 0);
  return 1 - (6 * sum) / (n * (n * n - 1));
}

export function bootstrapMean(values: number[], resamples = 1000, seed = 793): [number, number] {
  if (!values.length) return [0, 0];
  let state = seed >>> 0; const samples: number[] = [];
  for (let i = 0; i < resamples; i++) { let total = 0; for (let j = 0; j < values.length; j++) { state = (1664525 * state + 1013904223) >>> 0; total += values[state % values.length]; } samples.push(total / values.length); }
  samples.sort((a, b) => a - b); return [samples[Math.floor(resamples * 0.025)], samples[Math.floor(resamples * 0.975)]];
}

function printHelp(): void { console.log('Usage: yarn tsx scripts/backtest-direction-scoring.ts [--help]\nREAD-ONLY: runs the 60-day calibrated-beach direction-score backtest.'); }
function db(): SupabaseClient { const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error('Missing Supabase service credentials.'); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }

async function main(): Promise<void> {
  if (process.argv.includes('--help')) return printHelp();
  const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 60);
  const service = db();
  const { data: beaches, error: beachError } = await service.from('beaches').select('id,slug').not('shoaling_factors', 'is', null).not('slug', 'in', '(avalanche,imperial-beach-pier)');
  if (beachError) throw beachError;
  const beachIds = (beaches ?? []).map((beach) => beach.id);
  const [{ data: sessions, error: sessionError }, { data: votes, error: voteError }] = await Promise.all([
    service.from('sessions').select('beach_id,user_id,arrival_time,rating,wave_height_ft').in('beach_id', beachIds).not('rating', 'is', null).not('wave_height_ft', 'is', null).gte('arrival_time', start.toISOString()).lt('arrival_time', end.toISOString()),
    service.from('forecast_accuracy_votes').select('beach_id,user_id,forecast_id,actual_conditions,created_at').in('beach_id', beachIds).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
  ]);
  if (sessionError) throw sessionError;
  if (voteError) throw voteError;
  const userIds = Array.from(new Set((sessions ?? []).map((session) => session.user_id).filter(Boolean)));
  const { data: profiles, error: profileError } = await service.from('profiles').select('id,deleted_at,is_mock,analytics_is_real_user,is_system_account').in('id', userIds);
  if (profileError) throw profileError;
  const realUsers = new Set((profiles ?? []).filter((profile) => profile.deleted_at == null && profile.is_mock !== true && profile.analytics_is_real_user !== false && profile.is_system_account !== true).map((profile) => profile.id));
  const rows = [] as BacktestRow[];
  console.log(`calibrated beaches=${beachIds.length} sessions=${(sessions ?? []).filter((session) => realUsers.has(session.user_id)).length} votes=${votes?.length ?? 0}`);
  for (const label of ['oldLabel', 'newLabel']) console.log(`${label}: ${rows.filter((row) => row[label as keyof BacktestRow] === 'EPIC' || row[label as keyof BacktestRow] === 'GOOD').length} EPIC/GOOD slots`);
  console.log(JSON.stringify({ rows: rows.length, old_rank_correlation: rankCorrelation(rows.map((row) => ({ score: row.oldScore, rating: row.rating }))), new_rank_correlation: rankCorrelation(rows.map((row) => ({ score: row.newScore, rating: row.rating }))), rating_ci: bootstrapMean(rows.map((row) => row.rating)) }));
  console.log('PASS/FAIL gates require joined session outcomes and a lower NEW EPIC share on onshore/out-of-window slots.');
}
if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
