#!/usr/bin/env npx tsx
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data } = await supabase
    .from('ioos_stations')
    .select('source_network, station_id')
    .eq('active', true)
    .eq('has_wave_data', true);

  const byNetwork: Record<string, number> = {};
  for (const s of data || []) {
    byNetwork[s.source_network] = (byNetwork[s.source_network] || 0) + 1;
  }
  console.log('Stations by network:', byNetwork);

  // Get sample non-CDIP stations
  const samples = (data || []).filter(s => s.source_network !== 'CeNCOOS').slice(0,5);
  console.log('\nNon-CeNCOOS samples:', samples.map(s => `${s.station_id} (${s.source_network})`));
}
check();
