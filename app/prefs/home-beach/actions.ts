'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyEmailActionToken } from '@/lib/email/verify-email-action';
import { revalidatePath } from 'next/cache';
import type { BeachBasicInfo } from '@/types/database';

export type { BeachBasicInfo };

export interface SaveHomeBeachResult {
  success: boolean;
  error?: string;
}

export async function saveHomeBeach(
  token: string,
  beachId: string
): Promise<SaveHomeBeachResult> {
  // Verify token
  const verification = await verifyEmailActionToken(token, 'prefs');
  if (!verification.success) {
    return { success: false, error: verification.error };
  }
  const userId = verification.userId;

  // Update database
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('user_email_prefs')
    .upsert(
      {
        user_id: userId,
        home_beach_id: beachId,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Failed to save home beach:', error);
    return { success: false, error: 'Failed to save. Please try again.' };
  }

  revalidatePath('/prefs/home-beach');
  return { success: true };
}

export async function searchBeaches(query: string, limit: number = 10): Promise<BeachBasicInfo[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('beaches')
    .select('id, name, city, state, country')
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (error) {
    console.error('Beach search error:', error);
    return [];
  }

  return data || [];
}

export async function getNearbyBeaches(lat: number, lon: number, limit: number = 5): Promise<BeachBasicInfo[]> {
  const supabase = await createSupabaseServerClient();

  // Use PostGIS RPC to find nearby beaches
  const { data, error } = await supabase.rpc('get_nearby_beaches', {
    input_lat: lat,
    input_lng: lon,
    limit_count: limit,
  });

  if (error) {
    console.error('Nearby beaches error:', error);
    // Fall back to popular San Diego beaches
    const { data: fallback } = await supabase
      .from('beaches')
      .select('id, name, city, state, country')
      .in('name', ['La Jolla Shores', 'Scripps', 'Blacks Beach', 'Pacific Beach', 'Ocean Beach'])
      .limit(limit);
    return (fallback || []) as BeachBasicInfo[];
  }

  // Map the RPC result to BeachBasicInfo
  return (data || []).map((b: { id: string; name: string; location?: string }) => ({
    id: b.id,
    name: b.name,
    city: null,
    state: null,
    country: null,
    // Note: get_nearby_beaches returns 'location' instead of city/state
    // We could parse it or just show it directly in the UI
  }));
}

export async function getPopularBeaches(limit: number = 5): Promise<BeachBasicInfo[]> {
  const supabase = await createSupabaseServerClient();

  // Get popular San Diego beaches as defaults
  const { data, error } = await supabase
    .from('beaches')
    .select('id, name, city, state, country')
    .in('name', ['La Jolla Shores', 'Scripps', 'Blacks Beach', 'Pacific Beach', 'Ocean Beach'])
    .limit(limit);

  if (error) {
    console.error('Popular beaches error:', error);
    return [];
  }

  return (data || []) as BeachBasicInfo[];
}
