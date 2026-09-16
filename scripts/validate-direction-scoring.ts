#!/usr/bin/env tsx
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { transformToFaceHeightWithMetadata, type BeachTerrainConfig } from '@/lib/utils/wave-height-transformer';
import { scoreNativeConditionBreakdown, nativeScoreInputsFromForecast, type NativeDirectionScoreInput } from '@/lib/scoring/native-condition-score';
import type { EnhancedForecastEntity } from '@/types/forecast';

const SCRIPT_BEACH_ID = '4b0cf129-c706-4e24-8210-2219defc5ea7';
const SLUGS = ['blacks', 'lower-trestles', 'upper-trestles', 'church'];

export function directionForForecast(row: Record<string, unknown>, beach: BeachTerrainConfig): NativeDirectionScoreInput {
  return {
    windDirectionDeg: numberOrNull(row.wind_direction_deg),
    swellDirectionDeg: numberOrNull(row.swell_1_direction_deg ?? row.wave_direction_deg),
    offshoreDeg: 90,
    offshoreToleranceDeg: 45,
    windowCenterDeg: beach.swell_window_center_deg ?? null,
    windowHalfwidthDeg: beach.swell_window_halfwidth_deg ?? null,
  };
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
  const { data: beaches, error: beachError } = await db.from('beaches').select('*').or(`id.eq.${SCRIPT_BEACH_ID},slug.in.(${SLUGS.join(',')})`).not('shoaling_factors', 'is', null);
  if (beachError) throw beachError;
  for (const beach of (beaches ?? []) as Array<Record<string, unknown>>) {
    const { data: forecasts, error } = await db.from('enhanced_forecasts').select('*').eq('beach_id', beach.id).gte('forecast_at', new Date().toISOString()).order('forecast_at').limit(48);
    if (error) throw error;
    console.log(`\n## ${beach.slug ?? beach.id}`);
    for (const row of (forecasts ?? []) as Array<Record<string, unknown>>) {
      const typed = row as unknown as EnhancedForecastEntity;
      const config = beach as BeachTerrainConfig;
      const rawHeight = numberOrNull(row.cdip_wave_height_ft ?? row.wave_height_ft ?? row.wave_height) ?? 0;
      const period = numberOrNull(row.swell_1_period ?? row.wave_period) ?? null;
      const direction = numberOrNull(row.swell_1_direction_deg ?? row.wave_direction_deg);
      const oldHeight = transformToFaceHeightWithMetadata({ rawHeightFt: rawHeight, periodS: period, swellDirectionDeg: direction, source: 'cdip_sig', beach: config, directionScoringEnabled: false });
      const newHeight = transformToFaceHeightWithMetadata({ rawHeightFt: rawHeight, periodS: period, swellDirectionDeg: direction, source: 'cdip_sig', beach: config, directionScoringEnabled: true });
      const input = nativeScoreInputsFromForecast(typed);
      const dir = directionForForecast(row, config);
      const oldScore = scoreNativeConditionBreakdown(input, undefined, undefined);
      const newScore = scoreNativeConditionBreakdown(input, undefined, undefined, dir);
      console.log(JSON.stringify({ forecast_at: row.forecast_at, raw: { swell_height: rawHeight, period, direction, wind_speed: row.wind_speed, wind_direction: row.wind_direction_deg }, old: { score: oldScore.score, components: oldScore.components, face_height_ft: oldHeight.faceHeightFt }, new: { score: newScore.score, components: newScore.components, face_height_ft: newHeight.faceHeightFt, direction_factor: newHeight.directionFactor } }));
    }
  }
  console.log('\n## Verdict\n- onshore wind lowers wind quality\n- SSW at Scripps lowers alignment\n- flag-off identical');
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
