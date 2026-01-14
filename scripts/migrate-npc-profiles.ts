#!/usr/bin/env node

/**
 * NPC Profile Migration Script
 *
 * Usage:
 *   CONFIRM_TARGET=DEV npx ts-node scripts/migrate-npc-profiles.ts
 *   CONFIRM_TARGET=PROD CONFIRM_PROD=YES npx ts-node scripts/migrate-npc-profiles.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { NPC_ROSTER, POSTING_WINDOWS } from '../config/npc-roster';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🎭 Starting NPC Profile Migration\n');

  const target = process.env.CONFIRM_TARGET;
  if (target !== 'DEV' && target !== 'PROD') {
    console.error('Set CONFIRM_TARGET=DEV or CONFIRM_TARGET=PROD');
    process.exit(1);
  }

  if (target === 'PROD' && process.env.CONFIRM_PROD !== 'YES') {
    console.error('For production, set CONFIRM_PROD=YES');
    process.exit(1);
  }

  console.log('Target:', target);
  console.log('Supabase URL:', supabaseUrl.substring(0, 30) + '...\n');

  const { data: existingProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_mock', true);

  if (fetchError) {
    console.error('Error fetching profiles:', fetchError.message);
    process.exit(1);
  }

  console.log('Found ' + (existingProfiles?.length || 0) + ' existing NPCs\n');

  let updated = 0;
  let created = 0;

  for (const profile of NPC_ROSTER) {
    const existing = existingProfiles?.find(p => {
      if (!profile.oldName) return false;
      const searchTerm = profile.oldName.split(' ')[0].toLowerCase();
      return p.full_name?.toLowerCase().includes(searchTerm);
    });

    const postingWindow = POSTING_WINDOWS[profile.personality];

    if (existing) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.name,
          personality_type: profile.personality,
          home_region: profile.homeRegion,
          activity_level: profile.activityLevel,
          posting_window: postingWindow,
          is_system_account: profile.personality === 'forecaster'
        })
        .eq('id', existing.id);

      if (!error) {
        console.log('✅ Updated ' + existing.full_name + ' → ' + profile.name);
        updated++;
      } else {
        console.error('❌ Failed to update ' + existing.full_name + ': ' + error.message);
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert({
          full_name: profile.name,
          personality_type: profile.personality,
          home_region: profile.homeRegion,
          activity_level: profile.activityLevel,
          posting_window: postingWindow,
          is_mock: true,
          is_system_account: profile.personality === 'forecaster'
        });

      if (!error) {
        console.log('✨ Created ' + profile.name);
        created++;
      } else {
        console.error('❌ Failed to create ' + profile.name + ': ' + error.message);
      }
    }
  }

  console.log('\n📊 Summary: ' + updated + ' updated, ' + created + ' created');
}

main().catch(console.error);
