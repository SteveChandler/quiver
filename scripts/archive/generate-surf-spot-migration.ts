#!/usr/bin/env tsx
/**
 * Generate migration to populate beach data from surf spot database
 *
 * This script:
 * 1. Reads the comprehensive surf spot database
 * 2. Matches beaches by name
 * 3. Extracts structured data using regex patterns
 * 4. Generates SQL UPDATE statements
 * 5. Creates migration file and unmatched beaches report
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

interface Beach {
  name: string;
  id: string;
  null_columns: string[];
  null_count: number;
}

interface SurfSpotData {
  name: string;
  breakType: string | null;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  swellWindowMin: number | null;
  swellWindowMax: number | null;
  swellWindowCenter: number | null;
  swellWindowHalfwidth: number | null;
  windOffshoreDeg: number | null;
  tideMin: number | null;
  tideMax: number | null;
  aspectDeg: number | null;
  bestMonths: number[];
  description: string;
  hazards: string[];
  warnings: string[];
  accessTips: string;
  parkingTips: string;
  crowdTips: string;
  localEtiquette: string;
  waveTips: string;
  crowdLevel: string | null;
  features: string[];
  bestConditionsProse: string;
}

// ============================================================================
// Beach name matching dictionary
// ============================================================================

const beachMatches: Record<string, string> = {
  // California - South Orange County
  'Brooks Street': 'Brooks Street',
  'Crystal Cove': 'Crystal Cove',
  'Doheny': 'Doheny State Beach',
  'Doheny State Beach': 'Doheny State Beach',
  'Salt Creek': 'Salt Creek',
  'The Wedge': 'The Wedge',
  'Newport Point': 'Newport Point',
  'T-Street': 'T-Street',
  'San Onofre State Beach': 'San Onofre State Beach',
  'Old Man\'s (SanO)': 'San Onofre State Beach',
  'Lower Trestles': 'Lower Trestles',
  'Upper Trestles': 'Upper Trestles',

  // California - LA County
  'El Porto (Manhattan)': 'El Porto',

  // California - San Diego County
  'Oceanside Pier': 'Oceanside Pier',
  'Oceanside Harbor': 'Oceanside Harbor',
  'Ponto': 'Ponto',
  'Tamarack': 'Tamarack State Beach',
  'Terramar Point': 'Terramar Point',
  'Swami\'s': 'Swami\'s',
  'Cardiff Reef': 'Cardiff Reef',
  'Seaside Reef': 'Seaside Reef',
  'Grandview': 'Grandview',
  'Del Mar': 'Del Mar',
  'Del Mar Rivermouth': 'Del Mar',
  'Windansea': 'Windansea',
  'Tourmaline': 'Tourmaline',
  'Tourmaline Surf Park': 'Tourmaline',
  'Pacific Beach': 'Pacific Beach',
  'Mission Beach': 'Mission Beach',
  'Mission Beach (Central)': 'Mission Beach',
  'La Jolla Shores': 'La Jolla Shores',
  'Blacks': 'Blacks Beach',
  'Scripps': 'Scripps Pier',
  'Ocean Beach': 'Ocean Beach',
  'Ocean Beach Pier': 'Ocean Beach',
  'Sunset Cliffs (Garbage)': 'Sunset Cliffs',
  'Silver Strand State Beach': 'Silver Strand State Beach',
  'Tijuana Sloughs': 'Tijuana Sloughs',

  // Pacific Northwest - Oregon
  'Seaside Cove': 'Seaside Cove',
  'Short Sands (Oswald West)': 'Short Sands',
  'Pacific City (Cape Kiwanda)': 'Pacific City',
  'Florence South Jetty': 'Florence South Jetty',
  'Gold Beach (South Jetty)': 'Gold Beach',

  // Pacific Northwest - Washington
  'Westport Beach': 'Westport',
  'Westport (Marina/Groins/Jetty)': 'Westport',
  'La Push — First Beach': 'La Push',

  // Hawaii
  'Hanalei Bay (Kauai)': 'Hanalei Bay',
  'Poipu Beach (Kauai)': 'Poipu Beach Park',
};

// ============================================================================
// Parsing utilities
// ============================================================================

function extractSwellWindow(text: string): { min: number | null; max: number | null; center: number | null } {
  // Pattern: "180-250°, center 215°" or "(180-250°, center 215°)"
  const match = text.match(/\(?(\d+)-(\d+)°(?:,?\s*center\s+(\d+)°)?\)?/i);

  if (match) {
    const min = parseInt(match[1]);
    const max = parseInt(match[2]);
    const center = match[3] ? parseInt(match[3]) : Math.round((min + max) / 2);

    return { min, max, center };
  }

  return { min: null, max: null, center: null };
}

function extractWindDirection(text: string): number | null {
  // Pattern: "67° ENE" or "0° North" or just "90°"
  const match = text.match(/(\d+)°\s*(?:ENE|NE|ESE|SE|SSE|SSW|WSW|WNW|NW|NNW|NNE|E|W|N|S|East|West|North|South)?/i);

  if (match) {
    return parseInt(match[1]);
  }

  return null;
}

function extractTideRange(text: string): { min: number | null; max: number | null } {
  // Pattern: "2-5 feet" or "2.5-4.5 feet" or "(0.5-4 feet)"
  const match = text.match(/\(?(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\s*feet\)?/i);

  if (match) {
    return {
      min: parseFloat(match[1]),
      max: parseFloat(match[2])
    };
  }

  return { min: null, max: null };
}

function parseMonths(text: string): number[] {
  const monthMap: Record<string, number> = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12
  };

  // Pattern: "March-October" or "June-September"
  const rangeMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*-\s*(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);

  if (rangeMatch) {
    const start = monthMap[rangeMatch[1].toLowerCase()];
    const end = monthMap[rangeMatch[2].toLowerCase()];

    if (start <= end) {
      return Array.from({length: end - start + 1}, (_, i) => start + i);
    } else {
      // Wraps around year (e.g., November-March)
      return [
        ...Array.from({length: 12 - start + 1}, (_, i) => start + i),
        ...Array.from({length: end}, (_, i) => i + 1)
      ];
    }
  }

  // "Year-round"
  if (/year.round/i.test(text)) {
    return [1,2,3,4,5,6,7,8,9,10,11,12];
  }

  return [];
}

function extractSkillLevel(text: string): 'beginner' | 'intermediate' | 'advanced' | 'expert' | null {
  const lower = text.toLowerCase();

  if (lower.includes('expert only') || lower.includes('big-wave expert') ||
      lower.includes('extremely demanding') || lower.includes('expert waterme')) {
    return 'expert';
  }
  if (lower.includes('advanced') || lower.includes('strong ocean skills')) {
    return 'advanced';
  }
  if (lower.includes('beginner') || lower.includes('learn-to-surf') ||
      lower.includes('gentle predictable') || lower.includes('learning wave')) {
    return 'beginner';
  }
  if (lower.includes('intermediate')) {
    return 'intermediate';
  }

  return null;
}

function crowdLevelFromRating(text: string): string | null {
  // Extract crowd rating like "(10/10)" or "10/10" or "9-10/10"
  const match = text.match(/\(?(\d+)(?:-\d+)?\/10\)?/);

  if (match) {
    const rating = parseInt(match[1]);

    if (rating >= 9) return 'extremely_crowded';
    if (rating >= 7) return 'very_crowded';
    if (rating >= 5) return 'crowded';
    if (rating >= 3) return 'moderate';
    return 'uncrowded';
  }

  // Try to extract from descriptive text
  const lower = text.toLowerCase();
  if (lower.includes('extremely crowded') || lower.includes('unbearable crowd')) {
    return 'extremely_crowded';
  }
  if (lower.includes('very crowded') || lower.includes('heavy crowd')) {
    return 'very_crowded';
  }
  if (lower.includes('crowded')) {
    return 'crowded';
  }
  if (lower.includes('moderate crowd') || lower.includes('sometimes crowded')) {
    return 'moderate';
  }
  if (lower.includes('uncrowded') || lower.includes('low crowd') || lower.includes('generally uncrowded')) {
    return 'uncrowded';
  }

  return null;
}

function extractBreakType(text: string): string | null {
  const lower = text.toLowerCase();

  if (lower.includes('cobblestone reef break')) return 'cobblestone reef break';
  if (lower.includes('reef break') && lower.includes('point break')) return 'reef/point break';
  if (lower.includes('reef/point break')) return 'reef/point break';
  if (lower.includes('point break')) return 'point break';
  if (lower.includes('reef break')) return 'reef break';
  if (lower.includes('beach break')) return 'beach break';
  if (lower.includes('jetty break')) return 'jetty break';
  if (lower.includes('shorebreak')) return 'shorebreak';
  if (lower.includes('river mouth')) return 'river mouth break';

  return null;
}

function extractFeatures(text: string): string[] {
  const features: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes('lifeguard')) features.push('lifeguards');
  if (lower.includes('restroom') || lower.includes('bathroom')) features.push('restrooms');
  if (lower.includes('shower')) features.push('showers');
  if (lower.includes('camping') || lower.includes('campground')) features.push('camping');
  if (lower.includes('pier')) features.push('pier');
  if (lower.includes('jetty') || lower.includes('jetties')) features.push('jetty');
  if (lower.includes('parking')) features.push('parking');
  if (lower.includes('trail') || lower.includes('hike')) features.push('trail access');
  if (lower.includes('wheelchair')) features.push('wheelchair access');
  if (lower.includes('picnic')) features.push('picnic areas');
  if (lower.includes('playground')) features.push('playground');

  return features;
}

function extractHazards(text: string): string[] {
  const hazards: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes('rip current')) hazards.push('rip currents');
  if (lower.includes('shallow reef') || lower.includes('shallow cobblestone')) hazards.push('shallow reef');
  if (lower.includes('sharp rocks') || lower.includes('rocks')) hazards.push('rocks');
  if (lower.includes('shark')) hazards.push('sharks');
  if (lower.includes('stingray')) hazards.push('stingrays');
  if (lower.includes('strong current')) hazards.push('strong currents');
  if (lower.includes('steep drop')) hazards.push('steep drop-off');
  if (lower.includes('kelp')) hazards.push('kelp');
  if (lower.includes('urchin')) hazards.push('sea urchins');
  if (lower.includes('mollusk')) hazards.push('sharp mollusks');
  if (lower.includes('hold-down')) hazards.push('long hold-downs');
  if (lower.includes('competitive lineup')) hazards.push('competitive lineup');

  return hazards;
}

function extractWarnings(text: string): string[] {
  const warnings: string[] = [];

  // Extract CRITICAL WARNING and WARNING sections
  const criticalWarning = text.match(/\*\*CRITICAL WARNING[S]?:(.*?)\*\*/gi);
  const extremeDanger = text.match(/\*\*EXTREME DANGER:(.*?)\*\*/gi);
  const warning = text.match(/\*\*WARNING:(.*?)\*\*/gi);
  const severeWarning = text.match(/\*\*SEVERE.*?WARNING:(.*?)\*\*/gi);

  if (criticalWarning) {
    criticalWarning.forEach(w => {
      const clean = w.replace(/\*\*/g, '').replace(/CRITICAL WARNING[S]?:/i, '').trim();
      if (clean) warnings.push(clean);
    });
  }

  if (extremeDanger) {
    extremeDanger.forEach(w => {
      const clean = w.replace(/\*\*/g, '').replace(/EXTREME DANGER:/i, '').trim();
      if (clean) warnings.push(clean);
    });
  }

  if (severeWarning) {
    severeWarning.forEach(w => {
      const clean = w.replace(/\*\*/g, '').replace(/SEVERE.*?WARNING:/i, '').trim();
      if (clean) warnings.push(clean);
    });
  }

  if (warning) {
    warning.forEach(w => {
      const clean = w.replace(/\*\*/g, '').replace(/WARNING:/i, '').trim();
      if (clean) warnings.push(clean);
    });
  }

  // Check for blackball restrictions
  if (text.toLowerCase().includes('blackball')) {
    const blackballMatch = text.match(/blackballed?\s+([^.]+)/i);
    if (blackballMatch) {
      warnings.push(`Blackballed: ${blackballMatch[1].trim()}`);
    }
  }

  return warnings;
}

