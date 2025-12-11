import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SECURITY: Credentials must be provided via environment variables - never hardcode
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SECURITY ERROR: Missing required environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n   Set these in your .env.local file or export them before running.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Applying migrations to production database:', supabaseUrl);
console.log('=========================================================\n');

async function applyMigration(filename) {
  console.log(`\nApplying migration: ${filename}`);
  console.log('='.repeat(60));

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', filename);

  try {
    const sql = readFileSync(migrationPath, 'utf8');

    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(`✗ Migration failed:`, error.message);
      return false;
    }

    console.log(`✓ Migration applied successfully`);
    return true;
  } catch (err) {
    console.error(`✗ Error reading or applying migration:`, err.message);
    return false;
  }
}

async function verifyMigrations() {
  console.log('\n\nVerifying migrations...');
  console.log('='.repeat(60));

  // Test get_nearby_beaches function
  console.log('\n1. Testing get_nearby_beaches function:');
  try {
    const { data, error } = await supabase.rpc('get_nearby_beaches', {
      input_lat: 32.7941,
      input_lng: -117.2340,
      max_distance_meters: 16093,
      limit_count: 1
    });

    if (error) {
      console.error('   ✗ Function test failed:', error.message);
      return false;
    }

    if (data && data.length > 0) {
      const hasSlug = data[0].slug !== undefined;
      const hasCity = data[0].city !== undefined;
      const hasState = data[0].state !== undefined;

      console.log('   Returned columns:', Object.keys(data[0]).join(', '));
      console.log('   - slug:', hasSlug ? '✓ present' : '✗ missing');
      console.log('   - city:', hasCity ? '✓ present' : '✗ missing');
      console.log('   - state:', hasState ? '✓ present' : '✗ missing');

      if (!hasSlug || !hasCity || !hasState) {
        console.error('   ✗ Migration verification failed: missing expected fields');
        return false;
      }

      console.log('   ✓ All expected fields present');

      // Show sample data
      console.log('\n   Sample data:');
      console.log('   - Beach:', data[0].name);
      console.log('   - Slug:', data[0].slug || 'NULL');
      console.log('   - City:', data[0].city || 'NULL');
      console.log('   - State:', data[0].state || 'NULL');
      console.log('   - Location:', data[0].location);
    }
  } catch (err) {
    console.error('   ✗ Function error:', err.message);
    return false;
  }

  // Test Blacks Beach data (only if second migration was applied)
  console.log('\n2. Checking Blacks Beach data:');
  try {
    const { data, error } = await supabase
      .from('beaches')
      .select('id, name, city, state, slug, break_type')
      .eq('id', '01330afc-00d3-461b-88f3-b173774766f4')
      .single();

    if (error) {
      console.error('   ✗ Query failed:', error.message);
      return false;
    }

    if (data) {
      console.log('   Name:', data.name);
      console.log('   City:', data.city || 'NULL');
      console.log('   State:', data.state || 'NULL');
      console.log('   Slug:', data.slug || 'NULL');
      console.log('   Break Type:', data.break_type || 'NULL');

      if (data.city && data.state) {
        console.log('   ✓ Blacks Beach data looks good');
      } else {
        console.log('   Note: City/State are still NULL (second migration not applied)');
      }
    }
  } catch (err) {
    console.error('   ✗ Error:', err.message);
    return false;
  }

  return true;
}

// Main execution
async function main() {
  const migrations = [
    '20251208000000_add_url_fields_to_get_nearby_beaches.sql'
  ];

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.error('\n❌ Migration failed. Stopping.');
      process.exit(1);
    }
  }

  const verified = await verifyMigrations();
  if (!verified) {
    console.error('\n❌ Migration verification failed.');
    process.exit(1);
  }

  console.log('\n\n✓ All migrations applied and verified successfully!');
  console.log('=========================================================');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
