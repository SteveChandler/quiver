import type { BeachIndexPhotoData } from "@/app/beaches/_components/beach-index-photo";
import { createPublicReadClient } from "@/lib/supabase/server";

interface BajaBeachRow {
  id: string;
  name: string;
}

interface FeaturedPhotoRow {
  beach_id: string | null;
  image_url: string | null;
  attribution_html: string | null;
}

export async function getBajaFeaturedPhoto(): Promise<BeachIndexPhotoData | null> {
  try {
    const supabase = createPublicReadClient();
    const { data: beaches, error: beachesError } = await supabase
      .from("beaches")
      .select("id, name")
      .ilike("state", "baja%")
      .order("name")
      .limit(100);

    if (beachesError || !beaches?.length) return null;

    const bajaBeaches = beaches as BajaBeachRow[];
    const beachById = new Map(
      bajaBeaches.map((beach) => [beach.id, beach.name]),
    );
    const { data: photos, error: photosError } = await supabase
      .from("beach_photos_featured")
      .select("beach_id, image_url, attribution_html")
      .in("beach_id", bajaBeaches.map((beach) => beach.id))
      .order("beach_id")
      .limit(1);

    if (photosError || !photos?.length) return null;

    const photo = photos[0] as FeaturedPhotoRow;
    if (!photo.image_url) return null;

    const beachName = photo.beach_id
      ? beachById.get(photo.beach_id)
      : undefined;

    return {
      src: photo.image_url,
      alt: beachName
        ? `Surf at ${beachName}, Baja California`
        : "Surf on the Baja California coast",
      attributionHtml: photo.attribution_html,
    };
  } catch {
    return null;
  }
}
