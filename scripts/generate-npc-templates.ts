#!/usr/bin/env node
/**
 * NPC Content Templates Generation Script
 *
 * Generates templated content for NPC intel posts, session notes, and reviews.
 * Templates use mustache-style variables ({{variable}}) that are hydrated with
 * real forecast data at post time.
 *
 * Usage: npx tsx scripts/generate-npc-templates.ts [--dry-run]
 *
 * REQUIREMENTS:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 * - NEXT_PUBLIC_SUPABASE_URL environment variable must be set
 * - npc_content_templates table must exist (run migration first)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isDryRun = process.argv.includes('--dry-run');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Available template variables
const AVAILABLE_VARIABLES = [
  'beach_name',
  'wave_range',
  'wave_period',
  'wind_description',
  'tide_state',
  'water_temp',
  'time_of_day',
  'crowd_sentence',
  'personality_closer',
];

type PersonalityType = 'rookie' | 'local' | 'traveler' | 'photographer' | 'tactical' | 'competitor';
type ContentType = 'intel' | 'session_note' | 'review';
type Tag = 'conditions' | 'parking' | 'crowd' | 'access' | null;

interface TemplateDefinition {
  template: string;
  tag?: Tag;
}

// Template definitions by personality and content type
const TEMPLATES: Record<PersonalityType, Record<ContentType, TemplateDefinition[]>> = {
  local: {
    intel: [
      { template: '{{beach_name}} looking {{wave_range}} this {{time_of_day}}. {{wind_description}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: '{{wave_range}} at {{beach_name}} with {{wave_period}}. {{tide_state}}—typical for this time of year.', tag: 'conditions' },
      { template: 'Quick {{time_of_day}} check at {{beach_name}}: {{wave_range}}, {{wind_description}}. {{personality_closer}}', tag: 'conditions' },
      { template: '{{beach_name}} update: {{wave_range}} faces, {{wave_period}}. {{water_temp}} {{crowd_sentence}}', tag: 'conditions' },
      { template: 'Just did a drive-by of {{beach_name}}. {{wave_range}} with {{wind_description}}. Tide is {{tide_state}}.', tag: 'conditions' },
      { template: 'Same as yesterday at {{beach_name}}—{{wave_range}}, {{wind_description}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: '{{time_of_day}} report from {{beach_name}}: {{wave_range}} and {{wave_period}}. {{personality_closer}}', tag: 'conditions' },
      { template: 'Classic {{beach_name}} this {{time_of_day}}. {{wave_range}} runners, {{wind_description}}. Worth a session.', tag: 'conditions' },
      { template: '{{beach_name}} regulars know: {{wave_range}} with {{wave_period}} = time to paddle out. {{tide_state}}.', tag: 'conditions' },
      { template: 'Been surfing {{beach_name}} for years. Today: {{wave_range}}, {{wind_description}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: 'Lot is about half full at {{beach_name}}. Easy parking if you get here in the next hour.', tag: 'parking' },
      { template: '{{beach_name}} parking: street spots available. Lot is full but turnover is quick.', tag: 'parking' },
      { template: 'Locals tip: park on the side street at {{beach_name}}. Main lot is packed.', tag: 'parking' },
      { template: '{{crowd_sentence}} {{beach_name}} spreading out the pack today.', tag: 'crowd' },
      { template: '{{beach_name}} crowd is chill this {{time_of_day}}. {{crowd_sentence}}', tag: 'crowd' },
      { template: 'Regulars out at {{beach_name}}. Vibe is mellow, everyone getting waves.', tag: 'crowd' },
    ],
    session_note: [
      { template: '{{time_of_day}} session at {{beach_name}}. {{wave_range}} with {{wave_period}}. {{crowd_sentence}} {{personality_closer}}' },
      { template: 'Got my waves at {{beach_name}} this {{time_of_day}}. {{wave_range}}, {{wind_description}}. {{water_temp}}' },
      { template: 'Solid {{time_of_day}} at {{beach_name}}. {{wave_range}} faces, {{tide_state}}. {{personality_closer}}' },
      { template: 'Another one for the books at {{beach_name}}. {{wave_range}}, {{wave_period}}. {{crowd_sentence}}' },
      { template: '{{beach_name}} delivered this {{time_of_day}}. {{wave_range}}, {{wind_description}}. {{personality_closer}}' },
    ],
    review: [
      { template: '{{beach_name}} is consistent and reliable. {{wave_range}} days are common. {{crowd_sentence}} Know the locals, respect the lineup.' },
      { template: 'Been surfing {{beach_name}} for years. When it\'s {{wave_range}}, you can\'t beat it. {{water_temp}} Parking can be tricky.' },
      { template: '{{beach_name}} review: Great local spot. {{wave_period}} swells work best. {{crowd_sentence}} Respect goes a long way here.' },
    ],
  },
  rookie: {
    intel: [
      { template: '{{beach_name}} today! {{wave_range}} and looks manageable. {{wind_description}}. Still learning but stoked!', tag: 'conditions' },
      { template: 'Checking out {{beach_name}} this {{time_of_day}}. {{wave_range}}—hoping I can handle it! {{crowd_sentence}}', tag: 'conditions' },
      { template: 'First time at {{beach_name}}! {{wave_range}}, {{wind_description}}. {{water_temp}} Wish me luck!', tag: 'conditions' },
      { template: '{{beach_name}} conditions: {{wave_range}}, {{tide_state}}. Looks fun for a beginner like me!', tag: 'conditions' },
      { template: 'Anyone at {{beach_name}} today? {{wave_range}} and I\'m thinking about paddling out. {{crowd_sentence}}', tag: 'conditions' },
      { template: 'Learning so much at {{beach_name}}! {{wave_range}} this {{time_of_day}}. {{personality_closer}}', tag: 'conditions' },
      { template: '{{beach_name}} report from a kook: {{wave_range}}, {{wind_description}}. Going for it!', tag: 'conditions' },
      { template: 'Is {{wave_range}} too big for a beginner at {{beach_name}}? {{crowd_sentence}} Going to give it a shot!', tag: 'conditions' },
      { template: 'Found parking easily at {{beach_name}}! Lot wasn\'t too bad.', tag: 'parking' },
      { template: 'Heads up: {{beach_name}} lot is full. Had to park down the street.', tag: 'parking' },
      { template: '{{crowd_sentence}} Hope the experienced surfers don\'t mind me practicing at {{beach_name}}.', tag: 'crowd' },
      { template: 'Everyone at {{beach_name}} is so nice! {{crowd_sentence}} Love this community.', tag: 'crowd' },
    ],
    session_note: [
      { template: 'Just had my best session yet at {{beach_name}}! {{wave_range}}, {{wind_description}}. {{personality_closer}}' },
      { template: '{{time_of_day}} practice at {{beach_name}}. {{wave_range}} was perfect for learning. {{crowd_sentence}}' },
      { template: 'Caught 3 waves at {{beach_name}} today! {{wave_range}}, {{tide_state}}. Progress! {{personality_closer}}' },
      { template: 'Still working on my popup at {{beach_name}}. {{wave_range}} was challenging but fun. {{water_temp}}' },
      { template: '{{beach_name}} session was humbling. {{wave_range}} kicked my butt but I\'m hooked. {{personality_closer}}' },
    ],
    review: [
      { template: '{{beach_name}} is perfect for beginners! {{wave_range}} days are manageable. {{crowd_sentence}} Everyone was super friendly and patient.' },
      { template: 'Love learning at {{beach_name}}. {{wave_period}} swells are approachable. {{water_temp}} Definitely coming back!' },
      { template: 'Beginner review of {{beach_name}}: Great spot to learn. {{crowd_sentence}} Bring a thick wetsuit. {{personality_closer}}' },
    ],
  },
  traveler: {
    intel: [
      { template: 'Stopped by {{beach_name}} on my trip. {{wave_range}}, {{wind_description}}. Different from my home break!', tag: 'conditions' },
      { template: '{{beach_name}} check-in: {{wave_range}} with {{wave_period}}. {{water_temp}} Adding this to my list!', tag: 'conditions' },
      { template: 'Traveling through and found {{beach_name}}. {{wave_range}} this {{time_of_day}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: 'Road trip stop at {{beach_name}}. {{wave_range}}, {{wind_description}}. {{tide_state}}. {{personality_closer}}', tag: 'conditions' },
      { template: '{{beach_name}} from a visitor\'s perspective: {{wave_range}}, {{wave_period}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: 'First time surfing {{beach_name}}. {{wave_range}} and {{wind_description}}. {{water_temp}}', tag: 'conditions' },
      { template: 'Passing through and had to check {{beach_name}}. {{wave_range}}, {{tide_state}}. Worth the detour!', tag: 'conditions' },
      { template: '{{beach_name}} visitor report: {{wave_range}}, {{wind_description}}. {{personality_closer}}', tag: 'conditions' },
      { template: 'Parking tip for travelers at {{beach_name}}: arrive early. Lot fills up fast.', tag: 'parking' },
      { template: 'Found free street parking near {{beach_name}}. Took some searching.', tag: 'parking' },
      { template: '{{crowd_sentence}} The locals at {{beach_name}} were welcoming.', tag: 'crowd' },
      { template: 'Respectful crowd at {{beach_name}}. {{crowd_sentence}} Love the vibe here.', tag: 'crowd' },
    ],
    session_note: [
      { template: 'Travel session at {{beach_name}}! {{wave_range}}, {{wave_period}}. {{water_temp}} {{personality_closer}}' },
      { template: 'Adding {{beach_name}} to my favorite breaks. {{wave_range}} this {{time_of_day}}. {{crowd_sentence}}' },
      { template: '{{time_of_day}} surf at {{beach_name}}. {{wave_range}}, {{wind_description}}. Different energy than home.', tag: null },
      { template: 'Rented a board and hit {{beach_name}}. {{wave_range}}, {{tide_state}}. {{personality_closer}}' },
      { template: '{{beach_name}} session from a traveler. {{wave_range}} faces, {{wave_period}}. Will be back!' },
    ],
    review: [
      { template: '{{beach_name}} travel review: Worth the trip! {{wave_range}} days are common. {{crowd_sentence}} Bring cash for parking.' },
      { template: 'Visited {{beach_name}} on vacation. {{wave_period}} swells are fun. {{water_temp}} Friendly locals. {{personality_closer}}' },
      { template: 'Tourist take on {{beach_name}}: Great waves, {{crowd_sentence}} Easy access, rental shops nearby.' },
    ],
  },
  photographer: {
    intel: [
      { template: '{{beach_name}} is photogenic today. {{wave_range}}, {{wind_description}}. Golden hour light is incredible.', tag: 'conditions' },
      { template: 'Shooting at {{beach_name}} this {{time_of_day}}. {{wave_range}} with clean lines. {{personality_closer}}', tag: 'conditions' },
      { template: '{{beach_name}} visual report: {{wave_range}}, {{wave_period}}. Light conditions are perfect for captures.', tag: 'conditions' },
      { template: 'The texture on the waves at {{beach_name}} today—{{wave_range}}, {{wind_description}}. Beautiful chaos.', tag: 'conditions' },
      { template: 'Camera in hand at {{beach_name}}. {{wave_range}}, {{tide_state}}. The colors are stunning.', tag: 'conditions' },
      { template: '{{beach_name}} framing nicely. {{wave_range}} with {{wave_period}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: 'Light at {{beach_name}} this {{time_of_day}} is chef\'s kiss. {{wave_range}}, clean faces.', tag: 'conditions' },
      { template: '{{beach_name}} conditions for photos: {{wave_range}}, {{wind_description}}. {{personality_closer}}', tag: 'conditions' },
      { template: 'Beach access at {{beach_name}} is good for getting angles. Easy to move around.', tag: 'access' },
      { template: 'Pro tip: the cliff at {{beach_name}} gives great vantage points for shooting.', tag: 'access' },
    ],
    session_note: [
      { template: 'Shot the {{time_of_day}} session at {{beach_name}}. {{wave_range}}, amazing light. {{personality_closer}}' },
      { template: '{{beach_name}} through the lens: {{wave_range}}, {{wave_period}}. Got some keepers today.' },
      { template: 'Visual conditions at {{beach_name}} were unreal. {{wave_range}}, {{wind_description}}. {{personality_closer}}' },
      { template: 'Captured {{beach_name}} at its best. {{wave_range}} faces, {{tide_state}}. The light was painting everything.' },
      { template: '{{time_of_day}} light at {{beach_name}} with {{wave_range}}. Frame after frame of gold.' },
    ],
    review: [
      { template: '{{beach_name}} photography review: Incredible backdrops. {{wave_range}} days photograph beautifully. {{personality_closer}}' },
      { template: 'As a photographer, {{beach_name}} is a dream. {{wave_period}} swells create clean lines. {{crowd_sentence}}' },
      { template: 'Visual review of {{beach_name}}: The setting is stunning. {{water_temp}} Golden hour is magic here.' },
    ],
  },
  tactical: {
    intel: [
      { template: '{{beach_name}} recon: {{wave_range}}, {{wind_description}}. {{tide_state}}. Conditions within parameters.', tag: 'conditions' },
      { template: 'Mission brief for {{beach_name}}: {{wave_range}}, {{wave_period}}. {{crowd_sentence}} Execute accordingly.', tag: 'conditions' },
      { template: '{{beach_name}} SITREP: {{wave_range}} faces, {{wind_description}}. {{water_temp}} Operational.', tag: 'conditions' },
      { template: 'Tactical assessment of {{beach_name}}: {{wave_range}}, {{tide_state}}. Window is optimal.', tag: 'conditions' },
      { template: '{{beach_name}} conditions logged: {{wave_range}}, {{wave_period}}. {{personality_closer}}', tag: 'conditions' },
      { template: 'Pre-session intel for {{beach_name}}: {{wave_range}}, {{wind_description}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: '{{beach_name}} status: {{wave_range}}, {{tide_state}}. Proceed with mission. {{personality_closer}}', tag: 'conditions' },
      { template: 'Reconnaissance complete at {{beach_name}}. {{wave_range}}, {{wave_period}}. All systems go.', tag: 'conditions' },
      { template: 'Parking recon at {{beach_name}}: Main lot at 60% capacity. Secondary options available.', tag: 'parking' },
      { template: '{{beach_name}} access point clear. Minimal obstacles to entry.', tag: 'access' },
      { template: '{{crowd_sentence}} {{beach_name}} lineup manageable for tactical approach.', tag: 'crowd' },
    ],
    session_note: [
      { template: 'Mission complete at {{beach_name}}. {{wave_range}}, {{wave_period}}. {{personality_closer}}' },
      { template: '{{beach_name}} operation successful. {{wave_range}} faces, {{wind_description}}. Logged for reference.' },
      { template: '{{time_of_day}} sortie at {{beach_name}}. {{wave_range}}, {{tide_state}}. Objectives achieved.' },
      { template: '{{beach_name}} session data: {{wave_range}}, {{wave_period}}. {{water_temp}} {{personality_closer}}' },
      { template: 'Completed reconnaissance-in-force at {{beach_name}}. {{wave_range}}, {{wind_description}}.' },
    ],
    review: [
      { template: '{{beach_name}} tactical review: Reliable break. {{wave_range}} swells are consistent. {{crowd_sentence}} Minimal complications.' },
      { template: 'Strategic assessment of {{beach_name}}: {{wave_period}} intervals optimal. {{water_temp}} {{personality_closer}}' },
      { template: '{{beach_name}} operations review: Viable target. {{crowd_sentence}} Access is straightforward. Recommend for future missions.' },
    ],
  },
  competitor: {
    intel: [
      { template: '{{beach_name}} training check: {{wave_range}}, {{wave_period}}. {{wind_description}}. Good for reps.', tag: 'conditions' },
      { template: 'Competition prep at {{beach_name}}: {{wave_range}} faces, {{tide_state}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: '{{beach_name}} performance conditions: {{wave_range}}, {{wind_description}}. {{personality_closer}}', tag: 'conditions' },
      { template: 'Training assessment for {{beach_name}}: {{wave_range}}, {{wave_period}}. Pushing limits today.', tag: 'conditions' },
      { template: '{{beach_name}} contest conditions: {{wave_range}}, {{tide_state}}. {{crowd_sentence}}', tag: 'conditions' },
      { template: 'Heat strategy for {{beach_name}}: {{wave_range}}, {{wind_description}}. Priority position matters.', tag: 'conditions' },
      { template: '{{beach_name}} wave quality: {{wave_range}}, {{wave_period}}. Good for scoring maneuvers.', tag: 'conditions' },
      { template: 'Pre-heat intel from {{beach_name}}: {{wave_range}}, {{wind_description}}. {{personality_closer}}', tag: 'conditions' },
      { template: '{{crowd_sentence}} Competition for waves is fierce at {{beach_name}}.', tag: 'crowd' },
      { template: 'Crowded lineup at {{beach_name}}. {{crowd_sentence}} Priority position key.', tag: 'crowd' },
    ],
    session_note: [
      { template: 'Training session at {{beach_name}} complete. {{wave_range}}, {{wave_period}}. {{personality_closer}}' },
      { template: 'Pushed it hard at {{beach_name}}. {{wave_range}} faces, {{wind_description}}. Good work today.' },
      { template: '{{time_of_day}} drills at {{beach_name}}. {{wave_range}}, {{tide_state}}. Form is improving.' },
      { template: '{{beach_name}} workout: {{wave_range}}, {{wave_period}}. Focused on airs and carves. {{personality_closer}}' },
      { template: 'Competition reps at {{beach_name}}. {{wave_range}}, {{wind_description}}. Ready for the next heat.' },
    ],
    review: [
      { template: '{{beach_name}} competition review: Excellent training ground. {{wave_range}} swells are consistent. {{crowd_sentence}}' },
      { template: 'Athlete perspective on {{beach_name}}: {{wave_period}} allows for full rail work. {{personality_closer}}' },
      { template: '{{beach_name}} performance review: Solid venue. {{crowd_sentence}} {{water_temp}} Recommended for training camps.' },
    ],
  },
};

/**
 * Extract variable names from a template string
 */
