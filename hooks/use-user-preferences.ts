"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { UserSurfPreferences } from "@/lib/services/preference-learning-service";

interface UseUserPreferencesResult {
  data: UserSurfPreferences | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUserPreferences(): UseUserPreferencesResult {
  const { user } = useAuth();

  const fetchPreferences = useCallback(async (): Promise<UserSurfPreferences | null> => {
    if (!user) return null;

    const res = await fetch("/api/user/preferences");
    if (!res.ok) {
      throw new Error(`Failed to fetch preferences: ${res.status}`);
    }
    const json = await res.json();
    return json.data ?? null;
  }, [user]);

  const { data, loading, error, refetch } = useDataFetcher(fetchPreferences, {
    immediate: true,
    skip: !user,
    initialData: null,
  });

  return {
    data: data ?? null,
    loading,
    error: error ? new Error(error) : null,
    refetch,
  };
}
