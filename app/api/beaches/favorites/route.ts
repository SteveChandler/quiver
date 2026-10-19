import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import type { Beach } from "@/types/database";
import type { SavedSpotTarget } from "@/types/saved-spot";

/**
 * GET /api/beaches/favorites - List authenticated user's favorite beaches
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data, error: dbError } = await supabase
      .from("favorite_beaches")
      .select("rank, beach_id, custom_spot_id, beaches(*), custom_spots(id, user_id, name, lat, lon, break_type, nearest_beach_id, deleted_at)")
      .eq("user_id", user.id)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (dbError) {
      throw dbError;
    }

    const beaches: Beach[] = [];
    const targets: SavedSpotTarget[] = [];
    for (const row of data ?? []) {
      if (row.beach_id && row.beaches) {
        const beach = row.beaches as Beach;
        beaches.push(beach);
        targets.push({ kind: "beach", beach, rank: row.rank });
      } else if (
        row.custom_spot_id &&
        row.custom_spots &&
        row.custom_spots.user_id === user.id &&
        row.custom_spots.deleted_at === null
      ) {
        const { id, name, lat, lon, break_type, nearest_beach_id } = row.custom_spots;
        targets.push({
          kind: "custom_spot",
          customSpot: { id, name, lat, lon, break_type, nearest_beach_id },
          nearestBeachId: nearest_beach_id,
          rank: row.rank,
        });
      }
    }

    return createSuccessResponse({ beaches, targets });
  },
  { errorMessage: "Failed to load favorite beaches" }
);
