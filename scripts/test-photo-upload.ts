import { createClient } from '@supabase/supabase-js';

// Check if session-media bucket exists and test upload
async function testPhotoUpload() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Testing photo upload infrastructure...\n');

  // 1. Check if bucket exists
  console.log('1. Checking if session-media bucket exists...');
  const { data: buckets, error: bucketsError } = await supabase
    .storage
    .listBuckets();

  if (bucketsError) {
    console.error('Error listing buckets:', bucketsError);
    return;
  }

  const sessionMediaBucket = buckets?.find(b => b.id === 'session-media');
  if (sessionMediaBucket) {
    console.log('✅ session-media bucket exists');
    console.log('   Public:', sessionMediaBucket.public);
    console.log('   File size limit:', sessionMediaBucket.file_size_limit);
  } else {
    console.log('❌ session-media bucket NOT found');
    console.log('Available buckets:', buckets?.map(b => b.id).join(', '));
  }

  // 2. Check session_media table
  console.log('\n2. Checking session_media table...');
  const { data: photos, error: photosError } = await supabase
    .from('session_media')
    .select('*')
    .eq('session_id', '2a0838d1-a108-4ec1-8b94-a35ed5ffb282')
    .limit(5);

  if (photosError) {
    console.error('❌ Error querying session_media:', photosError.message);
  } else {
    console.log(`✅ session_media table accessible`);
    console.log(`   Found ${photos?.length || 0} photos for test session`);
    if (photos && photos.length > 0) {
      console.log('   Latest photo:', {
        id: photos[0].id,
        created_at: photos[0].created_at,
        file_size: photos[0].file_size
      });
    }
  }

  // 3. Check storage_usage table
  console.log('\n3. Checking storage_usage table...');
  const { data: usage, error: usageError } = await supabase
    .from('storage_usage')
    .select('*')
    .limit(1);

  if (usageError) {
    console.error('❌ Error querying storage_usage:', usageError.message);
  } else {
    console.log('✅ storage_usage table accessible');
  }
}

testPhotoUpload().catch(console.error);
