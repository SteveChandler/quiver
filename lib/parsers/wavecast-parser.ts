/**
 * WaveCast HTML Parser
 * Extracts structured forecast data from wavecast.com/socal/ HTML
 */

import * as cheerio from 'cheerio';
import {
  WaveCastParsedData,
  WaveCastSwell,
  WaveCastWaveForecast,
  WaveCastConditions,
  WaveCastOutlook,
  WaveCastBeachForecast,
} from '@/types/wavecast';

export interface ParseResult {
  success: boolean;
  data?: WaveCastParsedData;
  errors: string[];
  confidence: number; // 0-1
}

/**
 * Main parser function to extract structured data from WaveCast HTML
 */
export function parseWaveCastHTML(html: string): ParseResult {
  const errors: string[] = [];
  let confidence = 1.0;

  try {
    const $ = cheerio.load(html);

    // Extract metadata
    const metadata = extractMetadata($);
    if (!metadata.author || !metadata.update_timestamp) {
      errors.push('Failed to extract metadata (author/timestamp)');
      confidence -= 0.2;
    }

    // Extract main forecast text
    const fullText = extractFullText($);
    if (!fullText || fullText.length < 100) {
      errors.push('Insufficient forecast text found');
      confidence -= 0.3;
    }

    // Parse swells
    const swells = parseSwells(fullText);
    if (swells.length === 0) {
      errors.push('No swell data extracted');
      confidence -= 0.2;
    }

    // Parse wave forecasts
    const waveForecast = parseWaveForecasts(fullText);
    if (waveForecast.length === 0) {
      errors.push('No wave forecasts extracted');
      confidence -= 0.2;
    }

    // Parse weather
    const weather = parseWeather(fullText);

    // Parse water temperature
    const waterTemp = parseWaterTemp(fullText);

    // Parse tides
    const tides = parseTides(fullText);

    // Extract summary
    const summary = extractSummary(fullText);

    // Ensure confidence doesn't go below 0
    confidence = Math.max(0, confidence);

    const parsedData: WaveCastParsedData = {
      author: metadata.author || 'Unknown',
      update_timestamp: metadata.update_timestamp || new Date().toISOString(),
      report_date: metadata.report_date || new Date().toISOString().split('T')[0],
      swells,
      weather,
      wave_forecasts: waveForecast,
      tides,
      water_temp: waterTemp,
      summary,
      confidence: confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low',
    };

    return {
      success: true,
      data: parsedData,
      errors,
      confidence,
    };
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      errors,
      confidence: 0,
    };
  }
}

/**
 * Extract metadata (author, timestamp)
 */
function extractMetadata($: cheerio.CheerioAPI): {
  author: string | null;
  update_timestamp: string | null;
  report_date: string | null;
} {
  // Look for timestamp pattern like "Tuesday 10/28/25 5:55 AM By Nathan Cool"
  const bodyText = $('body').text();

  // Extract author
  const authorMatch = bodyText.match(/By\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  const author = authorMatch ? authorMatch[1].trim() : 'Nathan Cool';

  // Extract timestamp - look for date pattern
  const timestampMatch = bodyText.match(/\w+\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2}\s+[AP]M)/i);
  let update_timestamp: string | null = null;
  let report_date: string | null = null;

  if (timestampMatch) {
    const dateStr = timestampMatch[1];
    const timeStr = timestampMatch[2];

    try {
      // Parse date like "10/28/25" to ISO format
      const [month, day, year] = dateStr.split('/');
      const fullYear = year.length === 2 ? `20${year}` : year;

      // Convert to ISO format
      report_date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      update_timestamp = new Date(`${fullYear}-${month}-${day} ${timeStr}`).toISOString();
    } catch (e) {
      console.error('Error parsing timestamp:', e);
    }
  }

  return {
    author,
    update_timestamp,
    report_date,
  };
}

/**
 * Extract full forecast text
 */
function extractFullText($: cheerio.CheerioAPI): string {
  // Try to find main content area
  const content = $('article, .content, .forecast, main, body').first();
  return content.text().trim();
}

/**
 * Parse swell information from text
 */
function parseSwells(text: string): WaveCastSwell[] {
  const swells: WaveCastSwell[] = [];

  // Look for swell patterns
  const swellPatterns = [
    /ground\s*swell|groundswell/gi,
    /wind\s*swell|windswell/gi,
    /NW\s*swell|northwest\s*swell/gi,
    /SW\s*swell|southwest\s*swell/gi,
    /south\s*swell|southern\s*hemisphere/gi,
  ];

  // Extract direction patterns like "315-320°" or "210°"
  const directionMatches = text.matchAll(/(\d{1,3})[-–]?(\d{1,3})?\s*°?/g);

  // Extract period patterns like "14-22 seconds" or "18 second"
  const periodMatches = text.matchAll(/(\d{1,2})[-–](\d{1,2})?\s*second/gi);

  // For each swell pattern found, create a swell object
  for (const pattern of swellPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const swellType = match[0].toLowerCase().includes('ground') ? 'ground_swell' : 'wind_swell';
      const context = text.slice(Math.max(0, match.index! - 100), Math.min(text.length, match.index! + 200));

      swells.push({
        type: swellType,
        description: context.trim(),
      });
    }
  }

  return swells;
}

