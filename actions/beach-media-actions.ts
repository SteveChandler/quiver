"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import { DEFAULT_BEACH_PHOTOS_LIMIT } from "@/lib/constants/featured-beaches-config";
import type { Database } from "@/types/supabase";

/**
 * Clean Openverse thumbnail URLs by removing ?format=json suffix.
 * 
 * The Openverse API sometimes returns thumbnail URLs with ?format=json appended,
 * which causes 400 errors when passed through Next.js Image Optimization because
 * the endpoint returns JSON metadata instead of an actual image.
 * 
 * @param url - The URL to clean
 * @returns The cleaned URL without ?format=json
 */
function cleanThumbnailUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\?format=json$/i, '');
}

/**
 * Return public image URLs for beach photos.
 * Fetches only approved beach_photos rows. User-uploaded session media must be
 * promoted into beach_photos by an admin before it can appear in public beach
 * header or gallery surfaces.
 */
export async function getBestBeachPhotosAction(beachId: string, limit = DEFAULT_BEACH_PHOTOS_LIMIT) {
  return withDatabaseOperation(async (supabase) => {
    const { data: beachPhotos, error: beachPhotosError } = await withApprovedPhotos(
      supabase
        .from("beach_photos")
        .select("id, image_url, thumb_url, fetched_at")
        .eq("beach_id", beachId)
    )
      .order("fetched_at", { ascending: false })
      .limit(limit);

    if (beachPhotosError) {
      console.error("[getBestBeachPhotosAction] Error fetching beach photos:", beachPhotosError);
    }

    // If we have beach photos, return them
    if (beachPhotos && beachPhotos.length > 0) {
      const mapped = beachPhotos.map((row: Pick<Database['public']['Tables']['beach_photos']['Row'], 'id' | 'image_url' | 'thumb_url' | 'fetched_at'>) => ({
        id: row.id,
        created_at: row.fetched_at,
        public_url: cleanThumbnailUrl(row.thumb_url) || row.image_url,
      }));
      return { data: mapped, error: null };
    }

    return { data: [], error: null };
  }, { allowNull: true });
}
