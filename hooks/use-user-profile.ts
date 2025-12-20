"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getProfile } from "@/actions/profile-actions";
import type { Profile } from "@/types/database";

interface UseUserProfileOptions {
  userId?: string;
  enabled?: boolean;
  timeout?: number;
}

interface UseUserProfileReturn {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Request deduplication cache for profile requests
const profileRequestCache = new Map<string, Promise<any>>();
const PROFILE_CACHE_TTL = 30000; // 30 seconds
const DEFAULT_TIMEOUT = 20000; // 20 seconds

export function useUserProfile({
  userId,
  enabled = true,
  timeout = DEFAULT_TIMEOUT,
}: UseUserProfileOptions): UseUserProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProfileWithTimeout = useCallback(
    async (userIdToFetch: string) => {
      // Check cache first for request deduplication
      const cacheKey = `profile-${userIdToFetch}`;

      if (profileRequestCache.has(cacheKey)) {
        return profileRequestCache.get(cacheKey);
      }

      // Create timeout promise
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Profile loading timeout")),
          timeout
        );
      });

      // Create profile fetch promise
      const profilePromise = getProfile(userIdToFetch);

      // Race between timeout and profile fetch
      const requestPromise = Promise.race([profilePromise, timeoutPromise])
        .finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        })
        .catch((err) => {
          // Don't let timeouts (or other transient failures) poison the dedupe cache
          profileRequestCache.delete(cacheKey);
          throw err;
        });

      // Cache the promise
      profileRequestCache.set(cacheKey, requestPromise);

      // Clear cache after TTL
      setTimeout(() => {
        profileRequestCache.delete(cacheKey);
      }, PROFILE_CACHE_TTL);

      return requestPromise;
    },
    [timeout]
  );

  const loadProfile = useCallback(
    async (userIdToLoad: string) => {
      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const result = await fetchProfileWithTimeout(userIdToLoad);

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (result.success && "data" in result && result.data) {
          setProfile(result.data as Profile);
          setError(null);
        } else {
          if ("isConnectionError" in result && result.isConnectionError) {
            setError(
              "Connection to the database failed. Please try again later."
            );
          } else {
            setError(result.error || "Failed to load profile");
          }
          setProfile(null);
        }
      } catch (err) {
        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (err instanceof Error) {
          if (err.message.includes("timeout")) {
            // Timeouts can happen on cold starts; treat as a degraded-path (avoid console.error)
            console.warn("Profile loading timeout:", err.message);
            setError("Profile loading timed out. Please try again.");
          } else {
            console.error("Error loading profile:", err);
            setError(err.message);
          }
        } else {
          console.error("Error loading profile:", err);
          setError("Failed to load profile. Please try again.");
        }
        setProfile(null);
      } finally {
        // Only update loading state if request wasn't aborted
        if (!abortControllerRef.current?.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [fetchProfileWithTimeout]
  );

  const refetch = useCallback(() => {
    if (userId) {
      loadProfile(userId);
    }
  }, [userId, loadProfile]);

  // Load profile when enabled and user ID is available
  useEffect(() => {
    if (enabled && userId) {
      loadProfile(userId);
    } else if (!enabled || !userId) {
      // Reset state when disabled or no user ID
      setProfile(null);
      setLoading(false);
      setError(null);
    }

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, userId, loadProfile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    profile,
    loading,
    error,
    refetch,
  };
}