// ============================================================================
// Parse surf spot entry
// ============================================================================

function parseSurfSpot(entry: string): SurfSpotData | null {
  const lines = entry.split('\n');

  // Extract name from bold header: **Name**
  const nameMatch = entry.match(/\*\*([^*]+)\*\*/);
  if (!nameMatch) return null;

  const name = nameMatch[1].trim();
  const fullText = entry;
  const lower = fullText.toLowerCase();

  // Extract swell window
  const swellWindow = extractSwellWindow(fullText);

  // Extract wind direction
  const windMatch = fullText.match(/offshore winds?\s+(?:from\s+)?(\d+°[^.]+)/i);
  const windDeg = windMatch ? extractWindDirection(windMatch[1]) : null;

  // Extract tide range
  const tideMatch = fullText.match(/tide[^.]*?(\d+(?:\.\d+)?-\d+(?:\.\d+)?\s*feet)/i);
  const tideRange = tideMatch ? extractTideRange(tideMatch[1]) : { min: null, max: null };

  // Extract aspect (shoreline orientation)
  const aspectMatch = fullText.match(/(?:faces|facing|orientation)\s+(\w+)\s*\((\d+)°\)/i);
  const aspectDeg = aspectMatch ? parseInt(aspectMatch[2]) : null;

  // Extract best months
  const bestMonthsMatch = fullText.match(/best\s+([a-z]+-[a-z]+|year-round)/i);
  const bestMonths = bestMonthsMatch ? parseMonths(bestMonthsMatch[1]) : [];

  // Extract main description (first paragraph)
  const firstSentence = fullText.split('.')[0] + '.';
  const description = firstSentence.length > 100 ? firstSentence :
    fullText.substring(0, Math.min(500, fullText.indexOf('.', 100) + 1));

  // Extract break type
  const breakType = extractBreakType(fullText);

  // Extract skill level
  const skillLevel = extractSkillLevel(fullText);

  // Extract crowd level
  const crowdLevel = crowdLevelFromRating(fullText);

  // Extract hazards
  const hazards = extractHazards(fullText);

  // Extract warnings
  const warnings = extractWarnings(fullText);

  // Extract features
  const features = extractFeatures(fullText);

  // Extract specific tips from text
  const accessTips = extractAccessTips(fullText);
  const parkingTips = extractParkingTips(fullText);
  const crowdTips = extractCrowdTips(fullText);
  const localEtiquette = extractLocalEtiquette(fullText);
  const waveTips = extractWaveTips(fullText);
  const bestConditionsProse = extractBestConditions(fullText);

  return {
    name,
    breakType,
    skillLevel,
    swellWindowMin: swellWindow.min,
    swellWindowMax: swellWindow.max,
    swellWindowCenter: swellWindow.center,
    swellWindowHalfwidth: swellWindow.min !== null && swellWindow.max !== null ?
      Math.round((swellWindow.max - swellWindow.min) / 2) : null,
    windOffshoreDeg: windDeg,
    tideMin: tideRange.min,
    tideMax: tideRange.max,
    aspectDeg,
    bestMonths,
    description: description.trim(),
    hazards,
    warnings,
    accessTips,
    parkingTips,
    crowdTips,
    localEtiquette,
    waveTips,
    crowdLevel,
    features,
    bestConditionsProse
  };
}

