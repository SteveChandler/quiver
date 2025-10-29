/**
 * Beach Characteristics Extraction Script
 *
 * Extracts structured surf spot data from surf-spot-database-raw.md using Claude API
 * Generates SQL migration to populate beach preference fields
 *
 * Usage:
 *   ANTHROPIC_API_KEY=your_key npx tsx scripts/extract-surf-characteristics.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface SpotCharacteristics {
  name: string;
  swellWindowMin: number;
  swellWindowMax: number;
  swellWindowCenter: number;
  swellWindowHalfwidth: number;
  windOffshoreDeg: number;
  windOffshoreToleranceDeg: number;
  tideMin: number;
  tideMax: number;
  breakType: string;
  skillLevel: string;
  hazards: string[];
  crowdLevel: number;
  features: string[];
  warnings: string[];
  aspectDeg: number;
  qualityRating: number;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Parse the raw markdown file into individual spot descriptions
 */
function parseSpotDescriptions(rawText: string): Array<{name: string, description: string}> {
  const spots: Array<{name: string, description: string}> = [];

  // Split by bold spot names (e.g., **Lower Trestles**)
  const lines = rawText.split('\n');
  let currentSpot: {name: string, description: string} | null = null;

  for (const line of lines) {
    // Check if this is a spot name (bold text at start of paragraph)
    const spotMatch = line.match(/^\*\*([^*]+)\*\*/);

    if (spotMatch) {
      // Save previous spot if exists
      if (currentSpot) {
        spots.push(currentSpot);
      }

      // Start new spot
      currentSpot = {
        name: spotMatch[1].trim(),
        description: line
      };
    } else if (currentSpot && line.trim()) {
      // Continue current spot description
      currentSpot.description += '\n' + line;
    }
  }

  // Don't forget the last spot
  if (currentSpot) {
    spots.push(currentSpot);
  }

  return spots;
}

/**
 * Extract structured data from a spot description using Claude API
 */
