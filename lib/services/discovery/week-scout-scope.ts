import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const INTERACTIVE_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;

export function getWeekScoutLocation(
  snapshot: { lat?: unknown; lon?: unknown; captured_at?: unknown } | null,
  nowMs: number,
  maxAgeMs: number = INTERACTIVE_LOCATION_MAX_AGE_MS,
): { lat: number; lon: number } | undefined {
  const lat = snapshot?.lat;
  const lon = snapshot?.lon;
  const capturedAt = typeof snapshot?.captured_at === 'string'
    ? Date.parse(snapshot.captured_at)
    : Number.NaN;
  if (
    typeof lat === 'number'
    && Number.isFinite(lat)
    && lat >= -90
    && lat <= 90
    && typeof lon === 'number'
    && Number.isFinite(lon)
    && lon >= -180
    && lon <= 180
    && Number.isFinite(capturedAt)
    && capturedAt <= nowMs
    && nowMs - capturedAt < maxAgeMs
  ) {
    return { lat, lon };
  }
  return undefined;
}

export async function resolveWeekScoutScopeAnchor(
  supabase: SupabaseClient<Database>,
  origin: { lat: number; lon: number } | null,
  userLocation: { lat: number; lon: number } | undefined,
  homeBeachId: string | null,
): Promise<{ anchor: { lat: number; lon: number }; source: 'origin' | 'location' | 'home' } | null> {
  if (origin) return { anchor: origin, source: 'origin' };
  if (userLocation) return { anchor: userLocation, source: 'location' };
  const anchor = await loadHomeBeachCoordinates(supabase, homeBeachId);
  return anchor ? { anchor, source: 'home' } : null;
}

async function loadHomeBeachCoordinates(
  supabase: SupabaseClient<Database>,
  homeBeachId: string | null,
): Promise<{ lat: number; lon: number } | null> {
  if (!homeBeachId) return null;
  const { data, error } = await supabase
    .from('beaches')
    .select('lat, lon')
    .eq('id', homeBeachId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Week Scout home beach: ${error.message}`);
  const lat = data?.lat;
  const lon = data?.lon;
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon)
    ? { lat, lon }
    : null;
}
