"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import { DEFAULT_BEACH_PHOTOS_LIMIT } from "@/lib/constants/featured-beaches-config";

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
 * Fetches from beach_photos table (third-party sources like Openverse, Flickr, etc.)
 * and falls back to session_media if no beach photos are available.
 */
export async function getBestBeachPhotosAction(beachId: string, limit = DEFAULT_BEACH_PHOTOS_LIMIT) {
  return withDatabaseOperation(async (supabase) => {
    // First, try to get photos from beach_photos table (third-party sources)
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
      const mapped = beachPhotos.map((row: { id: string; image_url: string; thumb_url: string | null; fetched_at: string }) => ({
        id: row.id,
        created_at: row.fetched_at,
        public_url: cleanThumbnailUrl(row.thumb_url) || row.image_url,
      }));
      return { data: mapped, error: null };
    }

    // Fallback: Try session_media if no beach_photos
    const { data: sessionMedia, error: sessionError } = await supabase
      .from("session_media")
      .select(
        `id, created_at, storage_path, media_type, session:sessions!inner(id, beach_id)`
      )
      .in("media_type", ["photo", "image"])
      .eq("session.beach_id", beachId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (sessionError) return { data: null, error: sessionError };

    const mapped = (sessionMedia || []).map((row: { id: string; created_at: string; storage_path: string; media_type: string }) => {
      const { data: pub } = supabase.storage
        .from("session-media")
        .getPublicUrl(row.storage_path);
      return {
        id: row.id,
        created_at: row.created_at,
        public_url: pub.publicUrl,
      };
    });

    return { data: mapped, error: null };
  });
}