/**
 * Parse wave forecast predictions
 */
function parseWaveForecasts(text: string): WaveCastWaveForecast[] {
  const forecasts: WaveCastWaveForecast[] = [];

  // Look for size predictions like "3-5 feet" or "waist to chest high"
  const sizePatterns = [
    /(\d+)[-–](\d+)\s*(?:ft|feet|foot)/gi,
    /(waist|knee|ankle|chest|shoulder|head|overhead)/gi,
  ];

  // Extract days of the week
  const dayMatches = text.matchAll(/(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/gi);

  for (const dayMatch of dayMatches) {
    const dayName = dayMatch[0];
    const dayIndex = dayMatch.index!;

    // Look for size info near this day mention
    const contextAfter = text.slice(dayIndex, Math.min(text.length, dayIndex + 300));

    // Try to find numeric size
    const sizeMatch = contextAfter.match(/(\d+)[-–](\d+)\s*(?:ft|feet|foot)/i);

    if (sizeMatch) {
      forecasts.push({
        date: new Date().toISOString().split('T')[0], // Will be refined later
        day_name: dayName,
        height_range: {
          min: parseInt(sizeMatch[1]),
          max: parseInt(sizeMatch[2]),
          unit: 'ft',
        },
        description: contextAfter.slice(0, 200).trim(),
      });
    }
  }

  return forecasts;
}

/**
 * Parse weather conditions
 */
function parseWeather(text: string): WaveCastParsedData['weather'] {
  const weather: WaveCastParsedData['weather'] = {};

  // Check for wind patterns
  if (/santa\s*ana/gi.test(text)) {
    weather.wind_pattern = 'Santa Ana winds';
  } else if (/offshore/gi.test(text)) {
    weather.wind_pattern = 'offshore';
  } else if (/onshore/gi.test(text)) {
    weather.wind_pattern = 'onshore';
  }

  // Check for marine layer
  weather.marine_layer = /marine\s*layer/gi.test(text);

  return weather;
}

/**
 * Parse water temperature
 */
function parseWaterTemp(text: string): WaveCastParsedData['water_temp'] {
  // Look for water temp like "62°" or "62 degrees"
  const tempMatch = text.match(/water.*?(\d{2,3})\s*°|(\d{2,3})\s*degrees/i);

  if (tempMatch) {
    const temp = parseInt(tempMatch[1] || tempMatch[2]);
    return {
      current: temp,
      trend: text.toLowerCase().includes('warming') ? 'warming' :
             text.toLowerCase().includes('cooling') ? 'cooling' : 'stable',
    };
  }

  return undefined;
}

/**
 * Parse tide information
 */
function parseTides(text: string): WaveCastParsedData['tides'] {
  const tides: WaveCastParsedData['tides'] = {};

  if (/high\s*tide/gi.test(text)) {
    tides.level = 'high';
  } else if (/low\s*tide/gi.test(text)) {
    tides.level = 'low';
  }

  return Object.keys(tides).length > 0 ? tides : undefined;
}

/**
 * Extract summary (first paragraph or key points)
 */
function extractSummary(text: string): string {
  // Get first 300 characters as summary
  const summary = text.slice(0, 300).trim();

  // Find the end of the first sentence or paragraph
  const sentenceEnd = summary.search(/\.\s+[A-Z]/);
  if (sentenceEnd > 50) {
    return summary.slice(0, sentenceEnd + 1).trim();
  }

  return summary;
}

/**
 * Map beach names from WaveCast to Quiver beach IDs
 */
export function mapBeachForecasts(
  parsedData: WaveCastParsedData,
  beachMappings: Map<string, string>
): WaveCastBeachForecast[] {
  const beachForecasts: WaveCastBeachForecast[] = [];

  // This is a placeholder - in production, you'd extract beach-specific
  // forecasts from the parsed data and map them to your beach IDs

  return beachForecasts;
}

/**
 * Extract hazards and warnings
 */
export function extractHazards(text: string): string[] {
  const hazards: string[] = [];

  const hazardPatterns = [
    /rip\s*current/gi,
    /advisory/gi,
    /warning/gi,
    /high\s*surf/gi,
    /dangerous/gi,
  ];

  for (const pattern of hazardPatterns) {
    if (pattern.test(text)) {
      hazards.push(pattern.source.replace(/\\/g, '').replace(/gi$/, ''));
    }
  }

  return hazards;
}
