import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vawdnbbgawichorsjiwe.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY2ODQ0NCwiZXhwIjoyMDYyMjQ0NDQ0fQ.4rctfUxZrDgoc2Zu2Lzx1dxKKBwSRkYOxwc0wfGlPtM';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' }
});

console.log('Checking production database:', supabaseUrl);
console.log('=====================================\n');

async function checkMigrations() {
  // Skip migration table query - just test the function and data directly
  console.log('Note: Checking migration status by testing function and data state\n');

  // Test get_nearby_beaches function
  console.log('Testing get_nearby_beaches function:');
  console.log('=====================================');

  try {
    const { data: funcData, error: funcError } = await supabase.rpc('get_nearby_beaches', {
      input_lat: 32.7941,
      input_lng: -117.2340,
      max_distance_meters: 16093,
      limit_count: 1
    });

    if (funcError) {
      console.error('✗ Function test failed:', funcError.message);
      console.log('\nThis likely means migration 20251208000000 has NOT been applied yet.');
    } else if (funcData && funcData.length > 0) {
      console.log('✓ Function is working');
      console.log('\nReturned columns:', Object.keys(funcData[0]).join(', '));

      console.log('\nURL generation fields:');
      const hasSlug = funcData[0].slug !== undefined;
      const hasCity = funcData[0].city !== undefined;
      const hasState = funcData[0].state !== undefined;

      console.log('  slug:', hasSlug ? '✓ present' : '✗ missing');
      console.log('  city:', hasCity ? '✓ present' : '✗ missing');
      console.log('  state:', hasState ? '✓ present' : '✗ missing');

      if (hasSlug && hasCity && hasState) {
        console.log('\n✓ Migration 20251208000000 appears to be APPLIED');
        console.log('\nSample data:');
        console.log('  Beach:', funcData[0].name);
        console.log('  Slug:', funcData[0].slug);
        console.log('  City:', funcData[0].city);
        console.log('  State:', funcData[0].state);
      } else {
        console.log('\n✗ Migration 20251208000000 NOT APPLIED (missing fields)');
      }
    } else {
      console.log('No beaches returned from function');
    }
  } catch (err) {
    console.error('✗ Function error:', err.message);
    console.log('\nThis likely means migration 20251208000000 has NOT been applied yet.');
  }

  // Check Blacks Beach data
  console.log('\n\nBlacks Beach current data:');
  console.log('==========================');

  try {
    const { data: beachData, error: beachError } = await supabase
      .from('beaches')
      .select('id, name, city, state, slug, break_type')
      .eq('id', '01330afc-00d3-461b-88f3-b173774766f4')
      .single();

    if (beachError) {
      console.error('Error:', beachError.message);
    } else if (beachData) {
      console.log('Name:', beachData.name);
      console.log('City:', beachData.city || 'NULL');
      console.log('State:', beachData.state || 'NULL');
      console.log('Slug:', beachData.slug || 'NULL');
      console.log('Break Type:', beachData.break_type || 'NULL');

      const needsUpdate = !beachData.city || !beachData.state;
      if (needsUpdate) {
        console.log('\n✗ Migration 20251208100000 NOT APPLIED (city/state are NULL)');
      } else {
        console.log('\n✓ Migration 20251208100000 appears to be APPLIED');
      }
    } else {
      console.log('Beach not found');
    }
  } catch (err) {
    console.error('Error checking beach:', err.message);
  }
}

checkMigrations().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