async function extractSpotData(
  spotName: string,
  spotDescription: string
): Promise<SpotCharacteristics | null> {

  const prompt = `Extract structured surf spot characteristics from this description. Return ONLY valid JSON, no explanatory text.

${spotDescription}

Required JSON format (all fields required, use null if not mentioned):
{
  "name": "exact spot name",
  "swellWindowMin": number (0-360 degrees, start of optimal swell range),
  "swellWindowMax": number (0-360 degrees, end of optimal swell range),
  "swellWindowCenter": number (0-360 degrees, center of swell window),
  "swellWindowHalfwidth": number (degrees from center to edge),
  "windOffshoreDeg": number (0-360 degrees, optimal offshore wind direction),
  "windOffshoreToleranceDeg": number (default 30 if not specified),
  "tideMin": number (feet, minimum optimal tide),
  "tideMax": number (feet, maximum optimal tide),
  "breakType": "beach break" | "reef break" | "point break" | "jetty" | "mix",
  "skillLevel": "beginner" | "intermediate" | "advanced" | "expert",
  "hazards": ["array", "of", "hazards"],
  "crowdLevel": number (1-10 scale),
  "features": ["array", "of", "positive", "features"],
  "warnings": ["array", "of", "warnings"],
  "aspectDeg": number (0-360, coastline orientation if mentioned),
  "qualityRating": number (1-10, overall quality rating)
}

Examples of extracting swell windows:
- "receives south to southwest swells (180-250°, center 215°)" → min:180, max:250, center:215, halfwidth:35
- "west to northwest swells (240-315°, center 280°)" → min:240, max:315, center:280, halfwidth:37.5
- "massive swell window (170-280°)" → min:170, max:280, center:225, halfwidth:55

Examples of wind:
- "offshore winds from 67° ENE" → windOffshoreDeg:67
- "East offshore winds (90°)" → windOffshoreDeg:90
- "Northeast offshore winds (45°)" → windOffshoreDeg:45

Examples of tide:
- "2-5 feet tide" → tideMin:2, tideMax:5
- "Low to mid tide (1.5-4 feet)" → tideMin:1.5, tideMax:4
- "Works all tides" → tideMin:0, tideMax:6

Extract skill level from descriptions like "Expert only", "Beginner-friendly", "Advanced surfers domain", etc.

Extract crowd level from descriptions like "extremely crowded (10/10)", "moderate crowds (6/10)", etc.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Extract JSON from the response (handle if Claude adds any text around it)
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`No JSON found in response for ${spotName}`);
        return null;
      }

      const data = JSON.parse(jsonMatch[0]);
      return data as SpotCharacteristics;
    }

    throw new Error('Unexpected response format');
  } catch (error) {
    console.error(`Error extracting data for ${spotName}:`, error);
    return null;
  }
}

/**
 * Generate SQL UPDATE statement for a beach
 */
function generateUpdateSQL(data: SpotCharacteristics, beachId?: string): string {
  const escapeSingleQuotes = (str: string) => str.replace(/'/g, "''");
  const arrayToSQL = (arr: string[]) => `ARRAY[${arr.map(s => `'${escapeSingleQuotes(s)}'`).join(', ')}]`;

  return `
-- Update ${data.name}
UPDATE beaches SET
  swell_window_center_deg = ${data.swellWindowCenter},
  swell_window_halfwidth_deg = ${data.swellWindowHalfwidth},
  offshore_deg = ${data.windOffshoreDeg},
  wind_offshore_tol_deg = ${data.windOffshoreToleranceDeg},
  tide_min_ft = ${data.tideMin},
  tide_max_ft = ${data.tideMax},
  break_type = '${escapeSingleQuotes(data.breakType)}',
  skill_level = '${escapeSingleQuotes(data.skillLevel)}',
  hazards = ${arrayToSQL(data.hazards)},
  features = ${arrayToSQL(data.features)},
  warnings = ${arrayToSQL(data.warnings)},
  aspect_deg = ${data.aspectDeg || 'NULL'}
WHERE name ILIKE '${escapeSingleQuotes(data.name)}';
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('🏄 Beach Characteristics Extraction Started\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Usage: ANTHROPIC_API_KEY=your_key npx tsx scripts/extract-surf-characteristics.ts');
    process.exit(1);
  }

  // Read the raw database file
  const rawFilePath = join(__dirname, 'surf-spot-database-raw.md');
  console.log(`📖 Reading ${rawFilePath}...`);
  const rawText = readFileSync(rawFilePath, 'utf-8');

  // Parse into individual spots
  const spots = parseSpotDescriptions(rawText);
  console.log(`✅ Found ${spots.length} surf spots\n`);

  // Extract data for each spot
  const extractedData: SpotCharacteristics[] = [];
  const failed: string[] = [];

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    console.log(`[${i + 1}/${spots.length}] Extracting: ${spot.name}...`);

    const data = await extractSpotData(spot.name, spot.description);

    if (data) {
      extractedData.push(data);
      console.log(`  ✓ Success`);
    } else {
      failed.push(spot.name);
      console.log(`  ✗ Failed`);
    }

    // Rate limit: Wait 1 second between API calls to be respectful
    if (i < spots.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📊 Extraction Complete:`);
  console.log(`   Successful: ${extractedData.length}`);
  console.log(`   Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`   Failed spots: ${failed.join(', ')}`);
  }

  // Generate SQL migration
  console.log('\n📝 Generating SQL migration...');

  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const migrationContent = `-- Populate beach characteristics from surf spot database
-- Auto-generated by extract-surf-characteristics.ts
-- Date: ${new Date().toISOString()}
-- Spots extracted: ${extractedData.length}

${extractedData.map(data => generateUpdateSQL(data)).join('\n')}

-- Verification query
SELECT
  name,
  swell_window_center_deg,
  swell_window_halfwidth_deg,
  offshore_deg,
  tide_min_ft,
  tide_max_ft,
  break_type,
  skill_level
FROM beaches
WHERE swell_window_center_deg IS NOT NULL
ORDER BY name;
`;

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', `${timestamp}_populate_beach_characteristics.sql`);
  writeFileSync(migrationPath, migrationContent, 'utf-8');
  console.log(`✅ Migration written to: ${migrationPath}`);

  // Also save extracted data as JSON for reference
  const jsonPath = join(__dirname, 'extracted-beach-data.json');
  writeFileSync(jsonPath, JSON.stringify(extractedData, null, 2), 'utf-8');
  console.log(`✅ JSON data written to: ${jsonPath}`);

  // Summary statistics
  console.log('\n📈 Summary Statistics:');
  const skillLevels = extractedData.reduce((acc, d) => {
    acc[d.skillLevel] = (acc[d.skillLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const breakTypes = extractedData.reduce((acc, d) => {
    acc[d.breakType] = (acc[d.breakType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n  Skill Levels:');
  Object.entries(skillLevels).forEach(([skill, count]) => {
    console.log(`    ${skill}: ${count}`);
  });

  console.log('\n  Break Types:');
  Object.entries(breakTypes).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  const avgQuality = extractedData.reduce((sum, d) => sum + d.qualityRating, 0) / extractedData.length;
  const avgCrowd = extractedData.reduce((sum, d) => sum + d.crowdLevel, 0) / extractedData.length;

  console.log(`\n  Average Quality Rating: ${avgQuality.toFixed(1)}/10`);
  console.log(`  Average Crowd Level: ${avgCrowd.toFixed(1)}/10`);

  console.log('\n✨ Done! Next steps:');
  console.log('  1. Review the generated migration file');
  console.log('  2. Validate data in extracted-beach-data.json');
  console.log('  3. Run: npx supabase db push (local) or deploy to production');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
