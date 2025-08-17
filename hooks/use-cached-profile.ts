"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Profile, Beach } from "@/types/database";

interface CachedProfileData {
  profile: Profile | null;
  defaultBeach: Beach | null;
  timestamp: number;
}

const CACHE_KEY = "quiver_profile_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for managing cached profile and default beach data
 * Persists data in localStorage to prevent flickering on navigation
 */
export function useCachedProfile() {
  const { user } = useAuth();
  const [cachedData, setCachedData] = useState<CachedProfileData | null>(null);

  // Load cached data on mount
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedData: CachedProfileData = JSON.parse(cached);
        const isExpired = Date.now() - parsedData.timestamp > CACHE_DURATION;

        if (!isExpired) {
          console.log("🔄 Using cached profile data:", {
            hasProfile: !!parsedData.profile,
            hasDefaultBeach: !!parsedData.defaultBeach,
            age: Math.round((Date.now() - parsedData.timestamp) / 1000) + "s",
          });
          setCachedData(parsedData);
        } else {
          console.log("⏰ Cached profile data expired, will refetch");
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn("Failed to load cached profile data:", error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, [user?.id]);

  // Fetch profile and default beach data
  const fetchProfileAndDefaultBeach = useCallback(async () => {
    if (!user?.id) {
      // Clear cache if no user
      localStorage.removeItem(CACHE_KEY);
      return { profile: null, defaultBeach: null };
    }

    try {
      // Get profile directly
      const { getProfile } = await import("@/actions/profile-actions");
      const profileResult = await getProfile(user.id);

      if (!profileResult.success || !profileResult.data) {
        console.log("❌ No profile found");
        return { profile: null, defaultBeach: null };
      }

      const profile = profileResult.data;
      console.log("✅ Profile loaded:", {
        id: profile.id,
        favoriteSpot: profile.favorite_spot,
        defaultBeachId: profile.default_beach_id,
      });

      let defaultBeach: Beach | null = null;

      // Prefer top-ranked favorite beach
      try {
        const { getTopFavoriteBeach } = await import("@/actions/beach-actions");
        const topFav = await getTopFavoriteBeach(user.id);
        if (topFav) {
          defaultBeach = topFav as Beach;
          console.log("✅ Using top-ranked favorite beach as default:", defaultBeach.name);
        }
      } catch (e) {
        // Non-fatal
      }

      // Find default beach using favorite_spot (legacy field)
      if (profile.favorite_spot) {
        console.log("🏖️ Looking up favorite_spot:", profile.favorite_spot);

        const { getBeaches } = await import("@/actions/beach-actions");
        const beachesResult = await getBeaches();

        if (beachesResult.success && beachesResult.data) {
          const favoriteSpotLower = profile.favorite_spot.toLowerCase();
          const matchingBeach = beachesResult.data.find(
            (beach) =>
              beach.name.toLowerCase() === favoriteSpotLower ||
              beach.name.toLowerCase().includes(favoriteSpotLower) ||
              favoriteSpotLower.includes(beach.name.toLowerCase())
          );

          if (matchingBeach) {
            console.log("✅ Found default beach:", matchingBeach.name);
            defaultBeach = matchingBeach;
          }
        }
      }

      // Fallback to default_beach_id
      if (!defaultBeach && profile.default_beach_id) {
        const { getBeach } = await import("@/actions/beach-actions");
        const beachResult = await getBeach(profile.default_beach_id);
        if (beachResult.success && beachResult.data) {
          defaultBeach = beachResult.data;
          console.log("✅ Found default beach by ID:", defaultBeach.name);
        }
      }

      const result = { profile, defaultBeach };

      // Cache the result
      const cacheData: CachedProfileData = {
        ...result,
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        console.log("💾 Cached profile data");
      } catch (error) {
        console.warn("Failed to cache profile data:", error);
      }

      setCachedData(cacheData);
      return result;
    } catch (error) {
      console.error("Error fetching profile and default beach:", error);
      return { profile: null, defaultBeach: null };
    }
  }, [user?.id]);

  const {
    data: freshData,
    loading: profileLoading,
    error: profileError,
    refetch,
  } = useDataFetcher(fetchProfileAndDefaultBeach, {
    // Skip initial fetch if we have valid cached data
    skip: !!cachedData && !!user?.id,
  });

  // Use cached data if available, otherwise use fresh data
  const profile = cachedData?.profile || freshData?.profile || null;
  const defaultBeach =
    cachedData?.defaultBeach || freshData?.defaultBeach || null;

  // Clear cache function for when profile is updated
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setCachedData(null);
  }, []);

  // Refresh function that clears cache and refetches
  const refreshProfile = useCallback(() => {
    clearCache();
    refetch();
  }, [clearCache, refetch]);

  return {
    profile,
    defaultBeach,
    profileLoading,
    profileError,
    refreshProfile,
    clearCache,
    hasCachedData: !!cachedData,
  };
}
