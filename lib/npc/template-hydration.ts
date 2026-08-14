/**
 * Template Hydration
 * Fill template variables with real forecast and conditions data
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { describeTimeOfDay } from './posting-windows';
import { parseWaterTemp } from './forecast-formatter';

export interface SurfConditions {
  waveHeight: number | null;
  wavePeriod: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  tideHeight: number | null;
  tideStatus: string | null;
  waterTemp: number | null;
}

export interface TemplateVariables {
  beach_name: string;
  wave_range: string;
  wave_period: string;
  wind_description: string;
  tide_state: string;
  water_temp: string;
  time_of_day: string;
  crowd_sentence: string;
  personality_closer: string;
  [key: string]: string | undefined;
}

/**
 * Fetch current surf conditions for a beach from enhanced_forecasts
 */
export async function fetchSurfConditions(
  supabase: SupabaseClient<Database>,
  beachId: string
): Promise<SurfConditions> {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const nextDay = new Date(new Date(todayDate + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

  // Try to get forecast for current hour, fall back to most recent
  const { data: forecasts } = await supabase
    .from('enhanced_forecasts')
    .select(
      'wave_height, wave_period, wind_speed, wind_direction, tide_height, tide_status, water_temp'
    )
    .eq('beach_id', beachId)
    .gte('forecast_at', `${todayDate}T00:00:00Z`)
    .lt('forecast_at', `${nextDay}T00:00:00Z`)
    .order('forecast_at', { ascending: false })
    .limit(1);

  const forecast = forecasts?.[0];

  // Parse water_temp from DB text (e.g., "57°F") with deterministic fallback (Bug 6)
  const waterTemp = parseWaterTemp(forecast?.water_temp as string | null) ?? 64;

  return {
    waveHeight: parseFloat(String(forecast?.wave_height || 0)) || null,
    wavePeriod: parseFloat(String(forecast?.wave_period || 0)) || null,
    windSpeed: parseFloat(String(forecast?.wind_speed || 0)) || null,
    windDirection: forecast?.wind_direction || null,
    tideHeight: parseFloat(String(forecast?.tide_height || '')) || null,
    tideStatus: forecast?.tide_status || null,
    waterTemp,
  };
}

/**
 * Generate wave range string (e.g., "3-4ft")
 */
function formatWaveRange(height: number | null): string {
  if (!height || height <= 0) return '1-2ft';
  const lower = Math.max(0.5, Math.round((height - 0.7) * 10) / 10);
  const upper = Math.round((height + 0.7) * 10) / 10;
  if (Math.abs(upper - lower) < 0.3) {
    return `${upper.toFixed(0)}ft`;
  }
  return `${lower.toFixed(0)}-${upper.toFixed(0)}ft`;
}

/**
 * Describe wave period
 */
function describePeriod(period: number | null): string {
  if (!period) return '8-second intervals';
  const rounded = Math.round(period);
  if (rounded >= 14) return `${rounded}-second groundswell energy`;
  if (rounded >= 10) return `${rounded}-second sets with good push`;
  if (rounded >= 7) return `${rounded}-second pulses rolling through`;
  return `${rounded}-second windswell bumps`;
}

/**
 * Describe wind conditions
 */
function describeWind(speed: number | null, direction: string | null): string {
  if (!speed || speed <= 2) return 'glassy conditions';
  const rounded = Math.round(speed);
  let intensity: string;
  if (rounded <= 6) intensity = 'light';
  else if (rounded <= 12) intensity = 'moderate';
  else intensity = 'breezy';
  const dir = direction?.toUpperCase() || '';
  return `${intensity} ${dir} winds around ${rounded}kts`.trim();
}

/**
 * Describe tide state
 */
function describeTide(height: number | null, status: string | null): string {
  if (height === null) return 'mid-tide';
  const heightStr =
    height >= 0 ? `${height.toFixed(1)}ft` : `${height.toFixed(1)}ft (negative)`;

  if (status === 'rising') return `incoming at ${heightStr}`;
  if (status === 'falling') return `dropping at ${heightStr}`;
  if (status === 'high') return `high tide at ${heightStr}`;
  if (status === 'low') return `low tide at ${heightStr}`;
  return `${heightStr}`;
}

/**
 * Describe water temperature
 */
function describeWaterTemp(temp: number | null): string {
  if (!temp) return 'Water temp around 64°F';
  const rounded = Math.round(temp);
  if (rounded <= 58) return `Water is chilly at ${rounded}°F—bring rubber`;
  if (rounded <= 64) return `Water sitting around ${rounded}°F—3/2 is perfect`;
  if (rounded <= 70) return `Water feels comfortable at ${rounded}°F`;
  return `Bath-warm water near ${rounded}°F`;
}

/**
 * Generate random crowd sentence
 */
function generateCrowdSentence(): string {
  return 'Crowd data is not available from this forecast.';
}

/**
 * Generate personality-specific closing line
 */
function generatePersonalityCloser(personalityType: string, homeRegion?: string): string {
  const regionalClosers: Record<string, string[]> = {
    'outer-banks': [
      'Wind direction is the first thing I will check before the next Atlantic window.',
      'The sandbar is the story here, so I am keeping the read local.',
    ],
    hawaii: [
      'I am watching the trade-wind texture before calling the next island window.',
      'The swell direction matters as much as the number here.',
    ],
    'la-santa-monica': [
      'The west-facing LA beach break rewards an early read.',
      'Keeping an eye on wind texture before the next city session.',
    ],
    'santa-barbara': [
      'The Channel changes the feel quickly, so I am logging the details.',
      'A measured read is useful along this coast.',
    ],
    'southern-maine': [
      'Cold-water timing is part of the session plan up here.',
      'The next call starts with the wind and the wetsuit check.',
    ],
    'south-jersey': [
      'The jetties organize the read when the shorebreak starts moving.',
      'Logging the shore detail before the next Jersey swell.',
    ],
  };
  const regionalOptions = homeRegion ? regionalClosers[homeRegion] : undefined;
  if (regionalOptions) {
    return regionalOptions[Math.floor(Math.random() * regionalOptions.length)];
  }

  const closers: Record<string, string[]> = {
    rookie: [
      'Still stoked just to be out there.',
      'Every session teaches me something new.',
      'Loving every minute of this journey.',
    ],
    local: [
      'Another good one in the books.',
      'Classic conditions for the regulars.',
      'Worth the early alarm.',
    ],
    traveler: [
      'Adding this one to the travel log.',
      'Different from home but in a good way.',
      'Worth the mission.',
    ],
    photographer: [
      'Light was painting everything gold.',
      'Captured some frames between sets.',
      'Visual conditions were unreal.',
    ],
    tactical: [
      'Mission parameters achieved.',
      'Conditions within operational norms.',
      'Logged for future reference.',
    ],
    competitor: [
      'Good reps for the competition ahead.',
      'Pushed it on every set.',
      'Solid training session.',
    ],
  };
  const options = closers[personalityType] || closers.local;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Build template variables from conditions and context
 */
export function buildTemplateVariables(
  beachName: string,
  conditions: SurfConditions,
  personalityType: string,
  timestamp: Date,
  homeRegion?: string,
): TemplateVariables {
  const hour = (timestamp.getUTCHours() + 24 - 8) % 24; // Convert to PT

  return {
    beach_name: beachName,
    wave_range: formatWaveRange(conditions.waveHeight),
    wave_period: describePeriod(conditions.wavePeriod),
    wind_description: describeWind(conditions.windSpeed, conditions.windDirection),
    tide_state: describeTide(conditions.tideHeight, conditions.tideStatus),
    water_temp: describeWaterTemp(conditions.waterTemp),
    time_of_day: describeTimeOfDay(hour),
    crowd_sentence: generateCrowdSentence(),
    personality_closer: generatePersonalityCloser(personalityType, homeRegion),
  };
}

/**
 * Hydrate a template string with variables
 */
export function hydrateTemplate(
  template: string,
  variables: TemplateVariables
): string {
  if (!template) return '';
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
  }

  return result;
}

/**
 * Extract variable names from a template
 */
function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map((match) => match.replace(/[{}]/g, ''));
}

/**
 * Fetch a random template for the given content type and personality
 */
export async function fetchRandomTemplate(
  supabase: SupabaseClient<Database>,
  contentType: 'intel' | 'session_note' | 'review',
  personalityType: string,
  tag?: string
): Promise<{ id: string; template: string; variables: string[] } | null> {
  let query = supabase
    .from('npc_content_templates')
    .select('id, template, variables, use_count')
    .eq('content_type', contentType)
    .eq('personality', personalityType)
    .eq('archived', false);

  if (tag) {
    query = query.eq('tag', tag);
  }

  // Order by use_count to prefer fresher templates
  query = query.order('use_count', { ascending: true }).limit(10);

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return null;
  }

  // Pick a random one from the top 10 least-used
  const selected = data[Math.floor(Math.random() * data.length)];

  // Increment use count
  await supabase
    .from('npc_content_templates')
    .update({
      use_count: ((selected as any).use_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', selected.id);

  return {
    id: selected.id,
    template: selected.template,
    variables: selected.variables || [],
  };
}
