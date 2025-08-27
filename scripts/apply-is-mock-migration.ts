#!/usr/bin/env tsx
/**
 * Apply is_mock migration to production database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vawdnbbgawichorsjiwe.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY2ODQ0NCwiZXhwIjoyMDYyMjQ0NDQ0fQ.4rctfUxZrDgoc2Zu2Lzx1dxKKBwSRkYOxwc0wfGlPtM';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  console.log('🔄 Applying is_mock migration to production...');
  
  try {
    // Check if column already exists
    const { data: columns, error: checkError } = await supabase.rpc('get_column_info', {
      p_schema: 'public',
      p_table: 'profiles',
      p_column: 'is_mock'
    }).single();
    
    if (!checkError && columns) {
      console.log('✅ Column is_mock already exists in profiles table');
      return;
    }
    
    // Apply migration using raw SQL through RPC or direct query
    const migrationSQL = `
      -- Add is_mock column to profiles table if it doesn't exist
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE;
      
      -- Create index for better query performance
      CREATE INDEX IF NOT EXISTS idx_profiles_is_mock 
      ON public.profiles(is_mock) 
      WHERE is_mock = true;
    `;
    
    // Since we can't run DDL directly, let's check if the column exists by trying to query it
    const { error: testError } = await supabase
      .from('profiles')
      .select('is_mock')
      .limit(1);
    
    if (testError && testError.message.includes('column profiles.is_mock does not exist')) {
      console.log('❌ Column does not exist. Please apply this migration manually:');
      console.log('\n--- MIGRATION SQL ---');
      console.log(migrationSQL);
      console.log('--- END MIGRATION ---\n');
      console.log('You can apply this through the Supabase dashboard SQL editor.');
      process.exit(1);
    } else if (!testError) {
      console.log('✅ Column is_mock exists in profiles table');
    } else {
      console.error('❌ Unexpected error:', testError.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();