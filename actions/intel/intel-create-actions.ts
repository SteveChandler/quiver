"use server";

import { revalidatePath } from "next/cache";
import { getExpiryDate } from "@/lib/constants/intel";
import type { ActionResult } from "@/lib/action-utils";
import type { CreateIntelPostData } from "@/types/intel";
import type { IntelPostWithUser } from "@/types/database";
import {
  withAuthenticatedAction,
  type ServerActionResponse,
} from "@/lib/server-action-utils";
import {
  createIntelDedupeHash,
  DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
} from "@/lib/utils/intel-dedupe";
import type { IntelDeps } from "./intel-types";
import {
  toMetricWaveHeight,
  toMetricWindSpeed,
  toMetricWaterTemp,
  toWindDirectionDegreesFallback,
  parseNullableNumber,
  shouldFallbackToConditionReports,
} from "./intel-types";

export async function createIntelPost(
  data: CreateIntelPostData,
  deps?: IntelDeps
): Promise<ActionResult<IntelPostWithUser>> {
  try {
    const authWrapper = deps?.authWrapper ?? withAuthenticatedAction;

    const response = await authWrapper(async (user, supabase) => {
      const {
        lat,
        lon,
        beach_id,
        tag,
        title,
        description,
        photo_url,
        photo_storage_path,
        wave_height,
        wind_speed,
        wind_direction,
        water_temp,
        crowd_level,
        wave_types,
        forecast_accuracy,
      } = data;

      const sanitizedTitle = title?.trim() ?? "";
      const sanitizedDescription = description?.trim() ?? "";

      if (
        typeof lat !== "number" ||
        Number.isNaN(lat) ||
        typeof lon !== "number" ||
        Number.isNaN(lon) ||
        !tag ||
        sanitizedTitle.length === 0 ||
        sanitizedDescription.length === 0
      ) {
        return {
          success: false,
          error:
            "Missing required fields: lat, lon, tag, title, description",
        };
      }

      const expiryDate = getExpiryDate(tag);

      let normalizedBeachId = beach_id?.trim() || null;

      // Prefer explicit beach_id but fall back to nearest beach from geo lookup
      if (!normalizedBeachId) {
        const { data: nearbyBeaches, error: nearestError } = await supabase.rpc(
          "get_nearby_beaches",
          {
            input_lat: lat,
            input_lng: lon,
            limit_count: 1,
          }
        );

        if (nearestError) {
          console.error("Nearest beach lookup failed:", nearestError);
          return {
            success: false,
            error: "Unable to determine nearest beach for intel post",
          };
        }

        normalizedBeachId = nearbyBeaches?.[0]?.id ?? null;
      }

      if (!normalizedBeachId) {
        return {
          success: false,
          error: "Unable to determine a beach for this intel post",
        };
      }

      const dedupeWindowStart = new Date(
        Date.now() - DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES * 60 * 1000
      ).toISOString();

      const dedupeHash = createIntelDedupeHash({
        userId: user.id,
        tag,
        beachId: normalizedBeachId,
        title: sanitizedTitle,
        description: sanitizedDescription,
        latitude: lat,
        longitude: lon,
      });

      const { data: recentIntel, error: recentIntelError } = await supabase
        .from("intel_posts")
        .select("id, title, description, latitude, longitude, created_at")
        .eq("user_id", user.id)
        .eq("tag", tag)
        .eq("beach_id", normalizedBeachId)
        .gte("created_at", dedupeWindowStart)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentIntelError) {
        console.error("Failed to check for duplicate intel posts:", {
          error: recentIntelError,
          userId: user.id,
          tag,
          beachId: normalizedBeachId,
        });
      } else {
        const duplicateMatch = recentIntel?.find((existing) => {
          const existingHash = createIntelDedupeHash({
            userId: user.id,
            tag,
            beachId: normalizedBeachId,
            title: existing.title,
            description: existing.description,
            latitude: existing.latitude,
            longitude: existing.longitude,
          });
          return existingHash === dedupeHash;
        });

        if (duplicateMatch) {
          console.warn("Blocked duplicate intel post submission", {
            userId: user.id,
            tag,
            beachId: normalizedBeachId,
            recentPostId: duplicateMatch.id,
            dedupeWindowMinutes: DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
          });

          return {
            success: false,
            error:
              "Looks like you've already shared this intel recently. Try updating the existing post instead of creating a duplicate.",
          };
        }
      }

      // Normalize optional surf condition inputs into JSONB
      const surfConditions: Record<string, string | number | string[] | null> = {};
      if (wave_height !== undefined && wave_height !== null)
        surfConditions.wave_height = wave_height;
      if (wind_speed !== undefined && wind_speed !== null)
        surfConditions.wind_speed = wind_speed;
      if (wind_direction !== undefined && wind_direction !== null)
        surfConditions.wind_direction = wind_direction;
      if (water_temp !== undefined && water_temp !== null)
        surfConditions.water_temp = water_temp;
      if (crowd_level !== undefined && crowd_level !== null)
        surfConditions.crowd_level = crowd_level;
      if (wave_types && Array.isArray(wave_types) && wave_types.length > 0)
        surfConditions.wave_types = wave_types;
      if (forecast_accuracy !== undefined && forecast_accuracy !== null)
        surfConditions.forecast_accuracy = forecast_accuracy;

      const { data: intelPost, error: createError } = await supabase
        .from("intel_posts")
        .insert({
          user_id: user.id,
          beach_id: normalizedBeachId,
          latitude: lat,
          longitude: lon,
          tag,
          title: sanitizedTitle,
          description: sanitizedDescription,
          photo_url,
          photo_storage_path,
          expires_at: expiryDate.toISOString(),
          is_active: true,
          dedupe_hash: dedupeHash,
          surf_conditions: Object.keys(surfConditions).length
            ? surfConditions
            : null,
        })
        .select()
        .single();

      let createdIntelPost = intelPost;
      let intelError = createError;

      if (intelError && shouldFallbackToConditionReports(intelError)) {
        console.warn(
          "intel_posts insert failed, attempting condition_reports fallback",
          intelError
        );

        const conditionPayload = {
          beach_id: normalizedBeachId,
          reporter_id: user.id,
          reported_at: new Date().toISOString(),
          kind: "intel" as const,
          latitude: lat,
          longitude: lon,
          tag,
          title: sanitizedTitle,
          description: sanitizedDescription,
          photo_url,
          photo_storage_path,
          wave_height_m: toMetricWaveHeight(wave_height ?? null),
          wind_speed_ms: toMetricWindSpeed(wind_speed ?? null),
          wind_direction_deg: toWindDirectionDegreesFallback(wind_direction),
          water_temp_c: toMetricWaterTemp(water_temp ?? null),
          crowd_level: parseNullableNumber(crowd_level),
          forecast_accuracy: forecast_accuracy ?? null,
        };

        const { data: fallbackReport, error: fallbackError } = await (supabase as any)
          .from("condition_reports")
          .insert(conditionPayload)
          .select("id")
          .single();

        if (fallbackError || !fallbackReport?.id) {
          console.error(
            "Condition reports fallback insert failed:",
            fallbackError || intelError
          );
          return { success: false, error: "Failed to create intel post" };
        }

        const { data: fetchedIntel, error: fetchFallbackError } = await supabase
          .from("intel_posts")
          .select("*")
          .eq("id", fallbackReport.id)
          .single();

        if (fetchFallbackError || !fetchedIntel) {
          console.error(
            "Failed to load intel post after fallback insert:",
            fetchFallbackError
          );
          return { success: false, error: "Failed to create intel post" };
        }

        const { error: updateFallbackHashError } = await supabase
          .from("intel_posts")
          .update({ dedupe_hash: dedupeHash })
          .eq("id", fallbackReport.id);

        if (updateFallbackHashError) {
          console.error("Failed to persist dedupe hash after fallback insert:", {
            error: updateFallbackHashError,
            intelId: fallbackReport.id,
          });
        }

        createdIntelPost = fetchedIntel;
        intelError = null;
      }

      if (intelError || !createdIntelPost) {
        console.error("Error creating intel post:", intelError);
        return { success: false, error: "Failed to create intel post" };
      }

      if (!createdIntelPost?.beach_id) {
        console.error(
          "Intel post created without beach_id despite guard",
          createdIntelPost
        );
        return {
          success: false,
          error: "Intel post missing beach association",
        };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      const enrichedPost: IntelPostWithUser = {
        ...createdIntelPost,
        user: {
          full_name: profile?.full_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_has_confirmed: false,
      };

      revalidatePath("/");

      try {
        const track = deps?.trackXP
          ? deps.trackXP
          : (await import("@/lib/gamification")).trackXP;
        await track("post_beach_intel", createdIntelPost.id, "intel_post");
      } catch (xpErr) {
        console.warn("XP tracking failed for intel post:", xpErr);
      }

      // Fire-and-forget milestone check (first_intel_posted, local_authority)
      import("@/lib/services/personalization-milestone-service")
        .then(({ checkAndRecordMilestones }) => checkAndRecordMilestones(user.id))
        .catch(() => {});

      return {
        success: true,
        data: enrichedPost,
      } as ActionResult<IntelPostWithUser>;
    });

    if (!response) {
      return {
        success: false,
        error: "Failed to create intel post",
      };
    }

    // Normalise the response to an ActionResult regardless of wrapper shape
    const looksLikeServerActionResult =
      typeof response === "object" &&
      response !== null &&
      "success" in response &&
      ("data" in response || "error" in response);

    if (!looksLikeServerActionResult) {
      return {
        success: false,
        error: "Unexpected response from intel post action",
      };
    }

    const serverResult = response as ActionResult<IntelPostWithUser> | (ServerActionResponse<ActionResult<IntelPostWithUser>>);

    if ("data" in serverResult && serverResult?.data && typeof serverResult.data === "object" && "success" in serverResult.data) {
      return serverResult.data as ActionResult<IntelPostWithUser>;
    }

    return serverResult as ActionResult<IntelPostWithUser>;
  } catch (error) {
    console.error("Error in createIntelPost:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create intel post",
    };
  }
}
