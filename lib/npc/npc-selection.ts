/**
 * NPC Selection
 * Logic for selecting which NPCs should post during each cron run
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  type PersonalityType,
  shouldPostAtTime,
  getPostingWindow,
  isWithinPostingWindow,
} from './posting-windows';

export type ActivityLevel = 'high' | 'medium' | 'low';

export interface NPCProfile {
  id: string;
  full_name: string;
  personality_type: PersonalityType;
  home_region: string;
  activity_level: ActivityLevel;
  posting_window: { primary?: number[]; secondary?: number[] } | null;
  is_system_account: boolean;
}

/**
 * Activity level determines posting probability per eligible window
 */
const ACTIVITY_PROBABILITIES: Record<ActivityLevel, number> = {
  high: 0.7, // 70% chance to post when in window (~5-7 posts/week)
  medium: 0.4, // 40% chance to post when in window (~2-4 posts/week)
  low: 0.2, // 20% chance to post when in window (~1-2 posts/week)
};

/**
 * Weekend boost multiplier for applicable personalities
 */
const WEEKEND_BOOST_MULTIPLIER = 1.3;

/**
 * Fetch all eligible NPCs from the database
 * Excludes system accounts (forecaster bot is handled separately)
 */
export async function fetchEligibleNPCs(
  supabase: SupabaseClient<Database>
): Promise<NPCProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, personality_type, home_region, activity_level, posting_window, is_system_account'
    )
    .eq('is_mock', true)
    .not('personality_type', 'is', null)
    .not('home_region', 'is', null)
    .not('activity_level', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch NPCs: ${error.message}`);
  }

  // Filter out system accounts and forecaster (handled by morning-forecast-bot)
  return (data || [])
    .filter(
      (p) =>
        !p.is_system_account && p.personality_type !== 'forecaster'
    )
    .map((p) => ({
      id: p.id,
      full_name: p.full_name || 'Unknown',
      personality_type: p.personality_type as PersonalityType,
      home_region: p.home_region || '',
      activity_level: (p.activity_level || 'medium') as ActivityLevel,
      posting_window: p.posting_window as NPCProfile['posting_window'],
      is_system_account: p.is_system_account || false,
    }));
}

/**
 * Select NPCs that should post during the current hour
 */
export function selectNPCsForCurrentHour(
  npcs: NPCProfile[],
  currentHour: number,
  isWeekend: boolean = false
): NPCProfile[] {
  const selected: NPCProfile[] = [];

  for (const npc of npcs) {
    // Check if NPC is within their posting window
    const window = getPostingWindow(npc.personality_type, npc.posting_window);
    if (!isWithinPostingWindow(currentHour, window)) {
      continue;
    }

    // Calculate posting probability
    let probability = ACTIVITY_PROBABILITIES[npc.activity_level] || 0.4;

    // Apply weekend boost if applicable
    if (isWeekend && window.weekendBoost) {
      probability = Math.min(1.0, probability * WEEKEND_BOOST_MULTIPLIER);
    }

    // Roll dice to determine if NPC posts
    if (Math.random() < probability) {
      selected.push(npc);
    }
  }

  return selected;
}

/**
 * Get beaches assigned to an NPC based on their home region
 */
export async function getBeachesForNPC(
  supabase: SupabaseClient<Database>,
  npc: NPCProfile,
  limit: number = 5
): Promise<
  Array<{
    id: string;
    name: string;
    lat: number | null;
    lon: number | null;
    city: string | null;
  }>
> {
  // Region to approximate coordinates mapping
  const REGION_COORDS: Record<string, { lat: number; lon: number }> = {
    'sf-bay-area': { lat: 37.7749, lon: -122.4194 },
    'central-coast': { lat: 36.9741, lon: -122.0308 },
    'north-san-diego': { lat: 32.8801, lon: -117.2340 },
    'south-san-diego': { lat: 32.7157, lon: -117.1611 },
    'orange-county': { lat: 33.6846, lon: -117.8265 },
    'socal-visitor': { lat: 33.8, lon: -118.0 },
    'norcal-visitor': { lat: 37.5, lon: -122.3 },
  };

  const coords = REGION_COORDS[npc.home_region];

  if (!coords) {
    // Fallback: get random beaches
    const { data } = await supabase
      .from('beaches')
      .select('id, name, lat, lon, city')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .limit(limit);
    return data || [];
  }

  // Get beaches near the NPC's home region
  // Using a simple bounding box query (Supabase doesn't have PostGIS distance by default)
  const latRange = 0.5; // ~55km
  const lonRange = 0.5;

  const { data } = await supabase
    .from('beaches')
    .select('id, name, lat, lon, city')
    .gte('lat', coords.lat - latRange)
    .lte('lat', coords.lat + latRange)
    .gte('lon', coords.lon - lonRange)
    .lte('lon', coords.lon + lonRange)
    .limit(limit * 2); // Fetch more to allow random selection

  if (!data || data.length === 0) {
    // Fallback to any beaches
    const { data: fallback } = await supabase
      .from('beaches')
      .select('id, name, lat, lon, city')
      .not('lat', 'is', null)
      .limit(limit);
    return fallback || [];
  }

  // Shuffle and return limited selection
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

/**
 * Pick a random beach for an NPC's home vs secondary preference
 * 70% home beaches, 25% secondary, 5% random adventure
 */
export function selectBeachForPost(
  homeBeaches: Array<{ id: string; name: string }>,
  secondaryBeaches: Array<{ id: string; name: string }>,
  allBeaches: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const roll = Math.random();

  if (roll < 0.7 && homeBeaches.length > 0) {
    // 70% - Home beach
    return homeBeaches[Math.floor(Math.random() * homeBeaches.length)];
  } else if (roll < 0.95 && secondaryBeaches.length > 0) {
    // 25% - Secondary/regional beaches
    return secondaryBeaches[Math.floor(Math.random() * secondaryBeaches.length)];
  } else if (allBeaches.length > 0) {
    // 5% - Random adventure
    return allBeaches[Math.floor(Math.random() * allBeaches.length)];
  }

  return homeBeaches[0] || secondaryBeaches[0] || allBeaches[0] || null;
}
