"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";

/**
 * Return public image URLs for recent session photos at a beach.
 * TODO: Upgrade ordering to use likes/comments to truly be "best-of".
 */
export async function getBestBeachPhotosAction(beachId: string, limit = 12) {
  return withDatabaseOperation(async (supabase) => {
    // Join session_media -> sessions to filter by beach
    const { data, error } = await supabase
      .from("session_media")
      .select(
        `id, created_at, storage_path, media_type, session:sessions!inner(id, beach_id)`
      )
      .in("media_type", ["photo", "image"])
      .eq("session.beach_id", beachId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error };

    const mapped = (data || []).map((row) => {
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