function extractAccessTips(text: string): string {
  const tips: string[] = [];

  // Look for hike/walk distance
  const hikeMatch = text.match(/(\d+(?:\.\d+)?-mile|mile|minute)\s+(?:hike|walk)[^.]+/i);
  if (hikeMatch) tips.push(hikeMatch[0].trim());

  // Look for parking access
  const parkingAccessMatch = text.match(/(?:direct beach parking|beach access|access from)[^.]+/i);
  if (parkingAccessMatch) tips.push(parkingAccessMatch[0].trim());

  // Look for stairway access
  const stairMatch = text.match(/(?:stairway|stairs|steps)[^.]+access/i);
  if (stairMatch) tips.push(stairMatch[0].trim());

  return tips.join('. ');
}

function extractParkingTips(text: string): string {
  const tips: string[] = [];

  // Look for parking fees
  const feeMatch = text.match(/\$\d+(?:\.\d+)?\s+(?:day|parking|fee)[^.]+/gi);
  if (feeMatch) tips.push(...feeMatch.map(m => m.trim()));

  // Look for parking warnings
  if (text.toLowerCase().includes('car break-in') || text.toLowerCase().includes('car rip-off')) {
    tips.push('Car break-ins reported - secure valuables');
  }

  // Look for free parking
  if (text.toLowerCase().includes('free parking') || text.toLowerCase().includes('free street parking')) {
    tips.push('Free parking available');
  }

  return tips.join('. ');
}

