"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";

/**
 * Return public image URLs for beach photos.
 * Fetches from beach_photos table (third-party sources like Openverse, Flickr, etc.)
 * and falls back to session_media if no beach photos are available.
 */
export async function getBestBeachPhotosAction(beachId: string, limit = 12) {
  return withDatabaseOperation(async (supabase) => {
    // First, try to get photos from beach_photos table (third-party sources)
    const { data: beachPhotos, error: beachPhotosError } = await supabase
      .from("beach_photos")
      .select("id, image_url, thumb_url, fetched_at")
      .eq("beach_id", beachId)
      .eq("approved", true)
      .order("fetched_at", { ascending: false })
      .limit(limit);

    if (beachPhotosError) {
      console.error("[getBestBeachPhotosAction] Error fetching beach photos:", beachPhotosError);
    }

    // If we have beach photos, return them
    if (beachPhotos && beachPhotos.length > 0) {
      const mapped = beachPhotos.map((row) => ({
        id: row.id,
        created_at: row.fetched_at,
        public_url: row.thumb_url || row.image_url,
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

    const mapped = (sessionMedia || []).map((row) => {
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
