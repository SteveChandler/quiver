"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Profile } from "@/types/database";

/**
 * Hook for managing the current user's profile
 * Uses API route for consistent caching behavior
 */
export function useProfile() {
  const { user } = useAuth();

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const response = await fetch("/api/me/profile", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("User not authenticated for profile fetch");
          return null;
        }
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const data = await response.json();
      return data.data as Profile;
    } catch (error) {
      console.error("Error fetching profile via API:", error);
      return null;
    }
  }, [user?.id]);

  const {
    data: profile,
    loading,
    error,
    refetch: refreshProfile,
  } = useDataFetcher(fetchProfile, {
    skip: !user?.id,
    initialData: null,
  });

  const mutate = useCallback(() => {
    refreshProfile();
  }, [refreshProfile]);

  return {
    profile,
    loading,
    error,
    refetch: refreshProfile,
    mutate, // Alias for compatibility with SWR-style usage
  };
}