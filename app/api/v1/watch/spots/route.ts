import { createSuccessResponse } from "@/lib/api-utils";
import { withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";

export const runtime = "nodejs";

type Spot = { id: string; name: string; lat: number; lon: number };
type SpotRow = Spot & { deleted_at?: string | null };

function validSpot(row: SpotRow | null): row is SpotRow {
  return !!row && !row.deleted_at && Number.isFinite(row.lat) && Number.isFinite(row.lon);
}

export const GET = withNoStore(withRateLimit(withWatchAuth(async (_request, { userId, service }) => {
  const { data: profile, error: profileError } = await service.from("profiles")
    .select("home_beach_id").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;

  let home: SpotRow | null = null;
  if (profile?.home_beach_id) {
    const { data, error } = await service.from("beaches")
      .select("id, name, lat, lon, deleted_at").eq("id", profile.home_beach_id).maybeSingle();
    if (error) throw error;
    home = data;
  }

  const { data: favorites, error: favoritesError } = await service.from("favorite_beaches")
    .select("beach_id, custom_spot_id, beaches(id, name, lat, lon, deleted_at), custom_spots(id, name, lat, lon, deleted_at)")
    .eq("user_id", userId).order("rank", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (favoritesError) throw favoritesError;

  const spots: Spot[] = [];
  const seen = new Set<string>();
  function add(row: SpotRow | null): void {
    if (!validSpot(row) || seen.has(row.id) || spots.length >= 20) return;
    seen.add(row.id);
    spots.push({ id: row.id, name: row.name, lat: row.lat, lon: row.lon });
  }
  add(home);
  for (const favorite of favorites ?? []) {
    add(favorite.beaches);
    add(favorite.custom_spots);
    if (spots.length === 20) break;
  }
  return createSuccessResponse({ spots });
}, { errorMessage: "Failed to load watch spots" }), "authenticated-default"));
