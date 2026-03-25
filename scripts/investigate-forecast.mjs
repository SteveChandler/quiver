import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function query() {
  const { data: beach, error: beachError } = await supabase
    .from('beaches')
    .select('id, name')
    .ilike('name', 'Blacks')
    .limit(1)
    .single();

  if (beachError || !beach) {
    console.log('Beach not found:', beachError?.message);
    return;
  }

  console.log('Beach:', beach.name, '(' + beach.id + ')');

  const today = '2026-03-12'; // The date from the screenshot
  const { data: forecasts, error } = await supabase
    .from('enhanced_forecasts')
    .select('forecast_date, forecast_time, wave_height, wave_period, wave_direction, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction, tide_height, tide_status, confidence_score, data_source')
    .eq('beach_id', beach.id)
    .eq('forecast_date', today)
    .order('forecast_time', { ascending: true });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('\nForecasts for ' + today + ':');
  if (!forecasts || forecasts.length === 0) {
    console.log('  No forecasts found for today');
    return;
  }
  forecasts.forEach(f => {
    const line = '  ' + f.forecast_time + ': ' + (f.wave_height || 'N/A') + ' | Tide: ' + (f.tide_height || 'N/A') + ' ' + (f.tide_status || 'N/A') + ' | Source: ' + f.data_source;
    console.log(line);
  });
}

query();
