"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import {
  fetchHourlyWind,
  type OpenMeteoWindPoint,
} from "@/lib/services/open-meteo-wind-service";
export type { WindQualityLabel } from "@/lib/utils/wind-quality";

export interface WindCheckerBeach {
  id: string;
  name: string;
  slug: string | null;
  lat: number;
  lon: number;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
}

export interface WindCheckerData {
  beach: WindCheckerBeach;
  wind: OpenMeteoWindPoint[];
  hasOrientationData: boolean;
}

export async function getWindCheckerBeach(
  slug: string
): Promise<{ success: boolean; data?: WindCheckerBeach; error?: string }> {
  const supabase = createPublicReadClient();

  const { data, error } = await supabase
    .from("beaches")
    .select(
      "id, name, slug, lat, lon, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg"
    )
    .eq("slug", slug)
    .eq("is_private", false)
    .single();

  if (error || !data) {
    return { success: false, error: "Beach not found" };
  }

  if (!data.lat || !data.lon) {
    return { success: false, error: "Beach has no coordinates" };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      lat: data.lat,
      lon: data.lon,
      wind_offshore_deg: data.wind_offshore_deg ?? null,
      wind_offshore_tol_deg: data.wind_offshore_tol_deg ?? null,
      aspect_deg: data.aspect_deg ?? null,
    },
  };
}

export async function getWindCheckerData(
  slug: string
): Promise<{ success: boolean; data?: WindCheckerData; error?: string }> {
  const beachResult = await getWindCheckerBeach(slug);
  if (!beachResult.success || !beachResult.data) {
    return { success: false, error: beachResult.error };
  }

  const beach = beachResult.data;
  const wind = await fetchHourlyWind(beach.lat, beach.lon);

  // Derive offshore angle from aspect if DB doesn't have it
  // aspect_deg = direction the beach faces (the direction waves come FROM)
  // offshore = opposite of aspect (wind blowing away from shore)
  let offshoreToUse = beach.wind_offshore_deg;
  if (offshoreToUse == null && beach.aspect_deg != null) {
    offshoreToUse = (beach.aspect_deg + 180) % 360;
  }

  const hasOrientationData = offshoreToUse != null;

  return {
    success: true,
    data: {
      beach: {
        ...beach,
        wind_offshore_deg: offshoreToUse,
      },
      wind,
      hasOrientationData,
    },
  };
}
