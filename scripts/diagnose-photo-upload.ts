/**
 * Diagnostic script for photo upload issue
 * Run with: npx tsx scripts/diagnose-photo-upload.ts
 */

import { createClient } from '@supabase/supabase-js';

// Use production credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase credentials');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL_PROD and SUPABASE_SERVICE_ROLE_KEY_PROD');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_SESSION_ID = 'aea73ffd-5e2a-4b26-b506-fd9d81a1ca81';

async function runDiagnostics() {
  console.log('\n================================================');
  console.log('PHOTO UPLOAD DIAGNOSTICS');
  console.log('================================================\n');

  // 1. Check test session
  console.log('1. Checking if test session exists...');
  try {
    const { data: session, error } = await supabase
      .from('sessions')
      .select('id, user_id, beach_name, created_at, is_public')
      .eq('id', TEST_SESSION_ID)
      .single();

    if (error) {
      console.log('❌ Test session NOT found');
      console.log(`   Error: ${error.message}`);
    } else if (session) {
      console.log('✅ Test session found');
      console.log(`   ID: ${session.id}`);
      console.log(`   User: ${session.user_id}`);
      console.log(`   Beach: ${session.beach_name}`);
      console.log(`   Created: ${session.created_at}`);
    }
  } catch (err) {
    console.log('❌ Error querying sessions:', err);
  }
  console.log('');

  // 2. Check session_media table
  console.log('2. Checking session_media table...');
  try {
    const { count, error } = await supabase
      .from('session_media')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ Error querying session_media: ${error.message}`);
    } else {
      console.log(`   Total records: ${count}`);
      if (count === 0) {
        console.log('   ⚠️  NO PHOTOS in session_media table');
      }
    }

    // Check for test session specifically
    const { data: testSessionMedia } = await supabase
      .from('session_media')
      .select('*')
      .eq('session_id', TEST_SESSION_ID);

    console.log(`   Photos for test session: ${testSessionMedia?.length || 0}`);
  } catch (err) {
    console.log('❌ Error:', err);
  }
  console.log('');

  // 3. Check storage.objects
  console.log('3. Checking storage.objects (files in bucket)...');
  try {
    const { data: files, error } = await supabase
      .from('objects')
      .select('*')
      .eq('bucket_id', 'session-media')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      // Try accessing via storage API instead
      console.log('   Using storage API instead...');
      const { data: bucketFiles, error: listError } = await supabase
        .storage
        .from('session-media')
        .list('', { limit: 100 });

      if (listError) {
        console.log(`❌ Cannot access storage: ${listError.message}`);
      } else {
        console.log(`   Files in bucket: ${bucketFiles?.length || 0}`);
        if (bucketFiles && bucketFiles.length > 0) {
          console.log('   Recent files:');
          bucketFiles.slice(0, 5).forEach(file => {
            console.log(`     - ${file.name} (${file.metadata?.size} bytes)`);
          });
        }
      }
    } else {
      console.log(`   Files in storage.objects: ${files?.length || 0}`);
      if (files && files.length > 0) {
        console.log('   Recent files:');
        files.slice(0, 5).forEach(file => {
          console.log(`     - ${file.name}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Error:', err);
  }
  console.log('');

  // 4. Check storage_usage table
  console.log('4. Checking storage_usage table...');
  try {
    const { data, error } = await supabase
      .from('storage_usage')
      .select('*')
      .limit(5);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ storage_usage table DOES NOT EXIST');
        console.log('   This is CRITICAL - uploads will fail!');
      } else {
        console.log(`❌ Error: ${error.message} (code: ${error.code})`);
      }
    } else {
      console.log(`✅ storage_usage table exists`);
      console.log(`   Records: ${data?.length || 0}`);
    }
  } catch (err) {
    console.log('❌ Error:', err);
  }
  console.log('');

  // 5. Check update_user_storage_usage function
  console.log('5. Checking update_user_storage_usage() function...');
  try {
    // Try to call the function with dummy data
    const { data, error } = await supabase.rpc('update_user_storage_usage', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_bytes_to_add: 0,
      p_images_to_add: 0
    });

    if (error) {
      if (error.code === '42883') {
        console.log('❌ update_user_storage_usage() function DOES NOT EXIST');
        console.log('   This is CRITICAL - uploads will fail!');
      } else {
        console.log(`❌ Error: ${error.message} (code: ${error.code})`);
      }
    } else {
      console.log('✅ update_user_storage_usage() function exists');
    }
  } catch (err) {
    console.log('❌ Error:', err);
  }
  console.log('');

  // 6. Check session-media bucket
  console.log('6. Checking session-media bucket configuration...');
  try {
    const { data: buckets, error } = await supabase
      .storage
      .listBuckets();

    if (error) {
      console.log(`❌ Error listing buckets: ${error.message}`);
    } else {
      const sessionMediaBucket = buckets.find(b => b.id === 'session-media');
      if (sessionMediaBucket) {
        console.log('✅ session-media bucket exists');
        console.log(`   Public: ${sessionMediaBucket.public}`);
        console.log(`   File size limit: ${sessionMediaBucket.file_size_limit || 'none'}`);
      } else {
        console.log('❌ session-media bucket DOES NOT EXIST');
      }
    }
  } catch (err) {
    console.log('❌ Error:', err);
  }
  console.log('');

  // Summary
  console.log('================================================');
  console.log('DIAGNOSTIC SUMMARY');
  console.log('================================================');
  console.log('');
  console.log('Next steps:');
  console.log('1. Check if storage_usage table exists (Section 4)');
  console.log('2. Check if update_user_storage_usage() function exists (Section 5)');
  console.log('3. Check if files are in storage but not in session_media (Sections 2 & 3)');
  console.log('');
  console.log('If storage_usage or function is missing:');
  console.log('  → Run migration: scripts/migrations/002_session_media.sql');
  console.log('');
  console.log('If files are in storage but NOT in session_media:');
  console.log('  → Upload succeeded but database insert failed');
  console.log('  → Check session_media RLS policies');
  console.log('');
}

runDiagnostics()
  .then(() => {
    console.log('\nDiagnostics complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
