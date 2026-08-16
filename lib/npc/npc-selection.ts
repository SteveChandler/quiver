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
import {
  REGIONS,
  HOME_BEACH_COUNT,
  SOCAL_REGIONS,
  NORCAL_REGIONS,
} from '@/config/regions';
import {
  selectSafeBeachForPost,
  type BeachSelectionRun,
} from './beach-selection';
import { selectBeach } from '@/lib/recommendations/selection';
import { fetchBeachTrafficWeights } from './traffic-weights';

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

export interface BeachRecord {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  city: string | null;
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
 * Build the combined list of beach slugs for an NPC's home region.
 * Visitor regions merge slugs from multiple home regions.
 */
function getSlugListForRegion(homeRegion: string): string[] {
  if (homeRegion === 'socal-visitor') {
    return SOCAL_REGIONS.flatMap((r) => REGIONS[r]?.beachSlugs ?? []);
  }
  if (homeRegion === 'norcal-visitor') {
    return NORCAL_REGIONS.flatMap((r) => REGIONS[r]?.beachSlugs ?? []);
  }
  if (homeRegion === 'all-regions') {
    return Object.values(REGIONS).flatMap((r) => r.beachSlugs);
  }
  return REGIONS[homeRegion]?.beachSlugs ?? [];
}

/**
 * Select a beach for an NPC to post about, using weighted home/secondary/adventure logic.
 *
 * Returns a single beach record chosen with 50/35/15 weighting:
 *   50% — home beaches (first HOME_BEACH_COUNT slugs for the region)
 *   35% — secondary beaches (remaining slugs in the region)
 *   15% — adventure (random from all region beaches)
 *
 * Falls back to a random beach from the DB if the region has no slug config.
 */
export async function getBeachesForNPC(
  supabase: SupabaseClient<Database>,
  npc: NPCProfile,
  selectionRun?: BeachSelectionRun,
): Promise<BeachRecord | null> {
  const allSlugs = getSlugListForRegion(npc.home_region);

  // If the region has a configured slug list, use it
  if (allSlugs.length > 0) {
    const { data, error } = await supabase
      .from('beaches')
      .select('id, name, slug, lat, lon, city')
      .in('slug', allSlugs);

    if (error) {
      console.error(`[npc-selection] Beach slug query failed: ${error.message}`);
    }

    const beachMap = new Map((data ?? []).map((b) => [b.slug ?? b.name, b]));

    // Preserve the slug ordering from config so home/secondary split is stable
    const ordered: BeachRecord[] = allSlugs
      .map((slug) => beachMap.get(slug))
      .filter((b): b is NonNullable<typeof b> => b != null)
      .map((b) => ({
        id: b.id,
        name: b.name,
        lat: b.lat ?? null,
        lon: b.lon ?? null,
        city: b.city ?? null,
      }));

    if (ordered.length > 0) {
      const homeSlugs = ordered.slice(0, HOME_BEACH_COUNT).map((b) => b.id);
      const secondarySlugs = ordered.slice(HOME_BEACH_COUNT).map((b) => b.id);
      const trafficWeights = await fetchBeachTrafficWeights(
        supabase,
        ordered.map((beach) => beach.id),
      );

      const selectedId = await selectSafeBeachForPost({
        homeBeachIds: homeSlugs.length > 0 ? homeSlugs : ordered.map((b) => b.id),
        secondaryBeaches: secondarySlugs,
        homeRegion: npc.home_region,
        trafficWeights: trafficWeights ?? undefined,
        selectionRun,
      });

      return ordered.find((b) => b.id === selectedId) ?? null;
    }
  }

  // Fallback: no slug config or no DB matches — return a random beach
  console.warn(
    `[npc-selection] No region slug config for "${npc.home_region}", using random fallback`
  );
  const { data: fallback } = await supabase
    .from('beaches')
    .select('id, name, lat, lon, city')
    .not('lat', 'is', null)
    .limit(20);

  if (!fallback || fallback.length === 0) return null;

  const remaining = [...fallback];
  while (remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    const [pick] = remaining.splice(index, 1);
    if (!pick) continue;

    const selected = await selectBeach({
      id: pick.id,
      name: pick.name,
      lat: pick.lat ?? null,
      lon: pick.lon ?? null,
      city: pick.city ?? null,
    });
    if (selected) return selected;
  }

  return null;
}
