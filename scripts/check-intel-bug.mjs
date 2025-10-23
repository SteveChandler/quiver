import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('beach_daily_intel')
  .select('beach_id, forecast_date, best_window_start, best_window_end, best_window_description, surf_min_ft, surf_max_ft, generated_at')
  .order('generated_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('\nRecent beach_daily_intel records:');
console.log('='.repeat(80));
let bugCount = 0;
data.forEach((row, i) => {
  const isBug = row.best_window_start === row.best_window_end;
  if (isBug) bugCount++;
  
  console.log(`\n[${i + 1}] Beach: ${row.beach_id.slice(0, 8)}...`);
  console.log(`    Date: ${row.forecast_date}`);
  console.log(`    Window: ${row.best_window_start} - ${row.best_window_end}`);
  console.log(`    Description: ${row.best_window_description || 'N/A'}`);
  console.log(`    Surf: ${row.surf_min_ft}-${row.surf_max_ft} ft`);
  
  if (isBug) {
    console.log(`    ❌ BUG: Identical start/end times!`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`Found ${bugCount} records with identical start/end times out of ${data.length} total`);

process.exit(0);
