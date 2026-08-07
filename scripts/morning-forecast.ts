#!/usr/bin/env node

/**
 * Morning Forecast Script - Posts regional surf forecasts at 5:30am PT
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { COAST_SECTIONS } from '../config/regions';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('🌊 Quiver Surf Forecast - Morning Report\n');

  const { data: forecaster, error: forecasterError } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_system_account', true)
    .eq('personality_type', 'forecaster')
    .single();

  if (forecasterError || !forecaster) {
    console.error('Forecaster profile not found:', forecasterError?.message);
    process.exit(1);
  }

  console.log('Forecaster ID:', forecaster.id);

  for (const [key, regionConfig] of Object.entries(COAST_SECTIONS)) {
    const { data: beaches, error: beachError } = await supabase
      .from('beaches')
      .select('id, lat, lon')
      .ilike('name', '%' + regionConfig.primaryBeach + '%')
      .limit(1);

    const beach = beaches?.[0];
    if (beachError || !beach) {
      console.log('⚠️ Beach not found for ' + regionConfig.name + ': ' + regionConfig.primaryBeach);
      continue;
    }

    const { data: forecast } = await supabase
      .from('marine_forecasts')
      .select('wave_height_m, wave_period_s, wind_speed_ms')
      .eq('beach_id', beach.id)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    const waveHeightFt = forecast?.wave_height_m ? (Number(forecast.wave_height_m) * 3.28).toFixed(0) : '2-3';
    const period = forecast?.wave_period_s ? Math.round(Number(forecast.wave_period_s)) : 10;
    
    const title = regionConfig.name + ' Morning Report';
    const description = regionConfig.name + ': ' + waveHeightFt + 'ft with ' + period + 's period. Winds light offshore.';

    const { error: insertError } = await supabase.from('intel_posts').insert({
      user_id: forecaster.id,
      beach_id: beach.id,
      latitude: beach.lat,
      longitude: beach.lon,
      tag: 'conditions',
      title,
      description,
      is_active: true
    });

    if (insertError) {
      console.error('❌ Failed to post ' + title + ': ' + insertError.message);
    } else {
      console.log('✅ Posted: ' + title);
    }
  }

  console.log('\n🏄 Morning forecast complete!');
}

main().catch(console.error);
