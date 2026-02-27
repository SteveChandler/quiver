"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Profile, Beach } from "@/types/database";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";

interface CachedProfileData {
  profile: Profile | null;
  homeBeach: Beach | null;
  // Backward compat: older cache may store `defaultBeach`
   
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
      const cached = safeGetItem(CACHE_KEY);
      if (cached) {
        const parsedData: CachedProfileData = JSON.parse(cached);
        const isExpired = Date.now() - parsedData.timestamp > CACHE_DURATION;

        if (!isExpired) {
          // Backward compat: migrate defaultBeach -> homeBeach in-memory
          if (!parsedData.homeBeach && (parsedData as any).defaultBeach) {
            (parsedData as any).homeBeach = (parsedData as any).defaultBeach;
            delete (parsedData as any).defaultBeach;
          }
          setCachedData(parsedData);
        } else {
          safeRemoveItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn("Failed to load cached profile data:", error);
      safeRemoveItem(CACHE_KEY);
    }
  }, [user?.id]);

  // Fetch profile and home beach data
  const fetchProfileAndDefaultBeach = useCallback(async () => {
    if (!user?.id) {
      // Clear cache if no user
      safeRemoveItem(CACHE_KEY);
      return { profile: null, homeBeach: null };
    }

    try {
      const { getProfileWithHomeBeach } = await import("@/actions/profile-actions");
      const result = await getProfileWithHomeBeach(user.id);

      if (!result.success || !result.data) {
        return { profile: null, homeBeach: null };
      }

      const { profile, homeBeach } = result.data;
      const resultData = { profile, homeBeach };

      // Cache the result
      const cacheData: CachedProfileData = {
        ...resultData,
        timestamp: Date.now(),
      };

      safeSetItem(CACHE_KEY, JSON.stringify(cacheData));
      setCachedData(cacheData);
      return resultData;
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
    safeRemoveItem(CACHE_KEY);
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
