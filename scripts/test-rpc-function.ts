#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vawdnbbgawichorsjiwe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY2ODQ0NCwiZXhwIjoyMDYyMjQ0NDQ0fQ.4rctfUxZrDgoc2Zu2Lzx1dxKKBwSRkYOxwc0wfGlPtM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRPCFunction() {
  console.log('🧪 Testing get_nearby_intel_posts RPC function\n');
  console.log('Test Case: Ocean Beach Pier (San Diego)');
  console.log('Coordinates: 32.75, -117.2525');
  console.log('Radius: 5 miles\n');

  // Test Ocean Beach Pier coordinates
  const { data, error } = await supabase.rpc('get_nearby_intel_posts', {
    center_lat: 32.75,
    center_lng: -117.2525,
    radius_miles: 5,
    tag_filter: null,
    limit_count: 10
  });

  if (error) {
    console.error('❌ RPC Function Failed!');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
    return false;
  }

  console.log(`✅ RPC Function Works!`);
  console.log(`\nReturned ${data?.length || 0} intel posts:\n`);

  data?.slice(0, 5).forEach((post: any, index: number) => {
    console.log(`${index + 1}. ${post.title}`);
    console.log(`   Beach: ${post.beach_name || 'N/A'}`);
    console.log(`   Distance: ${post.distance_miles ? post.distance_miles.toFixed(2) + ' miles' : 'N/A'}`);
    console.log(`   Created: ${new Date(post.created_at).toLocaleString()}`);
    console.log('');
  });

  // Check if Hapuna Beach appears (it shouldn't!)
  const hapunaPost = data?.find((p: any) => p.title?.includes('Hapuna'));
  if (hapunaPost) {
    console.log('🚨 WARNING: Found Hapuna Beach post (should not be within 5 miles of San Diego!)');
    console.log(`   Distance from Ocean Beach Pier: ${hapunaPost.distance_miles?.toFixed(2)} miles`);
  } else {
    console.log('✅ No Hapuna Beach posts found (correct!)');
  }

  return true;
}

async function main() {
  const success = await testRPCFunction();
  process.exit(success ? 0 : 1);
}

main();
