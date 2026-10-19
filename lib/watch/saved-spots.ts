import type { WatchContext } from "./with-watch-auth";

/** A spot the watch can offer: the home beach first, then favorites in rank order. */
export type WatchSpot = { id: string; name: string; lat: number; lon: number; kind: "beach" | "custom" };

type SpotRow = { id: string; name: string; lat: number; lon: number; deleted_at?: string | null };

const MAX_WATCH_SPOTS = 20;

function validSpot(row: SpotRow | null): row is SpotRow {
  return !!row && !row.deleted_at && Number.isFinite(row.lat) && Number.isFinite(row.lon);
}

export async function loadWatchSpots(service: WatchContext["service"], userId: string): Promise<WatchSpot[]> {
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

  const spots: WatchSpot[] = [];
  const seen = new Set<string>();
  function add(row: SpotRow | null, kind: WatchSpot["kind"]): void {
    if (!validSpot(row) || seen.has(row.id) || spots.length >= MAX_WATCH_SPOTS) return;
    seen.add(row.id);
    spots.push({ id: row.id, name: row.name, lat: row.lat, lon: row.lon, kind });
  }
  add(home, "beach");
  for (const favorite of favorites ?? []) {
    add(favorite.beaches, "beach");
    add(favorite.custom_spots, "custom");
    if (spots.length === MAX_WATCH_SPOTS) break;
  }
  return spots;
}
