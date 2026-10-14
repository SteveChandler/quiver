import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLocationAnchor, type LocationSnapshot } from "@/lib/alerts/location-freshness";
import { driveRadiusMiles } from "@/lib/profile/drive-range";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import type { Database } from "@/types/database.generated";

export type SwellDispatchReason =
  | "no_location_anchor"
  | "out_of_range"
  | "beach_unavailable"
  | "window_expired"
  | "forecast_passed"
  | "revalidation_unavailable";

export interface SwellDispatchEligibilityInput {
  supabase: SupabaseClient<Database>;
  userId: string;
  payload: unknown;
  now: Date;
}

export type SwellDispatchEligibilityResolver = (
  input: SwellDispatchEligibilityInput,
) => Promise<{ allowed: true } | { allowed: false; reasonCode: SwellDispatchReason }>;

export const resolveSwellDispatchEligibility: SwellDispatchEligibilityResolver = async ({ supabase, userId, payload, now }) => {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("max_drive_minutes, user_location_snapshots(lat, lon, captured_at), home_beach:beaches!profiles_home_beach_id_fkey(lat, lon)")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`Failed to load swell recipient location: ${profileError.message}`);
  const row = profile as typeof profile & {
    user_location_snapshots: LocationSnapshot | LocationSnapshot[] | null;
    home_beach: { lat: number | null; lon: number | null } | null;
  } | null;
  const snapshot = Array.isArray(row?.user_location_snapshots)
    ? row.user_location_snapshots[0] : row?.user_location_snapshots;
  const { anchor } = resolveLocationAnchor(snapshot, now, row?.home_beach);
  if (!anchor) return { allowed: false, reasonCode: "no_location_anchor" };

  const beachId = typeof payload === "object" && payload !== null && "beach_id" in payload
    ? (payload as { beach_id: unknown }).beach_id : null;
  if (typeof beachId !== "string") return { allowed: false, reasonCode: "beach_unavailable" };
  const { data: beach, error: beachError } = await supabase
    .from("beaches")
    .select("lat, lon, deleted_at")
    .eq("id", beachId)
    .maybeSingle();
  if (beachError) throw new Error(`Failed to load swell lead beach: ${beachError.message}`);
  if (!beach || beach.deleted_at !== null) return { allowed: false, reasonCode: "beach_unavailable" };

  const distance = calculateDistanceInMiles(anchor, { lat: beach.lat, lon: beach.lon });
  if (!Number.isFinite(distance)) return { allowed: false, reasonCode: "revalidation_unavailable" };
  if (distance > driveRadiusMiles(row?.max_drive_minutes)) return { allowed: false, reasonCode: "out_of_range" };

  const record = payload as Record<string, unknown>;
  const window = record.surf_window as { state?: unknown; end?: unknown } | null | undefined;
  if (window?.state === "recommended") {
    const end = typeof window.end === "string" ? Date.parse(window.end) : NaN;
    if (!Number.isFinite(end)) return { allowed: false, reasonCode: "revalidation_unavailable" };
    return end < now.getTime() ? { allowed: false, reasonCode: "window_expired" } : { allowed: true };
  }
  const kind = record.kind ?? "coming";
  if (kind === "coming" || kind === "bigger" || kind === "smaller" || kind === "moved") {
    const forecastAt = typeof record.forecast_at === "string" ? Date.parse(record.forecast_at) : NaN;
    if (!Number.isFinite(forecastAt)) return { allowed: false, reasonCode: "revalidation_unavailable" };
    if (forecastAt < now.getTime()) return { allowed: false, reasonCode: "forecast_passed" };
  }
  return { allowed: true };
};
