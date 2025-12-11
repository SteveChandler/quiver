import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SECURITY: Credentials must be provided via environment variables - never hardcode
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SECURITY ERROR: Missing required environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Optional: SUPABASE_DB_PASSWORD (for direct Postgres connection)');
  console.error('\n   Set these in your .env.local file or export them before running.');
  process.exit(1);
}

console.log('🚀 Applying Migration to Production Database');
console.log('============================================');
console.log('Database:', supabaseUrl);
console.log('\n⚠️  WARNING: This will modify PRODUCTION data!');
console.log('Press Ctrl+C within 3 seconds to cancel...\n');

await new Promise(resolve => setTimeout(resolve, 3000));

async function applyMigrationViaSql() {
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251208000000_add_url_fields_to_get_nearby_beaches.sql');

  console.log('Reading migration file...');
  const migrationSql = readFileSync(migrationPath, 'utf8');

  // Create Supabase client for verification
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Since we can't execute DDL via RPC, we'll use the PostgREST API
  // The migration needs to be executed via the Supabase Dashboard or CLI
  console.log('\n❌ Cannot execute DDL migrations via Supabase JS client');
  console.log('\nMigration SQL to apply:');
  console.log('=' .repeat(60));
  console.log(migrationSql);
  console.log('=' .repeat(60));

  // Extract project ref from URL for dashboard link
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'YOUR_PROJECT_REF';
  
  console.log('\n📝 INSTRUCTIONS:');
  console.log('1. Copy the SQL above');
  console.log(`2. Go to https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('3. Paste and execute the SQL');
  console.log('4. Run the verification script after applying\n');

  console.log('Or use Supabase CLI:');
  console.log('  supabase db push --linked');

  return false;
}

applyMigrationViaSql();
