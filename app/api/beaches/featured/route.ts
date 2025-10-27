import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";

/**
 * GET /api/beaches/featured
 * 
 * Returns a curated list of featured beaches for the landing page.
 * Returns beaches for visual display on the landing page.
 * 
 * @returns Array of beach objects with id, name, location data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Fetch beaches that have featured photos - prioritize beaches with images
    const { data: photosData, error: photosError } = await supabase
      .from("beach_photos_featured")
      .select("beach_id, thumb_url, image_url, beaches(id, name, city, state)")
      .limit(12);

    if (photosError) {
      console.error("Database error fetching featured beach photos:", photosError);
      return createSuccessResponse([]);
    }

    // Extract beaches and build photo map
    const beaches: any[] = [];
    const photosMap = new Map<string, string>();

    if (photosData) {
      photosData.forEach((photo: any) => {
        if (!photo.beaches || !photo.beach_id) return;

        // Add beach to list if not already added
        if (!beaches.find(b => b.id === photo.beach_id)) {
          beaches.push({
            id: photo.beaches.id,
            name: photo.beaches.name,
            city: photo.beaches.city,
            state: photo.beaches.state,
          });
        }

        // Add photo to map
        const imageUrl = photo.thumb_url || photo.image_url;
        if (imageUrl && !photosMap.has(photo.beach_id)) {
          photosMap.set(photo.beach_id, imageUrl);
        }
      });
    }

    const enriched = beaches.map((beach) => ({
      ...beach,
      photo_url: photosMap.get(beach.id) ?? null,
    }));

    // Return the beaches (component will slice to needed amount and has fallback data)
    return createSuccessResponse(enriched);
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array rather than error for graceful degradation
    return createSuccessResponse([]);
  }
}
