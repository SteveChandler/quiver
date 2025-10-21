"use server";

import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import {
  getWindDirectionDegrees,
  getDirectionAbbrev,
  getWindDescription,
  getCrowdLevel,
} from "@/lib/utils/beach-conditions-utils";

/**
 * Get the best nearby beaches based on current conditions
 * Returns up to 4 beaches within 10 miles of user's home beach,
 * scored and ranked by surf conditions
 */
export const getBestNearbyBeaches = withAuthenticatedAction(
  async (user, supabase) => {
    const userId = user.id;
    console.log("[getBestNearbyBeaches] Starting for user:", userId);

    // 1. Get user's home beach
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", userId)
      .single();

    console.log("[getBestNearbyBeaches] Profile:", profile);

    if (!profile?.home_beach_id) {
      console.log("[getBestNearbyBeaches] No home beach set");
      return { success: true, data: [] };
    }

    // 2. Get home beach coordinates
    const { data: homeBeach } = await supabase
      .from("beaches")
      .select("latitude, longitude")
      .eq("id", profile.home_beach_id)
      .single();

    console.log("[getBestNearbyBeaches] Home beach:", homeBeach);

    if (!homeBeach) {
      console.log("[getBestNearbyBeaches] Home beach not found");
      return { success: true, data: [] };
    }

    // 3. Get nearby beaches within 10 miles (16,093 meters)
    const { data: nearbyBeaches } = await supabase.rpc("get_nearby_beaches", {
      lat: homeBeach.latitude,
      lng: homeBeach.longitude,
      max_distance_meters: 16093,
      limit_count: 20,
    });

    console.log("[getBestNearbyBeaches] Nearby beaches count:", nearbyBeaches?.length);

    if (!nearbyBeaches || nearbyBeaches.length === 0) {
      console.log("[getBestNearbyBeaches] No nearby beaches found");
      return { success: true, data: [] };
    }

    const beachIds = nearbyBeaches.map((b: any) => b.id);

    // 4. Get current forecast for each beach
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentHour = now.getHours();
    const currentTime = `${currentHour.toString().padStart(2, "0")}:00:00`;

    // Get forecasts for current hour (or next available hour)
    const { data: forecasts } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .in("beach_id", beachIds)
      .eq("forecast_date", currentDate)
      .gte("forecast_time", currentTime)
      .order("forecast_time", { ascending: true })
      .limit(20);

    // 5. Get beach full details including preferences
    const { data: beachDetails } = await supabase
      .from("beaches")
      .select("*")
      .in("id", beachIds);

    // 6. Get latest community photo for each beach
    const { data: allCommunityPhotos } = await supabase
      .from("session_media")
      .select("id, storage_path, session:sessions!inner(beach_id)")
      .eq("media_type", "image")
      .in("session.beach_id", beachIds)
      .order("created_at", { ascending: false });

    // Group photos by beach_id (first photo per beach)
    const photosByBeach = new Map<string, string>();
    if (allCommunityPhotos) {
      for (const photo of allCommunityPhotos) {
        const beachId = (photo.session as any).beach_id;
        if (!photosByBeach.has(beachId)) {
          const { data: publicUrl } = supabase.storage
            .from("session-media")
            .getPublicUrl(photo.storage_path);
          photosByBeach.set(beachId, publicUrl.publicUrl);
        }
      }
    }

    // 7. Score each beach and build response
    const scoredBeaches = nearbyBeaches
      .map((beach: any) => {
        const details = beachDetails?.find((b) => b.id === beach.id);
        const forecast = forecasts?.find((f) => f.beach_id === beach.id);

        if (!details || !forecast) return null;

        // Get community photo or fallback to beach default
        const imageUrl = photosByBeach.get(beach.id) || details.image_url;

        // Parse forecast data (all fields are text in enhanced_forecasts)
        const waveHeightText = forecast.wave_height || "0 ft";
        const waveHeight = parseFloat(waveHeightText);
        const windSpeedText = forecast.wind_speed || "0 mph";
        const windSpeed = parseFloat(windSpeedText);
        const windDirection = forecast.wind_direction || "W";
        const tideHeightText = forecast.tide_height || "0";
        const tideHeight = parseFloat(tideHeightText);
        const waveDirectionText = forecast.wave_direction || "270";
        const swellDirection = parseFloat(waveDirectionText);

        // Score the beach using existing scorer
        const score = scoreRecommendation(details, {
          wave_direction_deg: swellDirection,
          wind_direction_deg: getWindDirectionDegrees(windDirection),
          wind_speed_kts: windSpeed * 0.868976, // mph to knots
          tide_ft: tideHeight,
          user_skill: null, // Use default
        });

        const crowdLevel = getCrowdLevel(details.name);

        return {
          id: beach.id,
          name: beach.name,
          location: beach.location,
          distance_miles: (beach.distance_meters / 1609.34).toFixed(1),
          score: score.score,
          reasons: score.reasons,
          image_url: imageUrl,

          // Current conditions
          wave_height: waveHeightText,
          wave_direction: getDirectionAbbrev(waveDirectionText),
          wind_speed: Math.round(windSpeed),
          wind_description: getWindDescription(
            windSpeed,
            windDirection,
            details.wind_offshore_deg
          ),
          tide_status: forecast.tide_status || "Mid tide",
          tide_height: tideHeight,

          // Metadata
          skill_level: details.skill_level || "Intermediate",
          crowd_level: crowdLevel,
          is_hidden_gem: score.score >= 70 && crowdLevel === "Uncrowded",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 4);

    console.log("[getBestNearbyBeaches] Returning beaches:", scoredBeaches.length);
    console.log("[getBestNearbyBeaches] Beach scores:", scoredBeaches.map((b: any) => ({ name: b.name, score: b.score })));

    return { success: true, data: scoredBeaches };
  }
);
