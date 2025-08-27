#!/usr/bin/env tsx
/**
 * Verify NPC content in production
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vawdnbbgawichorsjiwe.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2RuYmJnYXdpY2hvcnNqaXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjY2ODQ0NCwiZXhwIjoyMDYyMjQ0NDQ0fQ.4rctfUxZrDgoc2Zu2Lzx1dxKKBwSRkYOxwc0wfGlPtM';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyContent() {
  console.log('🔍 Verifying NPC Content in Production\n');
  console.log('='.repeat(50));

  // 1. Count mock users
  const { count: mockUserCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_mock', true);
  
  console.log(`\n📊 Mock Users: ${mockUserCount}`);

  // 2. Count and sample beach reviews from NPCs
  const { data: reviewStats, error: reviewError } = await supabase
    .from('beach_reviews')
    .select('id, title, overall_rating, user_id!inner(is_mock)', { count: 'exact' })
    .eq('user_id.is_mock', true);

  if (!reviewError) {
    console.log(`\n📝 Beach Reviews by NPCs: ${reviewStats?.length || 0}`);
    
    // Sample reviews
    const { data: sampleReviews } = await supabase
      .from('beach_reviews')
      .select('title, overall_rating, beach_id!inner(name), user_id!inner(full_name)')
      .eq('user_id.is_mock', true)
      .limit(3);
    
    if (sampleReviews?.length) {
      console.log('\n  Sample Reviews:');
      sampleReviews.forEach((review: any) => {
        console.log(`  - "${review.title}" (${review.overall_rating}⭐) at ${review.beach_id.name} by ${review.user_id.full_name}`);
      });
    }
  }

  // 3. Count and sample intel posts from NPCs
  const { data: intelStats, error: intelError } = await supabase
    .from('intel_posts')
    .select('id, title, tag, user_id!inner(is_mock)', { count: 'exact' })
    .eq('user_id.is_mock', true);

  if (!intelError) {
    console.log(`\n📍 Intel Posts by NPCs: ${intelStats?.length || 0}`);
    
    // Tag distribution
    const tagCounts: Record<string, number> = {};
    intelStats?.forEach((post: any) => {
      tagCounts[post.tag] = (tagCounts[post.tag] || 0) + 1;
    });
    
    console.log('\n  Tag Distribution:');
    Object.entries(tagCounts).forEach(([tag, count]) => {
      console.log(`  - ${tag}: ${count} posts`);
    });
    
    // Sample posts
    const { data: samplePosts } = await supabase
      .from('intel_posts')
      .select('title, tag, beach_id!inner(name), user_id!inner(full_name)')
      .eq('user_id.is_mock', true)
      .limit(3);
    
    if (samplePosts?.length) {
      console.log('\n  Sample Intel Posts:');
      samplePosts.forEach((post: any) => {
        console.log(`  - [${post.tag}] "${post.title}" at ${post.beach_id?.name || 'N/A'} by ${post.user_id.full_name}`);
      });
    }
  }

  // 4. Most active NPCs
  const { data: npcActivity } = await supabase.rpc('get_npc_activity_stats');
  
  if (npcActivity?.length) {
    console.log('\n🏆 Most Active NPCs:');
    npcActivity.slice(0, 5).forEach((npc: any) => {
      console.log(`  - ${npc.full_name}: ${npc.review_count} reviews, ${npc.intel_count} intel posts`);
    });
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Verification Complete!\n');
}

// Create the RPC function if needed
async function createRPCFunction() {
  const rpcSQL = `
    CREATE OR REPLACE FUNCTION get_npc_activity_stats()
    RETURNS TABLE(
      full_name text,
      review_count bigint,
      intel_count bigint
    )
    LANGUAGE sql
    AS $$
      SELECT 
        p.full_name,
        COUNT(DISTINCT br.id) as review_count,
        COUNT(DISTINCT ip.id) as intel_count
      FROM profiles p
      LEFT JOIN beach_reviews br ON p.id = br.user_id
      LEFT JOIN intel_posts ip ON p.id = ip.user_id
      WHERE p.is_mock = true
      GROUP BY p.id, p.full_name
      ORDER BY (COUNT(DISTINCT br.id) + COUNT(DISTINCT ip.id)) DESC;
    $$;
  `;
  
  // Note: This would need to be run via SQL editor in Supabase dashboard
  console.log('Note: To get detailed stats, run this SQL in your Supabase dashboard:');
  console.log(rpcSQL);
}

verifyContent().catch(console.error);