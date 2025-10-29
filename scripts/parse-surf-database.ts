/**
 * Parse Surf Database - Extract beach characteristics using regex
 *
 * Parses surf-spot-database-raw.md to extract structured data
 * NO API CALLS - completely free and instant
 *
 * Usage: npx tsx scripts/parse-surf-database.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

interface ExtractedBeachData {
  name: string;
  swellWindowMin?: number;
  swellWindowMax?: number;
  swellWindowCenter?: number;
  windOffshoreDeg?: number;
  tideMin?: number;
  tideMax?: number;
  breakType?: string;
  skillLevel?: string;
  qualityRating?: number;
  crowdLevel?: number;
  hazards: string[];
  warnings: string[];
}

/**
 * Extract swell window from text like:
 * "receives south to southwest swells (180-250°, center 215°)"
 * "west to northwest swells (240-315°, center 280°)"
 * "massive swell window (170-280°)"
 */
function extractSwellWindow(text: string): { min?: number; max?: number; center?: number } | null {
  // Pattern: (180-250°, center 215°) or (180-250°)
  const pattern = /\((\d+)-(\d+)°(?:,\s*center\s*(\d+)°)?\)/;
  const match = text.match(pattern);

  if (match) {
    const min = parseInt(match[1]);
    const max = parseInt(match[2]);
    const center = match[3] ? parseInt(match[3]) : Math.round((min + max) / 2);
    return { min, max, center };
  }

  return null;
}

/**
 * Extract offshore wind from text like:
 * "offshore winds from 67° ENE"
 * "East offshore winds (90°)"
 * "Northeast offshore winds (45°)"
 */
