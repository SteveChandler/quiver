#!/usr/bin/env tsx
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BeachTerrainConfig } from '@/lib/utils/wave-height-transformer';
import { scoreNativeConditionBreakdown, nativeScoreInputsFromForecast, type NativeDirectionScoreInput } from '@/lib/scoring/native-condition-score';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { directionInput } from '@/lib/services/discovery/window-selector/window-scorer';
import { getDirectionDegrees } from '@/lib/services/discovery/window-selector/direction-utils';

const SLUGS = ['scripps', 'blacks', 'lower-trestles', 'upper-trestles', 'church', 'ocean-beach-sloat-san-francisco-ca'];

export function directionForForecast(row: Record<string, unknown>, beach: BeachTerrainConfig): NativeDirectionScoreInput | undefined {
  return directionInput(row as unknown as EnhancedForecastEntity, beach as BeachTerrainConfig & { wind_offshore_deg?: number | null }, true);
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service credentials.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function printHelp(): void {
  console.log('Usage: yarn tsx scripts/validate-direction-scoring.ts [--help]\nREAD-ONLY: traces the next 48 enhanced_forecasts slots for calibrated direction-scoring beaches.');
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) return printHelp();
  const db = client();
  const { data: beaches, error: beachError } = await db.from('beaches').select('*').in('slug', SLUGS).not('shoaling_factors', 'is', null);
  if (beachError) throw beachError;
  for (const beach of (beaches ?? []) as Array<Record<string, unknown>>) {
    const { data: forecasts, error } = await db.from('enhanced_forecasts').select('*').eq('beach_id', beach.id).gte('forecast_at', new Date().toISOString()).order('forecast_at').limit(48);
    if (error) throw error;
    console.log(`\n## ${beach.slug}`);
    const config = beach as BeachTerrainConfig;
    for (const row of (forecasts ?? []) as Array<Record<string, unknown>>) {
      const typed = row as unknown as EnhancedForecastEntity;
      const rawHeight = parseFloat(String(row.wave_height ?? '0')) || 0;
      const period = parseFloat(String(row.swell_1_period ?? row.wave_period ?? '0')) || null;
      const swellDirectionDeg = getDirectionDegrees(row.swell_1_direction ?? row.wave_direction, null);
      const input = nativeScoreInputsFromForecast(typed);
      const direction = directionForForecast(row, config);
      const oldScore = scoreNativeConditionBreakdown(input, undefined, undefined);
      const newScore = scoreNativeConditionBreakdown(input, undefined, undefined, direction);
      console.log(JSON.stringify({ forecast_at: row.forecast_at, raw: { wave_height: rawHeight, period, swell_direction: swellDirectionDeg, wind_speed: row.wind_speed, wind_direction: getDirectionDegrees(row.wind_direction_deg, row.wind_direction) }, old: { score: oldScore.score, components: oldScore.components }, new: { score: newScore.score, components: newScore.components } }));
    }
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