function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
}

/**
 * Insert templates into the database
 */
async function insertTemplates(): Promise<{
  inserted: number;
  skipped: number;
  errors: number;
}> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const personalities: PersonalityType[] = ['local', 'rookie', 'traveler', 'photographer', 'tactical', 'competitor'];
  const contentTypes: ContentType[] = ['intel', 'session_note', 'review'];

  for (const personality of personalities) {
    for (const contentType of contentTypes) {
      const templates = TEMPLATES[personality][contentType];

      for (const templateDef of templates) {
        const variables = extractVariables(templateDef.template);

        // Check if template already exists (by exact match)
        const { data: existing } = await supabase
          .from('npc_content_templates')
          .select('id')
          .eq('template', templateDef.template)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`   Skipping duplicate: ${templateDef.template.slice(0, 50)}...`);
          skipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`[DRY RUN] Would insert: ${personality}/${contentType} - ${templateDef.template.slice(0, 50)}...`);
          inserted++;
          continue;
        }

        const { error } = await supabase.from('npc_content_templates').insert({
          content_type: contentType,
          personality,
          tag: templateDef.tag || null,
          template: templateDef.template,
          variables,
          use_count: 0,
          archived: false,
        });

        if (error) {
          console.error(`   Error inserting template: ${error.message}`);
          errors++;
        } else {
          console.log(`   Inserted: ${personality}/${contentType}/${templateDef.tag || 'general'}`);
          inserted++;
        }
      }
    }
  }

  return { inserted, skipped, errors };
}

