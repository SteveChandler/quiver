import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function query() {
  const { data: beach } = await supabase
    .from('beaches')
    .select('id, name')
    .ilike('name', '%Pacific Beach%')
    .eq('state', 'CA')
    .limit(1)
    .single();

  if (!beach) { console.log('No beach found'); return; }

  const today = new Date().toISOString().split('T')[0];
  const { data: forecasts } = await supabase
    .from('enhanced_forecasts')
    .select('forecast_at, wind_speed, wind_direction, wind_direction_deg, data_source')
    .eq('beach_id', beach.id)
    .gte('forecast_at', today + 'T00:00:00Z')
    .lte('forecast_at', today + 'T23:59:59Z')
    .order('forecast_at', { ascending: true });

  console.log('=== ' + beach.name + ' Wind Forecasts Today ===');
  for (const f of (forecasts || [])) {
    const utcHour = new Date(f.forecast_at).getUTCHours();
    const pdtHour = (utcHour - 7 + 24) % 24;
    console.log(`  ${pdtHour}:00 PDT | wind: ${f.wind_speed || 'null'} ${f.wind_direction || 'null'} (${f.wind_direction_deg ?? 'null'}deg) | src: ${f.data_source}`);
  }
}
query().catch(console.error);
