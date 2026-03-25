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

  const today = '2026-03-12';
  const { data: tides, error } = await supabase
    .from('tide_forecasts')
    .select('ts, tide_height_m, tide_phase')
    .eq('beach_id', beach.id)
    .gte('ts', today + 'T00:00:00Z')
    .lte('ts', today + 'T23:59:59Z')
    .order('ts', { ascending: true });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('\nTide Forecasts for ' + today + ':');
  if (!tides || tides.length === 0) {
    console.log('  No tide forecasts found for today');
    return;
  }
  tides.forEach(t => {
    console.log('  ' + t.ts + ': ' + t.tide_height_m + 'm (' + t.tide_phase + ')');
  });
}

query();
