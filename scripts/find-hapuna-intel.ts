import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vawdnbbgawichorsjiwe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY2ODQ0NCwiZXhwIjoyMDYyMjQ0NDQ0fQ.4rctfUxZrDgoc2Zu2Lzx1dxKKBwSRkYOxwc0wfGlPtM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Searching for Hapuna Beach intel posts...\n');

  // Find intel with "Hapuna" in title
  const { data: hapunaIntel, error } = await supabase
    .from('intel_posts')
    .select(`
      id,
      title,
      description,
      beach_id,
      created_at,
      beaches!inner (
        id,
        name,
        city,
        state
      )
    `)
    .ilike('title', '%Hapuna%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!hapunaIntel || hapunaIntel.length === 0) {
    console.log('✅ No intel posts found with "Hapuna" in the title');
  } else {
    console.log(`Found ${hapunaIntel.length} intel posts mentioning "Hapuna":\n`);
    hapunaIntel.forEach((post, index) => {
      const beach = post.beaches as any;
      const createdDate = new Date(post.created_at);
      const hoursAgo = Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60));

      console.log(`${index + 1}. Intel Post:`);
      console.log(`   ID: ${post.id}`);
      console.log(`   Title: "${post.title}"`);
      console.log(`   Description: "${post.description?.substring(0, 100)}..."`);
      console.log(`   🔴 Beach ID: ${post.beach_id}`);
      console.log(`   ✅ Associated Beach: ${beach.name} (${beach.city}, ${beach.state})`);
      console.log(`   ⏰ Created: ${createdDate.toLocaleString()} (${hoursAgo}h ago)`);
      console.log('');
    });
  }

  // Check what beach ID 65d177de-e75a-4ad8-aa0d-48a67c0851b0 is (from URL)
  console.log('\n🏖️  Checking beach from URL (65d177de-e75a-4ad8-aa0d-48a67c0851b0)...\n');

  const { data: beachData } = await supabase
    .from('beaches')
    .select('*')
    .eq('id', '65d177de-e75a-4ad8-aa0d-48a67c0851b0')
    .single();

  if (beachData) {
    console.log(`Beach Name: ${beachData.name}`);
    console.log(`City: ${beachData.city}, ${beachData.state}`);
    console.log(`Coordinates: ${beachData.lat}, ${beachData.lon}`);
  } else {
    console.log('❌ Beach not found');
  }

  // Check Oceanside Harbor Beach ID
  console.log('\n🏖️  Checking Oceanside Harbor Beach...\n');

  const { data: oceansideData } = await supabase
    .from('beaches')
    .select('*')
    .eq('name', 'Oceanside Harbor')
    .single();

  if (oceansideData) {
    console.log(`ID: ${oceansideData.id}`);
    console.log(`City: ${oceansideData.city}, ${oceansideData.state}`);
  }
}

main();