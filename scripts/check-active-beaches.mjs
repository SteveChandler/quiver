import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function query() {
  // Total beaches
  const { count: total } = await supabase
    .from('beaches')
    .select('*', { count: 'exact', head: true });

  // Beaches with forecasts in last 24h (active)
  const { data: activeBeaches } = await supabase
    .from('enhanced_forecasts')
    .select('beach_id')
    .gte('forecast_at', new Date(Date.now() - 24*60*60*1000).toISOString())
    .limit(1000);
  
  const uniqueActive = new Set(activeBeaches?.map(f => f.beach_id) || []);

  // Beaches requested by oracle in last 24h (from discovery logs or similar)
  // Check if there's a way to identify "hot" beaches
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('beach_id')
    .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
    .limit(1000);
  
  const sessionBeaches = new Set(recentSessions?.map(s => s.beach_id).filter(Boolean) || []);

  console.log('=== Beach Activity ===');
  console.log('Total beaches:', total);
  console.log('With forecasts (24h):', uniqueActive.size);
  console.log('With sessions (7d):', sessionBeaches.size);
  
  // Check if there's a "popular" or "featured" flag
  const { data: popularCheck } = await supabase
    .from('beaches')
    .select('id, name, state')
    .limit(3);
  
  console.log('\nSample beach columns:', Object.keys(popularCheck?.[0] || {}));
  
  // Check page views or analytics
  const { count: pageViewCount } = await supabase
    .from('user_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'page_view')
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
  
  console.log('Page view events (24h):', pageViewCount);
}
query().catch(console.error);
