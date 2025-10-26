"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
import {
  getCrowdLevel,
  getDirectionAbbrev,
  getWindDescription,
  getWindDirectionDegrees,
} from "@/lib/utils/beach-conditions-utils";
import type { Beach } from "@/types/database";
import type { BeachRecommendation } from "@/types/beach-recommendations";

type NearbyBeach = {
  id: string;
  name: string;
  location: string | null;
  distance_meters: number | null;
  is_private?: boolean | null;
};

type ForecastSnapshot = {
  beach_id: string;
  forecast_time: string | null;
  wave_height: string | null;
  wave_direction: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  tide_height: string | null;
  tide_status: string | null;
};

type IntelSnapshot = {
  beach_id: string;
  conditions_score: number | null;
  confidence: string | null;
  surf_min_ft: number | null;
  surf_max_ft: number | null;
  surf_description: string | null;
  tide_height_ft: number | null;
  tide_status: string | null;
  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  wind_direction_text: string | null;
  wind_description: string | null;
  primary_swell_direction_deg: number | null;
  primary_swell_direction_text: string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDirectionDegrees(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric !== null) return numeric;
  if (typeof value === "string") {
    const abbrev = getDirectionAbbrev(value);
    return getWindDirectionDegrees(abbrev);
  }
  return null;
}

function timeStringToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function formatSurfHeight(
  minFt: number | null | undefined,
  maxFt: number | null | undefined,
  description?: string | null,
  fallback?: string | null
): string {
  const formatValue = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded.toFixed(0)}` : `${rounded}`;
  };

  if (minFt != null && maxFt != null) {
    if (Math.abs(maxFt - minFt) < 0.25) {
      return `${formatValue((minFt + maxFt) / 2)} ft`;
    }
    return `${formatValue(minFt)}-${formatValue(maxFt)} ft`;
  }

  const value = minFt ?? maxFt;
  if (value != null) {
    return `${formatValue(value)} ft`;
  }

  if (description && description.trim().length > 0) {
    return description;
  }

  return fallback ?? "N/A";
}

function toDistanceMilesString(distanceMeters: number | null | undefined): string {
  if (!distanceMeters || !Number.isFinite(distanceMeters)) return "0.0";
  const miles = distanceMeters / 1609.34;
  return miles.toFixed(1);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function pickBestForecast(
  forecasts: ForecastSnapshot[] | undefined,
  targetMinutes: number
): ForecastSnapshot | null {
  if (!forecasts || forecasts.length === 0) return null;

  let best: ForecastSnapshot | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const forecast of forecasts) {
    const minutes = timeStringToMinutes(forecast.forecast_time);
    if (minutes === null) continue;
    const diff = Math.abs(minutes - targetMinutes);
    if (diff < bestDiff) {
      best = forecast;
      bestDiff = diff;
    }
  }

  return best ?? forecasts[0] ?? null;
}

export async function getBestBeachesNearHome() {
  console.log("[getBestBeachesNearHome] 🚀 Function called");
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[getBestBeachesNearHome] User check:", { hasUser: !!user, error: userError?.message });

    if (userError || !user) {
      console.log("[getBestBeachesNearHome] No authenticated user, returning empty array");
      return { success: true, data: [] as BeachRecommendation[] };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("home_beach_id, experience_level")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[getBestBeachesNearHome] Failed to load profile", profileError);
      return { success: false, error: profileError.message, data: [] as BeachRecommendation[] };
    }

    if (!profile?.home_beach_id) {
      console.log("[getBestBeachesNearHome] No home beach set");
      return { success: true, data: [] as BeachRecommendation[] };
    }

    console.log("[getBestBeachesNearHome] User:", user.id, "Home beach:", profile.home_beach_id);

    const { data: homeBeach, error: homeBeachError } = await supabase
      .from("beaches")
      .select("id, lat, lon")
      .eq("id", profile.home_beach_id)
      .maybeSingle();

    if (homeBeachError) {
      console.error("[getBestBeachesNearHome] Failed to load home beach", homeBeachError);
      return { success: false, error: homeBeachError.message, data: [] as BeachRecommendation[] };
    }

    if (
      !homeBeach ||
      homeBeach.lat === null ||
      homeBeach.lon === null
    ) {
      console.log("[getBestBeachesNearHome] Home beach missing coordinates");
      return { success: true, data: [] as BeachRecommendation[] };
    }

    let nearbyBeachesResult = await supabase.rpc("get_nearby_beaches", {
      lat: homeBeach.lat,
      lng: homeBeach.lon,
      max_distance_meters: 16093, // 10 miles
      limit_count: 25,
    });

    console.log("[getBestBeachesNearHome] RPC result:", { 
      hasError: !!nearbyBeachesResult.error, 
      hasData: !!nearbyBeachesResult.data,
      dataLength: nearbyBeachesResult.data?.length 
    });

    if (nearbyBeachesResult.error) {
      console.warn(
        "[getBestBeachesNearHome] ⚠️ Nearby beaches RPC failed, falling back to direct query",
        nearbyBeachesResult.error
      );

      const fallbackResult = await supabase
        .from("beaches")
        .select("id, name, city, lat, lon, is_private")
        .not("lat", "is", null)
        .not("lon", "is", null)
        .limit(50);

      if (fallbackResult.error) {
        console.error(
          "[getBestBeachesNearHome] Fallback nearby beaches query failed",
          fallbackResult.error
        );
        return {
          success: false,
          error: fallbackResult.error.message,
          data: [] as BeachRecommendation[],
        };
      }

      const filteredFallback = (fallbackResult.data as any[] | null)?.map(
        (beach) => {
          if (
            beach?.lat == null ||
            beach?.lon == null ||
            typeof beach.lat !== "number" ||
            typeof beach.lon !== "number"
          ) {
            return {
              ...beach,
              distance_meters: null,
            };
          }

          const distance = haversineDistanceMeters(
            homeBeach.lat,
            homeBeach.lon,
            beach.lat,
            beach.lon
          );

          return {
            ...beach,
            distance_meters: distance,
          };
        }
      );

      nearbyBeachesResult = {
        data: filteredFallback?.filter(
          (beach) =>
            beach &&
            !beach.is_private &&
            typeof beach.distance_meters === "number" &&
            beach.distance_meters <= 16093
        ),
        error: null,
      };
    }

    const nearbyBeaches = (nearbyBeachesResult.data as NearbyBeach[] | null)?.filter(
      (beach) => !beach.is_private
    );

    const nearbyCount = nearbyBeaches?.length ?? 0;
    console.log("[getBestBeachesNearHome] Nearby beaches found:", nearbyCount);

    if (!nearbyBeaches || nearbyBeaches.length === 0) {
      console.log("[getBestBeachesNearHome] No nearby beaches found");
      return { success: true, data: [] as BeachRecommendation[] };
    }

    const beachIds = nearbyBeaches.map((beach) => beach.id);

    const beachPhotoMap = new Map<string, string>();
    if (beachIds.length > 0) {
      try {
        const { data: sessionPhotos, error: sessionPhotosError } = await supabase
          .from("session_media")
          .select(
            `
            session_id,
            public_url,
            media_type,
            created_at,
            session:sessions!inner(beach_id)
          `
          )
          .in("media_type", ["photo", "image"])
          .in("session.beach_id", beachIds)
          .order("created_at", { ascending: false });

        if (sessionPhotosError) {
          console.error(
            "[getBestBeachesNearHome] Failed to load session photos",
            sessionPhotosError
          );
        } else {
          for (const row of sessionPhotos ?? []) {
            const beachId = (row as any)?.session?.beach_id as
              | string
              | undefined;
            const imageUrl = (row as any)?.public_url as string | undefined;
            if (!beachId || !imageUrl || beachPhotoMap.has(beachId)) continue;
            beachPhotoMap.set(beachId, imageUrl);
          }
        }

        const beachesMissingPhotos = beachIds.filter(
          (id) => !beachPhotoMap.has(id)
        );
        if (beachesMissingPhotos.length > 0) {
          const { data: featuredPhotos, error: featuredPhotosError } =
            await supabase
              .from("beach_photos_featured")
              .select("beach_id, image_url")
              .in("beach_id", beachesMissingPhotos)
              .limit(beachesMissingPhotos.length);

          if (featuredPhotosError) {
            console.error(
              "[getBestBeachesNearHome] Failed to load featured beach photos",
              featuredPhotosError
            );
          } else {
            for (const row of featuredPhotos ?? []) {
              const beachId = (row as any)?.beach_id as string | undefined;
              const imageUrl = (row as any)?.image_url as string | undefined;
              if (!beachId || !imageUrl || beachPhotoMap.has(beachId)) continue;
              beachPhotoMap.set(beachId, imageUrl);
            }
          }
        }
      } catch (photoError) {
        console.error(
          "[getBestBeachesNearHome] Unexpected error loading beach photos",
          photoError
        );
      }
    }

    const { data: beachDetails, error: beachDetailsError } = await supabase
      .from("beaches")
      .select(
        "id, name, city, skill_level, wind_offshore_deg, wind_offshore_tol_deg, wind_onshore_bad_kt, wind_cross_shore_ok_kt, preferred_tide_ft_min, preferred_tide_ft_max"
      )
      .in("id", beachIds);

    if (beachDetailsError) {
      console.error("[getBestBeachesNearHome] Failed to load beach details", beachDetailsError);
      return { success: false, error: beachDetailsError.message, data: [] as BeachRecommendation[] };
    }

    const { data: intelRows, error: intelError } = await supabase
      .from("beach_daily_intel")
      .select(
        "beach_id, conditions_score, confidence, surf_min_ft, surf_max_ft, surf_description, tide_height_ft, tide_status, wind_speed_mph, wind_direction_deg, wind_direction_text, wind_description, primary_swell_direction_deg, primary_swell_direction_text"
      )
      .in("beach_id", beachIds)
      .order("generated_at", { ascending: false });

    if (intelError) {
      console.warn("[getBestBeachesNearHome] Failed to load intel rows", intelError);
    }

    const intelByBeach = new Map<string, IntelSnapshot>();
    for (const row of (intelRows as IntelSnapshot[] | null) ?? []) {
      if (!intelByBeach.has(row.beach_id)) {
        intelByBeach.set(row.beach_id, row);
      }
    }

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const targetMinutes = now.getHours() * 60 + now.getMinutes();

    const { data: forecastRows, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select(
        "beach_id, forecast_time, wave_height, wave_direction, wind_speed, wind_direction, tide_height, tide_status"
      )
      .eq("forecast_date", currentDate)
      .in("beach_id", beachIds)
      .order("forecast_time", { ascending: true })
      .limit(beachIds.length * 24);

    if (forecastError) {
      console.warn("[getBestBeachesNearHome] Failed to load forecast rows", forecastError);
    }

    const forecastsByBeach = new Map<string, ForecastSnapshot[]>();
    for (const row of (forecastRows as ForecastSnapshot[] | null) ?? []) {
      const list = forecastsByBeach.get(row.beach_id) ?? [];
      list.push(row);
      forecastsByBeach.set(row.beach_id, list);
    }

    for (const list of forecastsByBeach.values()) {
      list.sort((a, b) => {
        const aMinutes = timeStringToMinutes(a.forecast_time) ?? Number.POSITIVE_INFINITY;
        const bMinutes = timeStringToMinutes(b.forecast_time) ?? Number.POSITIVE_INFINITY;
        return aMinutes - bMinutes;
      });
    }

    const recommendations: BeachRecommendation[] = [];

    let processed = 0;
    for (const nearby of nearbyBeaches) {
      const details = beachDetails?.find((beach) => beach.id === nearby.id) as Beach | undefined;
      if (!details) continue;

      const intel = intelByBeach.get(nearby.id) ?? null;
      const forecast = pickBestForecast(forecastsByBeach.get(nearby.id), targetMinutes);

      if (!intel && !forecast) {
        console.log("[getBestBeachesNearHome] Skipping beach (no intel/forecast):", nearby.id);
        continue;
      }

      const waveHeight = intel
        ? formatSurfHeight(
            intel.surf_min_ft,
            intel.surf_max_ft,
            intel.surf_description,
            forecast?.wave_height ?? null
          )
        : formatSurfHeight(null, null, null, forecast?.wave_height ?? null);

      const waveDirection =
        intel?.primary_swell_direction_text ||
        (intel?.primary_swell_direction_deg != null
          ? getDirectionAbbrev(String(intel.primary_swell_direction_deg))
          : null) ||
        (forecast?.wave_direction ? getDirectionAbbrev(forecast.wave_direction) : "—");

      const windSpeedMph =
        intel?.wind_speed_mph ?? toNumber(forecast?.wind_speed);

      const windDirectionText =
        intel?.wind_direction_text ||
        (intel?.wind_direction_deg != null
          ? getDirectionAbbrev(String(intel.wind_direction_deg))
          : null) ||
        (forecast?.wind_direction ? getDirectionAbbrev(forecast.wind_direction) : null);

      const tideHeight =
        intel?.tide_height_ft ?? toNumber(forecast?.tide_height);

      const tideStatus = intel?.tide_status || forecast?.tide_status || "Steady";

      const windDescription =
        intel?.wind_description ||
        (windSpeedMph != null && windDirectionText
          ? getWindDescription(
              windSpeedMph,
              windDirectionText,
              details.wind_offshore_deg
            )
          : "Calm");

      const waveDirectionDeg =
        intel?.primary_swell_direction_deg ??
        toDirectionDegrees(forecast?.wave_direction);

      const windDirectionDeg =
        intel?.wind_direction_deg ??
        toDirectionDegrees(forecast?.wind_direction);

      const windSpeedKts =
        windSpeedMph != null ? windSpeedMph * 0.868976 : null;

      const tideFt = tideHeight ?? null;

      const { score, reasons } = scoreRecommendation(details as Beach, {
        wave_direction_deg: waveDirectionDeg ?? undefined,
        wind_direction_deg: windDirectionDeg ?? undefined,
        wind_speed_kts: windSpeedKts ?? undefined,
        tide_ft: tideFt ?? undefined,
        user_skill: profile?.experience_level ?? null,
      });

      const intelScore =
        intel?.conditions_score != null && Number.isFinite(intel.conditions_score)
          ? Number(intel.conditions_score)
          : null;

      const finalScore = intelScore ?? score;

      const reasonsWithIntel = [...reasons];
      if (intelScore != null) {
        reasonsWithIntel.push("intel_score");
        if (intel?.confidence) {
          reasonsWithIntel.push(
            `intel_confidence_${intel.confidence.toLowerCase()}`
          );
        }
      }

      const crowdLevel = getCrowdLevel(details.name);

      const roundedTide =
        tideHeight != null ? Math.round(tideHeight * 10) / 10 : 0;

      processed += 1;

      const recommendation: BeachRecommendation = {
        id: nearby.id,
        name: details.name,
        location: details.city ?? nearby.city ?? "",
        distance_miles: toDistanceMilesString(nearby.distance_meters),
        score: Math.round(finalScore),
        reasons: reasonsWithIntel,
        image_url: beachPhotoMap.get(nearby.id) ?? null,
        wave_height: waveHeight,
        wave_direction: waveDirection,
        wind_speed: windSpeedMph != null ? Math.round(windSpeedMph) : 0,
        wind_description: windDescription,
        tide_status: tideStatus,
        tide_height: roundedTide,
        skill_level: details.skill_level || "Intermediate",
        crowd_level: crowdLevel,
        is_hidden_gem: finalScore >= 70 && crowdLevel === "Uncrowded",
      };

      recommendations.push(recommendation);
    }

    console.log("[getBestBeachesNearHome] ✅ Recommendations generated:", processed);
    console.log("[getBestBeachesNearHome] Top scores:", recommendations.slice(0, 4).map(r => ({ name: r.name, score: r.score })));

    recommendations.sort((a, b) => b.score - a.score);

    const finalResult = {
      success: true,
      data: recommendations.slice(0, 4),
    };

    console.log("[getBestBeachesNearHome] 🎯 Returning result:", { success: finalResult.success, count: finalResult.data.length });

    return finalResult;
  } catch (error) {
    console.error("[getBestBeachesNearHome] ❌ Unexpected error:", error);
    return { success: false, error: String(error), data: [] as BeachRecommendation[] };
  }
}
