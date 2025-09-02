"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Profile, Beach } from "@/types/database";

interface CachedProfileData {
  profile: Profile | null;
  homeBeach: Beach | null;
  // Backward compat: older cache may store `defaultBeach`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultBeach?: any;
  timestamp: number;
}

const CACHE_KEY = "quiver_profile_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for managing cached profile and home beach data
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
            hasHomeBeach: !!(parsedData.homeBeach || (parsedData as any).defaultBeach),
            age: Math.round((Date.now() - parsedData.timestamp) / 1000) + "s",
          });
          // Backward compat: migrate defaultBeach -> homeBeach in-memory
          if (!parsedData.homeBeach && (parsedData as any).defaultBeach) {
            (parsedData as any).homeBeach = (parsedData as any).defaultBeach;
            delete (parsedData as any).defaultBeach;
          }
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

  // Fetch profile and home beach data
  const fetchProfileAndDefaultBeach = useCallback(async () => {
    if (!user?.id) {
      // Clear cache if no user
      localStorage.removeItem(CACHE_KEY);
      return { profile: null, homeBeach: null };
    }

    try {
      // Get profile directly
      const { getProfile } = await import("@/actions/profile-actions");
      const profileResult = await getProfile(user.id);

      if (!profileResult.success || !profileResult.data) {
        console.log("❌ No profile found");
        return { profile: null, homeBeach: null };
      }

      const profile = profileResult.data;
      console.log("✅ Profile loaded:", {
        id: profile.id,
        favoriteSpot: profile.favorite_spot,
        homeBeachId: profile.home_beach_id,
      });

      let homeBeach: Beach | null = null;

      // Prefer top-ranked favorite beach
      try {
        const { getTopFavoriteBeach } = await import("@/actions/beach-actions");
        const topFav = await getTopFavoriteBeach(user.id);
        if (topFav) {
          homeBeach = topFav as Beach;
          console.log("✅ Using top-ranked favorite beach as home beach:", homeBeach.name);
        }
      } catch (e) {
        // Non-fatal
      }

      // Resolve strictly via home_beach_id
      if (profile.home_beach_id) {
        const { getBeachById } = await import("@/actions/beach-actions");
        const beachResult = await getBeachById(profile.home_beach_id);
        if (beachResult.success && beachResult.data) {
          homeBeach = beachResult.data;
          console.log("✅ Found home beach by ID:", homeBeach.name);
        }
      }

      const result = { profile, homeBeach };

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
      console.error("Error fetching profile and home beach:", error);
      return { profile: null, homeBeach: null } as any;
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
  const homeBeach =
    (cachedData?.homeBeach || (cachedData as any)?.defaultBeach) ||
    (freshData as any)?.homeBeach || null;

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
    homeBeach,
    profileLoading,
    profileError,
    refreshProfile,
    clearCache,
    hasCachedData: !!cachedData,
  };
}
