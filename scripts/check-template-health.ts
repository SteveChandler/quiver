#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('🔍 NPC Template Health Check\n');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: overused, error: overusedError } = await supabase
    .from('npc_content_templates')
    .select('id, content_type, personality, use_count')
    .gte('use_count', 3)
    .gte('last_used_at', sevenDaysAgo)
    .eq('archived', false);

  if (overusedError) {
    console.error('Error checking overused templates:', overusedError.message);
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('npc_content_templates')
    .select('content_type, personality')
    .eq('archived', false);

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError.message);
  }

  console.log('Overused templates (3+ uses in 7 days): ' + (overused?.length || 0));
  console.log('Total active templates: ' + (categories?.length || 0));

  if (overused && overused.length > 0) {
    console.log('\n⚠️ Stale Template Alerts:');
    overused.forEach(t => {
      console.log('  - ' + t.personality + '/' + t.content_type + ': ' + t.use_count + ' uses');
    });
    console.log('\nConsider generating fresh templates for these categories.');
  } else {
    console.log('\n✅ All templates healthy!');
  }

  // Category coverage check
  const personalities = ['rookie', 'local', 'traveler', 'photographer', 'tactical', 'competitor', 'forecaster'];
  const contentTypes = ['intel', 'session_note', 'review'];
  
  if (categories && categories.length > 0) {
    console.log('\n📊 Category Coverage:');
    for (const personality of personalities) {
      for (const contentType of contentTypes) {
        const count = categories.filter(c => c.personality === personality && c.content_type === contentType).length;
        if (count === 0) {
          console.log('  ⚠️ Missing: ' + personality + '/' + contentType);
        }
      }
    }
  }
}

main().catch(console.error);