function extractOffshoreWind(text: string): number | null {
  // Pattern: offshore winds from 67° or offshore winds (90°)
  const patterns = [
    /offshore\s+winds?\s+from\s+(\d+)°/i,
    /offshore\s+winds?\s+\((\d+)°\)/i,
    /(\d+)°\s+\w+\s+offshore/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return null;
}

/**
 * Extract tide range from text like:
 * "2-5 feet tide"
 * "Low to mid tide (1.5-4 feet)"
 * "Mid tide rising (2.5-4.5 feet)"
 */
function extractTideRange(text: string): { min?: number; max?: number } | null {
  // Pattern: Must have "tide" nearby and reasonable values (< 20 feet)
  const pattern = /tide[^.]*?(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\s*feet/i;
  const match = text.match(pattern);

  if (match) {
    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);

    // Validate: tides don't exceed 20 feet in most places
    if (min < 20 && max < 20 && min < max) {
      return { min, max };
    }
  }

  return null;
}

/**
 * Extract break type from text
 */
function extractBreakType(text: string): string | null {
  const types = [
    { pattern: /point\s+break/i, value: 'point break' },
    { pattern: /reef\s+break/i, value: 'reef break' },
    { pattern: /beach\s+break/i, value: 'beach break' },
    { pattern: /jetty/i, value: 'jetty' },
    { pattern: /cobblestone/i, value: 'reef break' },
    { pattern: /sand/i, value: 'beach break' }
  ];

  for (const type of types) {
    if (type.pattern.test(text)) {
      return type.value;
    }
  }

  return null;
}

/**
 * Extract skill level from text
 */
function extractSkillLevel(text: string): string | null {
  if (/expert|advanced\s+to\s+expert|extremely\s+demanding/i.test(text)) {
    return 'expert';
  }
  if (/advanced/i.test(text)) {
    return 'advanced';
  }
  if (/intermediate/i.test(text)) {
    return 'intermediate';
  }
  if (/beginner/i.test(text)) {
    return 'beginner';
  }
  return null;
}

/**
 * Extract quality rating from text like "rated 9/10"
 */
function extractQualityRating(text: string): number | null {
  const match = text.match(/rated\s+(\d+)\/10/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract crowd level from text like "extremely crowded (10/10)" or "moderate crowds (6/10)"
 */
function extractCrowdLevel(text: string): number | null {
  const match = text.match(/crowd[^(]*\((\d+)\/10\)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract hazards from warnings and danger sections
 */
function extractHazards(text: string): string[] {
  const hazards: string[] = [];

  if (/\*\*[^*]*warning[^*]*\*\*/i.test(text) || /danger/i.test(text)) {
    if (/rip\s+current/i.test(text)) hazards.push('rip currents');
    if (/sharks?/i.test(text)) hazards.push('sharks');
    if (/rocks?/i.test(text)) hazards.push('rocks');
    if (/pollution|water\s+quality|toxic/i.test(text)) hazards.push('water quality');
    if (/shallow/i.test(text)) hazards.push('shallow reef');
    if (/localism/i.test(text)) hazards.push('localism');
    if (/crowd/i.test(text) && /aggressive|territorial/i.test(text)) hazards.push('aggressive locals');
  }

  return hazards;
}

/**
 * Parse the markdown file into spot descriptions
 */
function parseSpotDescriptions(rawText: string): Array<{ name: string; text: string }> {
  const spots: Array<{ name: string; text: string }> = [];
  const lines = rawText.split('\n');
  let currentSpot: { name: string; text: string } | null = null;

  for (const line of lines) {
    const spotMatch = line.match(/^\*\*([^*]+)\*\*/);
    if (spotMatch) {
      if (currentSpot) {
        spots.push(currentSpot);
      }
      currentSpot = {
        name: spotMatch[1].trim(),
        text: line
      };
    } else if (currentSpot && line.trim()) {
      currentSpot.text += '\n' + line;
    }
  }

  if (currentSpot) {
    spots.push(currentSpot);
  }

  // Filter out non-spot entries (like headers)
  return spots.filter(s => {
    const firstLine = s.text.split('\n')[0];
    return /break|beach|point|reef|jetty|surf/i.test(firstLine);
  });
}

/**
 * Extract all data from a spot description
 */
function extractSpotData(name: string, text: string): ExtractedBeachData {
  const swell = extractSwellWindow(text);
  const offshore = extractOffshoreWind(text);
  const tide = extractTideRange(text);
  const breakType = extractBreakType(text);
  const skillLevel = extractSkillLevel(text);
  const qualityRating = extractQualityRating(text);
  const crowdLevel = extractCrowdLevel(text);
  const hazards = extractHazards(text);

  const warnings: string[] = [];
  if (/blackball/i.test(text)) warnings.push('Blackballed - check hours');
  if (/parking.*fee/i.test(text)) {
    const feeMatch = text.match(/\$(\d+)/);
    if (feeMatch) warnings.push(`Parking: $${feeMatch[1]}`);
  }

  return {
    name,
    swellWindowMin: swell?.min,
    swellWindowMax: swell?.max,
    swellWindowCenter: swell?.center,
    windOffshoreDeg: offshore,
    tideMin: tide?.min,
    tideMax: tide?.max,
    breakType,
    skillLevel,
    qualityRating,
    crowdLevel,
    hazards,
    warnings
  };
}

/**
 * Generate SQL UPDATE statement
 */
function generateUpdateSQL(data: ExtractedBeachData, beachId?: string): string {
  const escape = (str: string) => str.replace(/'/g, "''");
  const arrayToSQL = (arr: string[]) => arr.length > 0
    ? `ARRAY[${arr.map(s => `'${escape(s)}'`).join(', ')}]`
    : 'ARRAY[]::text[]';

  const updates: string[] = [];

  if (data.swellWindowCenter !== undefined) {
    const halfwidth = data.swellWindowMax && data.swellWindowMin
      ? Math.round((data.swellWindowMax - data.swellWindowMin) / 2)
      : 45;
    updates.push(`swell_window_center_deg = ${data.swellWindowCenter}`);
    updates.push(`swell_window_halfwidth_deg = ${halfwidth}`);
  }

  if (data.windOffshoreDeg !== undefined) {
    updates.push(`wind_offshore_deg = ${data.windOffshoreDeg}`);
  }

  if (data.tideMin !== undefined) updates.push(`preferred_tide_ft_min = ${data.tideMin}`);
  if (data.tideMax !== undefined) updates.push(`preferred_tide_ft_max = ${data.tideMax}`);

  if (data.breakType) {
    updates.push(`break_type = '${escape(data.breakType)}'`);
  }

  if (data.skillLevel) {
    updates.push(`skill_level = '${escape(data.skillLevel)}'`);
  }

  if (data.hazards.length > 0) {
    updates.push(`hazards = ${arrayToSQL(data.hazards)}`);
  }

  if (data.warnings.length > 0) {
    updates.push(`warnings = ${arrayToSQL(data.warnings)}`);
  }

  if (updates.length === 0) {
    return `-- ${data.name}: No data extracted\n`;
  }

  return `
-- ${data.name}
UPDATE beaches SET
  ${updates.join(',\n  ')}
WHERE name ILIKE '${escape(data.name)}';
`;
}

/**
 * Main execution
 */
async function main() {
  console.log('📖 Parsing Surf Database (No API Calls)\n');

  const rawFilePath = join(__dirname, 'surf-spot-database-raw.md');
  console.log(`Reading ${rawFilePath}...`);
  const rawText = readFileSync(rawFilePath, 'utf-8');

  const spots = parseSpotDescriptions(rawText);
  console.log(`✅ Found ${spots.length} surf spots to parse\n`);

  const extracted: ExtractedBeachData[] = [];
  const stats = {
    withSwell: 0,
    withWind: 0,
    withTide: 0,
    withBreakType: 0,
    withSkill: 0,
    withQuality: 0
  };

  for (const spot of spots) {
    const data = extractSpotData(spot.name, spot.text);
    extracted.push(data);

    if (data.swellWindowCenter) stats.withSwell++;
    if (data.windOffshoreDeg) stats.withWind++;
    if (data.tideMin) stats.withTide++;
    if (data.breakType) stats.withBreakType++;
    if (data.skillLevel) stats.withSkill++;
    if (data.qualityRating) stats.withQuality++;

    console.log(`${spot.name}: ${[
      data.swellWindowCenter ? `swell=${data.swellWindowMin}-${data.swellWindowMax}°` : '',
      data.windOffshoreDeg ? `wind=${data.windOffshoreDeg}°` : '',
      data.tideMin ? `tide=${data.tideMin}-${data.tideMax}ft` : '',
      data.breakType || '',
      data.skillLevel || ''
    ].filter(Boolean).join(', ') || 'no data'}`);
  }

  console.log(`\n📊 Extraction Statistics:`);
  console.log(`  Swell windows: ${stats.withSwell}/${spots.length}`);
  console.log(`  Offshore winds: ${stats.withWind}/${spots.length}`);
  console.log(`  Tide ranges: ${stats.withTide}/${spots.length}`);
  console.log(`  Break types: ${stats.withBreakType}/${spots.length}`);
  console.log(`  Skill levels: ${stats.withSkill}/${spots.length}`);
  console.log(`  Quality ratings: ${stats.withQuality}/${spots.length}`);

  // Generate SQL migration
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '') + '000004';
  const migrationContent = `-- Populate beach characteristics from parsed surf database
-- Generated by parse-surf-database.ts (regex parsing - no API calls)
-- Date: ${new Date().toISOString()}
-- Spots parsed: ${extracted.length}

${extracted.map(data => generateUpdateSQL(data)).join('\n')}

-- Verification
SELECT name, swell_window_center_deg, wind_offshore_deg, preferred_tide_ft_min, preferred_tide_ft_max, break_type, skill_level
FROM beaches
WHERE swell_window_center_deg IS NOT NULL
ORDER BY name;
`;

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', `${timestamp}_parse_surf_database.sql`);
  writeFileSync(migrationPath, migrationContent, 'utf-8');
  console.log(`\n✅ Migration written to: ${migrationPath}`);

  const jsonPath = join(__dirname, 'parsed-beach-data.json');
  writeFileSync(jsonPath, JSON.stringify(extracted, null, 2), 'utf-8');
  console.log(`✅ JSON data written to: ${jsonPath}`);

  console.log('\n✨ Done! Next steps:');
  console.log('  1. Review the migration file');
  console.log('  2. Apply: npx supabase db push');
  console.log('  3. Validate extracted values');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
