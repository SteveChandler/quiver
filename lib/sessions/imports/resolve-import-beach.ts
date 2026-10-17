import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportBeach = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  swellWindowCenterDeg: number | null;
};

type BeachResolution =
  | { status: "resolved"; beach: ImportBeach }
  | { status: "needs_beach"; candidates: ImportBeach[] };

type NearbyBeachRow = Pick<ImportBeach, "id" | "name" | "lat" | "lon">;

export async function resolveImportBeach(
  supabase: SupabaseClient,
  centroid: { lat: number; lon: number }
): Promise<BeachResolution> {
  const { data: nearby, error: nearbyError } = await supabase.rpc("get_nearby_beaches", {
    input_lat: centroid.lat,
    input_lng: centroid.lon,
    max_distance_meters: 3000,
    limit_count: 3,
  });
  if (nearbyError) throw nearbyError;
  const nearbyRows = (nearby ?? []) as NearbyBeachRow[];
  if (!nearbyRows.length) return { status: "needs_beach", candidates: [] };

  const { data: windows, error: windowsError } = await supabase
    .from("beaches")
    .select("id, swell_window_center_deg")
    .in("id", nearbyRows.map((row) => row.id));
  if (windowsError) throw windowsError;

  const windowById = new Map(
    (windows ?? []).map((row) => [row.id, row.swell_window_center_deg])
  );
  const candidates: ImportBeach[] = nearbyRows.map((row) => ({
    id: row.id,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    swellWindowCenterDeg: windowById.get(row.id) ?? null,
  }));

  return { status: "resolved", beach: candidates[0] };
}

export async function loadImportBeach(
  supabase: SupabaseClient,
  beachId: string
): Promise<ImportBeach | null> {
  const { data: row, error } = await supabase
    .from("beaches")
    .select("id, name, lat, lon, swell_window_center_deg")
    .eq("id", beachId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    swellWindowCenterDeg: row.swell_window_center_deg,
  };
}