function extractCrowdTips(text: string): string {
  const tips: string[] = [];

  // Look for crowd descriptions
  const crowdMatch = text.match(/(?:crowds?|lineup)[^.]{20,150}(?:competitive|territorial|friendly|mellow|aggressive|sponsored|pros)/i);
  if (crowdMatch) tips.push(crowdMatch[0].trim());

  // Look for best time to avoid crowds
  const timeMatch = text.match(/(?:dawn patrol|early morning|weekday)[^.]{10,80}(?:crowd|surfer)/i);
  if (timeMatch) tips.push(timeMatch[0].trim());

  return tips.join('. ');
}

function extractLocalEtiquette(text: string): string {
  const tips: string[] = [];

  // Look for localism mentions
  if (text.toLowerCase().includes('localism') || text.toLowerCase().includes('territorial')) {
    const localMatch = text.match(/(?:localism|territorial|local)[^.]{20,150}/i);
    if (localMatch) tips.push(localMatch[0].trim());
  }

  // Look for respect mentions
  const respectMatch = text.match(/respect[^.]{10,100}/i);
  if (respectMatch) tips.push(respectMatch[0].trim());

  // Look for pecking order
  if (text.toLowerCase().includes('pecking order')) {
    tips.push('Strict pecking order - respect local hierarchy');
  }

  return tips.join('. ');
}

