"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/auth-context";
import type { Profile, Beach } from "@/types/database";

/**
 * ProfileContext provides global profile and home beach state management
 *
 * Features:
 * - localStorage caching with 5-minute TTL
 * - Request deduplication to prevent duplicate API calls
 * - Automatic refresh on onboarding completion
 * - Optimistic updates for better UX
 *
 * Replaces:
 * - lib/hooks/useProfile.ts (request deduplication)
 * - hooks/use-cached-profile.ts (localStorage caching)
 */

export interface ProfileContextValue {
  profile: Profile | null;
  homeBeach: Beach | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (profile: Profile) => void;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(
  undefined
);

interface CachedProfileData {
  profile: Profile | null;
  homeBeach: Beach | null;
  timestamp: number;
}

const CACHE_KEY_PREFIX = "quiver_profile_cache_";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REQUEST_TTL = 30000; // 30 seconds for request deduplication

// Request deduplication cache to prevent duplicate API calls
const profileRequestCache = new Map<
  string,
  Promise<{ profile: Profile | null; homeBeach: Beach | null }>
>();

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [homeBeach, setHomeBeach] = useState<Beach | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cachedData, setCachedData] = useState<CachedProfileData | null>(null);

  // Prevent race conditions during initialization
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  // Helper to get user-specific cache key
  const getCacheKey = useCallback(() => {
    return user?.id ? `${CACHE_KEY_PREFIX}${user.id}` : null;
  }, [user?.id]);

  // Load cached data on mount
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    const cacheKey = getCacheKey();
    if (!cacheKey) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData: CachedProfileData = JSON.parse(cached);
        const isExpired = Date.now() - parsedData.timestamp > CACHE_DURATION;

        // Validate that the cached profile belongs to the current user
        const isCorrectUser = parsedData.profile?.id === user.id;

        if (!isExpired && isCorrectUser) {
          setCachedData(parsedData);
          setProfile(parsedData.profile);
          setHomeBeach(parsedData.homeBeach);
          setIsLoading(false);
          // Don't return here - we want to continue to set up state
          // but we can set the loading state immediately
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn("Failed to load cached profile data:", error);
      localStorage.removeItem(cacheKey);
    }
  }, [user?.id, getCacheKey]);

  // Fetch profile and home beach data with request deduplication
  const fetchProfileAndHomeBeach = useCallback(async () => {
    if (!user?.id) {
      const cacheKey = getCacheKey();
      if (cacheKey) localStorage.removeItem(cacheKey);

      setProfile(null);
      setHomeBeach(null);
      setIsLoading(false);

      return { profile: null, homeBeach: null };
    }

    const requestCacheKey = `profile-${user.id}`;

    // Return existing in-flight request to prevent duplicates
    if (profileRequestCache.has(requestCacheKey)) {
      return profileRequestCache.get(requestCacheKey)!;
    }

    const requestPromise = (async () => {
      try {

        // Get profile
        const profileResponse = await fetch(`/api/users/${user.id}/profile`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!profileResponse.ok) {
          return { profile: null, homeBeach: null };
        }

        const profileJson = await profileResponse.json().catch(() => null);
        const profileData = (profileJson?.data as Profile | undefined) ?? null;

        if (!profileData) {
          return { profile: null, homeBeach: null };
        }

        let homeBeachData: Beach | null = null;

        // Resolve home beach if profile has home_beach_id
        if (profileData.home_beach_id) {
          try {
            const beachResponse = await fetch(
              `/api/beaches/${profileData.home_beach_id}`,
              {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
              }
            );

            if (beachResponse.ok) {
              const beachJson = await beachResponse.json().catch(() => null);
              homeBeachData = (beachJson?.data?.beach as Beach | undefined) ?? null;
            }
          } catch (e) {
            // Continue without homeBeach; do not fail profile load here.
          }
        }

        const result = { profile: profileData, homeBeach: homeBeachData };

        // Cache the result
        const cacheData: CachedProfileData = {
          ...result,
          timestamp: Date.now(),
        };

        try {
          const cacheKey = getCacheKey();
          if (cacheKey) {
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          }
        } catch (error) {
          console.warn("Failed to cache profile data:", error);
        }

        // Only update state if component is still mounted
        if (mountedRef.current) {
          setCachedData(cacheData);
          setProfile(profileData);
          setHomeBeach(homeBeachData);
          setError(null);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        console.error("Error fetching profile and home beach:", error);

        if (mountedRef.current) {
          setError(error);
        }

        return { profile: null, homeBeach: null };
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    // Cache the promise
    profileRequestCache.set(requestCacheKey, requestPromise);

    // Clear cache after TTL
    setTimeout(() => {
      profileRequestCache.delete(requestCacheKey);
    }, REQUEST_TTL);

    return requestPromise;
  }, [user?.id, getCacheKey]);

  // Initial fetch on mount or when user changes
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setHomeBeach(null);
      setIsLoading(false);
      return;
    }

    // Skip initial fetch if we have valid cached data
    if (cachedData && cachedData.profile && cachedData.profile.id === user.id) {
      // Ensure loading is false if we have cached data
      setIsLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setIsLoading(true);

    fetchProfileAndHomeBeach().finally(() => {
      initializingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchProfileAndHomeBeach]); // Removed cachedData to prevent re-fetch loops

  // Clear cache function
  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey();
    if (cacheKey) localStorage.removeItem(cacheKey);
    setCachedData(null);
  }, [getCacheKey]);

  // Refresh function that clears cache and refetches
  const refreshProfile = useCallback(async () => {
    clearCache();
    setIsLoading(true);
    await fetchProfileAndHomeBeach();
  }, [clearCache, fetchProfileAndHomeBeach]);

  // Optimistic update for immediate UI feedback
  const updateProfile = useCallback(
    (updatedProfile: Profile) => {
      setProfile(updatedProfile);

      // Update cache with new profile data
      const cacheData: CachedProfileData = {
        profile: updatedProfile,
        homeBeach,
        timestamp: Date.now(),
      };

      try {
        const cacheKey = getCacheKey();
        if (cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          setCachedData(cacheData);
        }
      } catch (error) {
        console.warn("Failed to update cached profile data:", error);
      }
    },
    [homeBeach, getCacheKey]
  );

  // Listen for onboarding completion to refresh data immediately
  useEffect(() => {
    const handleOnboardingComplete = () => {
      refreshProfile();
    };

    window.addEventListener("onboarding_completed", handleOnboardingComplete);
    return () => {
      window.removeEventListener(
        "onboarding_completed",
        handleOnboardingComplete
      );
    };
  }, [refreshProfile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      profile,
      homeBeach,
      isLoading,
      error,
      updateProfile,
      refreshProfile,
    }),
    [profile, homeBeach, isLoading, error, updateProfile, refreshProfile]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const context = useContext(ProfileContext);

  if (context === undefined) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }

  return context;
}
