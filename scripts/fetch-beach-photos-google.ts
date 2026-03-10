// Fetch beach photos from Google Places API (New) for beaches missing photos.
// Downloads images and re-uploads them to Supabase Storage so we own the URLs
// (Google Places media URLs are ephemeral redirects that break in Next.js image pipeline).
// Usage:
//   npx tsx scripts/fetch-beach-photos-google.ts --dryRun
//   npx tsx scripts/fetch-beach-photos-google.ts
//   npx tsx scripts/fetch-beach-photos-google.ts --limit=10  # only process first N beaches

/*
ENV REQUIRED
----------
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_PLACES_API_KEY=
*/

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}
if (!GOOGLE_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    args.set(key, value ?? "true");
  }
}

const DRY_RUN = args.get("dryRun") === "true";
const LIMIT = Number(args.get("limit") ?? "0"); // 0 = all
const VERBOSE = args.get("verbose") === "true";

interface Beach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  city: string | null;
  state: string | null;
}

interface PlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions: Array<{ displayName: string; uri: string }>;
}

async function getBeachesMissingPhotos(): Promise<Beach[]> {
  const { data: allBeaches, error } = await supabase
    .from("beaches")
    .select("id, name, lat, lon, city, state")
    .not("lat", "is", null)
    .not("lon", "is", null)
    .limit(3000);

  if (error) throw error;
  if (!allBeaches?.length) return [];

  const beachIds = allBeaches.map((b) => b.id);

  const { data: beachesWithPhotos, error: photosError } = await supabase
    .from("beach_photos")
    .select("beach_id")
    .in("beach_id", beachIds)
    .eq("approved", true)
    .is("deleted_at", null);

  if (photosError) throw photosError;

  const withPhotos = new Set(
    (beachesWithPhotos ?? []).map((p: { beach_id: string }) => p.beach_id),
  );

  let missing = (allBeaches as Beach[]).filter((b) => !withPhotos.has(b.id));
  if (LIMIT > 0) missing = missing.slice(0, LIMIT);
  return missing;
}

// Google Places API (New) — Text Search to find place, then Place Details for photos
async function findPlaceId(beach: Beach): Promise<string | null> {
  const query = `${beach.name} beach ${beach.city ?? ""} ${beach.state ?? ""}`.trim();

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: beach.lat, longitude: beach.lon },
            radius: 2000,
          },
        },
        maxResultCount: 1,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Places search failed for ${beach.name}: ${res.status} ${body}`);
    return null;
  }

  const json = (await res.json()) as { places?: Array<{ id: string; displayName: { text: string } }> };
  if (!json.places?.length) {
    if (VERBOSE) console.log(`  No place found for "${query}"`);
    return null;
  }

  if (VERBOSE) {
    console.log(`  Found place: ${json.places[0].displayName.text} (${json.places[0].id})`);
  }
  return json.places[0].id;
}

async function getPlacePhotos(placeId: string): Promise<PlacePhoto[]> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "photos",
      },
    },
  );

  if (!res.ok) {
    console.error(`Place details failed for ${placeId}: ${res.status}`);
    return [];
  }

  const json = (await res.json()) as {
    photos?: PlacePhoto[];
  };

  if (!json.photos?.length) return [];

  // Return up to 3 photo metadata objects
  return json.photos.slice(0, 3);
}

async function downloadAndUploadPhoto(
  photo: PlacePhoto,
  beachId: string,
  index: number,
): Promise<{ publicUrl: string; attribution: string }> {
  // 1. Download image from Google Places media endpoint (follows redirects)
  // Use header-based auth to keep API key out of URL logs
  const mediaUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800`;
  const res = await fetch(mediaUrl, {
    headers: { "X-Goog-Api-Key": GOOGLE_API_KEY },
  });
  if (!res.ok) throw new Error(`Photo download failed: ${res.status}`);

  // 2. Get image bytes
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Determine content type and file extension
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";

  // 4. Upload to Supabase Storage
  const storagePath = `google-places/${beachId}/${index}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("beach-photos")
    .upload(storagePath, buffer, {
      contentType,
      cacheControl: "31536000", // 1 year cache
      upsert: true,
    });
  if (uploadError) throw uploadError;

  // 5. Get public URL
  const { data: urlData } = supabase.storage
    .from("beach-photos")
    .getPublicUrl(storagePath);

  // 6. Build attribution HTML from author attributions (escape to prevent XSS)
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const attributions = photo.authorAttributions
    .map((a) => (a.uri ? `<a href="${esc(a.uri)}">${esc(a.displayName)}</a>` : esc(a.displayName)))
    .join(", ");
  const attribution = attributions
    ? `Photo by ${attributions} via Google`
    : "Photo via Google";

  return { publicUrl: urlData.publicUrl, attribution };
}

async function upsertPhoto(
  beachId: string,
  imageUrl: string,
  attribution: string,
  index: number,
) {
  const sourceId = `google-places-${beachId}-${index}`;
  const { error } = await supabase.from("beach_photos").upsert(
    {
      beach_id: beachId,
      source: "google_places",
      source_id: sourceId,
      image_url: imageUrl,
      thumb_url: null, // Supabase image transformations handle thumbnailing
      attribution_html: attribution,
      approved: true,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "beach_id,source,source_id", ignoreDuplicates: false },
  );
  if (error) throw error;
}

async function main() {
  const beaches = await getBeachesMissingPhotos();
  console.log(`Found ${beaches.length} beaches missing photos`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Would process:");
    for (const b of beaches) {
      console.log(`  - ${b.name} (${b.city ?? ""}, ${b.state ?? ""})`);
    }
    return;
  }

  let success = 0;
  let failed = 0;

  for (const beach of beaches) {
    try {
      console.log(`Processing: ${beach.name} (${beach.city ?? ""})`);

      const placeId = await findPlaceId(beach);
      if (!placeId) {
        failed++;
        continue;
      }

      const photos = await getPlacePhotos(placeId);
      if (!photos.length) {
        console.log(`  No photos found`);
        failed++;
        continue;
      }

      for (let i = 0; i < photos.length; i++) {
        const { publicUrl, attribution } = await downloadAndUploadPhoto(photos[i], beach.id, i);
        await upsertPhoto(beach.id, publicUrl, attribution, i);
      }

      console.log(`  Saved ${photos.length} photos`);
      success++;

      // Courtesy throttle (~5 API calls per beach: search + details + up to 3 media downloads)
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`Error on ${beach.name}:`, err);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
