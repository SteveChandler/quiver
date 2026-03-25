import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function query() {
  // Which beaches have forecasts right now? (these are the "active" ones the cron refreshes)
  const { data: forecastBeaches } = await supabase
    .from('enhanced_forecasts')
    .select('beach_id, beaches!inner(name, state, city)')
    .gte('forecast_at', new Date(Date.now() - 48*60*60*1000).toISOString())
    .order('forecast_at', { ascending: false })
    .limit(1000);
  
  const byBeach = {};
  for (const f of (forecastBeaches || [])) {
    if (!byBeach[f.beach_id]) {
      byBeach[f.beach_id] = f.beaches;
    }
  }
  
  console.log('=== Beaches with forecasts (48h) ===');
  console.log('Count:', Object.keys(byBeach).length);
  for (const [id, b] of Object.entries(byBeach)) {
    console.log(`  ${b.name}, ${b.city}, ${b.state}`);
  }

  // What does the candidate pool builder use? Check for home_beach or user locations
  const { data: homeBeaches } = await supabase
    .from('profiles')
    .select('home_beach_id')
    .not('home_beach_id', 'is', null)
    .limit(100);
  
  const uniqueHomeBeaches = new Set(homeBeaches?.map(p => p.home_beach_id) || []);
  console.log('\nUnique home beaches set by users:', uniqueHomeBeaches.size);
}
query().catch(console.error);
