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

  // Check ALL data sources for this beach today
  const today = new Date().toISOString().split('T')[0];
  const { data: forecasts } = await supabase
    .from('enhanced_forecasts')
    .select('forecast_at, wind_speed, wind_direction, wind_direction_deg, data_source')
    .eq('beach_id', beach.id)
    .gte('forecast_at', today + 'T00:00:00Z')
    .lte('forecast_at', today + 'T23:59:59Z')
    .order('forecast_at', { ascending: true });

  // Group by source
  const bySource = {};
  for (const f of (forecasts || [])) {
    const src = f.data_source;
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(f);
  }
  
  console.log('=== ' + beach.name + ' — All Sources Today ===');
  for (const [src, rows] of Object.entries(bySource)) {
    console.log('\n--- ' + src + ' (' + rows.length + ' forecasts) ---');
    for (const f of rows) {
      const utcHour = new Date(f.forecast_at).getUTCHours();
      const pdtHour = (utcHour - 7 + 24) % 24;
      console.log(`  ${pdtHour}:00 PDT | wind: ${f.wind_speed || 'null'} ${f.wind_direction || 'null'} (${f.wind_direction_deg ?? 'null'}°)`);
    }
  }

  // Also check: how does the orchestrator pick which source per slot?
  console.log('\n=== Slot → Source Mapping (matching oracle 5/8/11/2/5 slots) ===');
  const slotHours = [5, 8, 11, 14, 17];
  for (const h of slotHours) {
    const utcH = (h + 7) % 24;
    const match = forecasts?.find(f => new Date(f.forecast_at).getUTCHours() === utcH);
    if (match) {
      console.log(`  ${h}:00 PDT → ${match.data_source} | ${match.wind_speed || 'null'} ${match.wind_direction || 'null'}`);
    } else {
      console.log(`  ${h}:00 PDT → NO MATCH`);
    }
  }
}
query().catch(console.error);