function extractWaveTips(text: string): string {
  const tips: string[] = [];

  // Look for wave characteristics
  const waveMatch = text.match(/(?:produces|delivers|offers|features)[^.]{30,200}(?:waves?|lefts?|rights?|barrels?|walls?)/i);
  if (waveMatch) tips.push(waveMatch[0].trim());

  // Look for best conditions
  const condMatch = text.match(/(?:works best|optimal|ideal)[^.]{20,100}/i);
  if (condMatch) tips.push(condMatch[0].trim());

  return tips.join('. ');
}

function extractBestConditions(text: string): string {
  const conditions: string[] = [];

  // Look for best months/season
  const seasonMatch = text.match(/best\s+(?:in\s+)?([a-z]+-[a-z]+|year-round|[a-z]+\s+months?)[^.]{0,100}/i);
  if (seasonMatch) conditions.push(seasonMatch[0].trim());

  // Look for swell direction summary
  const swellMatch = text.match(/(?:receives|works on)\s+[^.]{20,100}swells?/i);
  if (swellMatch) conditions.push(swellMatch[0].trim());

  return conditions.join('. ');
}

// ============================================================================
// SQL generation
// ============================================================================

function sqlString(value: string | null): string {
  if (value === null || value === '') return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlArray(values: string[]): string {
  if (values.length === 0) return 'NULL';
  // Use PostgreSQL array literal syntax: '{"value1", "value2"}'
  const escaped = values.map(v => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
  return `'{"${escaped.join('", "')}"}'`;
}

function sqlIntArray(values: number[]): string {
  if (values.length === 0) return 'NULL';
  // Use PostgreSQL array literal syntax: '{1, 2, 3}'
  return `'{${values.join(', ')}}'`;
}

function generateUpdateSQL(beachId: string, data: SurfSpotData): string {
  const updates: string[] = [];

  if (data.breakType) updates.push(`  break_type = ${sqlString(data.breakType)}`);
  if (data.skillLevel) updates.push(`  skill_level = ${sqlString(data.skillLevel)}`);
  if (data.swellWindowMin !== null) updates.push(`  swell_window_min_deg = ${data.swellWindowMin}`);
  if (data.swellWindowMax !== null) updates.push(`  swell_window_max_deg = ${data.swellWindowMax}`);
  if (data.swellWindowCenter !== null) updates.push(`  swell_window_center_deg = ${data.swellWindowCenter}`);

  // Calculate halfwidth handling wraparound (e.g., 315° to 30° wraps around 360°)
  if (data.swellWindowMin !== null && data.swellWindowMax !== null) {
    let halfwidth: number;
    if (data.swellWindowMax < data.swellWindowMin) {
      // Wraparound case: add 360 to max before calculating
      halfwidth = Math.round(((data.swellWindowMax + 360) - data.swellWindowMin) / 2);
    } else {
      halfwidth = Math.round((data.swellWindowMax - data.swellWindowMin) / 2);
    }
    updates.push(`  swell_window_halfwidth_deg = ${halfwidth}`);
  }
  if (data.windOffshoreDeg !== null) updates.push(`  wind_offshore_deg = ${data.windOffshoreDeg}`);
  if (data.tideMin !== null) updates.push(`  preferred_tide_ft_min = ${data.tideMin}`);
  if (data.tideMax !== null) updates.push(`  preferred_tide_ft_max = ${data.tideMax}`);
  if (data.aspectDeg !== null) updates.push(`  aspect_deg = ${data.aspectDeg}`);
  if (data.bestMonths.length > 0) updates.push(`  best_months = ${sqlIntArray(data.bestMonths)}`);
  if (data.description) updates.push(`  description = ${sqlString(data.description)}`);
  if (data.hazards.length > 0) updates.push(`  hazards = ${sqlArray(data.hazards)}`);
  if (data.warnings.length > 0) updates.push(`  warnings = ${sqlArray(data.warnings)}`);
  if (data.accessTips) updates.push(`  access_tips = ${sqlString(data.accessTips)}`);
  if (data.parkingTips) updates.push(`  parking_tips = ${sqlString(data.parkingTips)}`);
  if (data.crowdTips) updates.push(`  crowd_tips = ${sqlString(data.crowdTips)}`);
  if (data.localEtiquette) updates.push(`  local_etiquette = ${sqlString(data.localEtiquette)}`);
  if (data.waveTips) updates.push(`  wave_tips = ${sqlString(data.waveTips)}`);
  if (data.crowdLevel) updates.push(`  crowd_level = ${sqlString(data.crowdLevel)}`);
  if (data.features.length > 0) updates.push(`  features = ${sqlArray(data.features)}`);
  if (data.bestConditionsProse) updates.push(`  best_conditions_prose = ${sqlString(data.bestConditionsProse)}`);

  if (updates.length === 0) {
    return ''; // No data to update
  }

  return `
-- ${data.name}
UPDATE public.beaches SET
${updates.join(',\n')}
WHERE id = '${beachId}';
`;
}

// ============================================================================
// Main execution
// ============================================================================

async function main() {
  console.log('🏄 Generating surf spot migration...\n');

  // Read beaches list
  const beachesListPath = join(__dirname, '..', 'beaches-null-columns.json');
  const beaches: Beach[] = JSON.parse(readFileSync(beachesListPath, 'utf-8'));

  console.log(`📊 Found ${beaches.length} beaches with NULL columns`);

  // Read surf spot database
  const surfSpotDbPath = join(__dirname, 'surf-spot-database-raw.md');
  const surfSpotDb = readFileSync(surfSpotDbPath, 'utf-8');

  // Split into individual spot entries
  const spotEntries = surfSpotDb.split(/\*\*(?=[A-Z])/g).filter(entry => entry.trim().length > 100);

  console.log(`📖 Parsed ${spotEntries.length} surf spot entries\n`);

  // Parse all surf spots
  const surfSpots = new Map<string, SurfSpotData>();

  for (const entry of spotEntries) {
    const data = parseSurfSpot('**' + entry);
    if (data) {
      surfSpots.set(data.name, data);
    }
  }

  console.log(`✅ Successfully parsed ${surfSpots.size} surf spots\n`);

  // Match beaches and generate SQL
  const sqlStatements: string[] = [];
  const matched: string[] = [];
  const unmatched: Beach[] = [];

  for (const beach of beaches) {
    const surfSpotName = beachMatches[beach.name];

    if (surfSpotName && surfSpots.has(surfSpotName)) {
      const data = surfSpots.get(surfSpotName)!;
      const sql = generateUpdateSQL(beach.id, data);

      if (sql) {
        sqlStatements.push(sql);
        matched.push(beach.name);
        console.log(`✓ Matched: ${beach.name} → ${surfSpotName}`);
      }
    } else {
      unmatched.push(beach);
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`   Matched: ${matched.length} beaches`);
  console.log(`   Unmatched: ${unmatched.length} beaches`);
  console.log(`   Coverage: ${Math.round((matched.length / beaches.length) * 100)}%\n`);

  // Generate migration file
  const migrationContent = `-- Migration: Populate surf spot data from comprehensive database
-- Source: Surfline, Magic Seaweed, NOAA buoy data, regional surf guides
-- Date: ${new Date().toISOString().split('T')[0]}
-- Matched beaches: ${matched.length}/${beaches.length}

BEGIN;

${sqlStatements.join('\n')}

COMMIT;
`;

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251025200000_populate_surf_spot_data.sql');
  writeFileSync(migrationPath, migrationContent);

  console.log(`✅ Migration file created: ${migrationPath}`);

  // Generate unmatched beaches report
  const unmatchedReport = `# Unmatched Beaches Report

Generated: ${new Date().toISOString()}

## Summary

- **Total beaches:** ${beaches.length}
- **Matched:** ${matched.length}
- **Unmatched:** ${unmatched.length}
- **Coverage:** ${Math.round((matched.length / beaches.length) * 100)}%

## Unmatched Beaches

These beaches were not found in the surf spot database and require additional data sourcing:

${unmatched.map(b => `### ${b.name}
- **ID:** \`${b.id}\`
- **NULL columns:** ${b.null_count}
- **Missing data:** ${b.null_columns.join(', ')}
`).join('\n')}

## Next Steps

1. **Research additional sources** for unmatched beaches
2. **Consider Surfline API** for programmatic data access
3. **Manual data entry** for high-priority beaches
4. **Community contributions** from local surfers

## Priority Beaches

Sorted by number of NULL columns (most incomplete first):

${unmatched
  .sort((a, b) => b.null_count - a.null_count)
  .slice(0, 20)
  .map((b, i) => `${i + 1}. **${b.name}** (${b.null_count} NULL columns)`)
  .join('\n')}
`;

  const reportPath = join(__dirname, 'unmatched-beaches-report.md');
  writeFileSync(reportPath, unmatchedReport);

  console.log(`📄 Unmatched beaches report: ${reportPath}\n`);

  console.log('🎉 Generation complete!');
  console.log(`\n🚀 Next steps:`);
  console.log(`   1. Review: ${migrationPath}`);
  console.log(`   2. Test: npx supabase db reset`);
  console.log(`   3. Apply: npx supabase db push`);
}

main().catch(console.error);