/**
 * Main execution function
 */
async function main() {
  console.log('NPC Content Templates Generator');
  console.log('================================');
  console.log('');

  if (isDryRun) {
    console.log('Running in DRY RUN mode - no changes will be made');
    console.log('');
  }

  // Validate table exists
  console.log('Validating database schema...');
  const { error: schemaError } = await supabase
    .from('npc_content_templates')
    .select('id')
    .limit(1);

  if (schemaError) {
    console.error('Schema validation failed. Please run the migration first.');
    console.error(`Error: ${schemaError.message}`);
    process.exit(1);
  }
  console.log('Schema validated.');
  console.log('');

  // Count total templates to be inserted
  let totalTemplates = 0;
  for (const personality of Object.keys(TEMPLATES) as PersonalityType[]) {
    for (const contentType of Object.keys(TEMPLATES[personality]) as ContentType[]) {
      totalTemplates += TEMPLATES[personality][contentType].length;
    }
  }
  console.log(`Preparing to insert ${totalTemplates} templates...`);
  console.log('');

  // Insert templates
  const results = await insertTemplates();

  // Summary
  console.log('');
  console.log('Generation Summary');
  console.log('==================');
  console.log(`Inserted: ${results.inserted}`);
  console.log(`Skipped (duplicates): ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);

  if (results.errors === 0) {
    console.log('');
    console.log('All templates generated successfully!');
    if (isDryRun) {
      console.log('');
      console.log('Run without --dry-run to actually insert templates.');
    }
  } else {
    console.log('');
    console.log('Some templates had errors. Please check the logs above.');
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
