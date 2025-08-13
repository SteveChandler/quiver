"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getBeaches } from "@/actions/beach-actions";
import { getAllSessions } from "@/actions/session-actions";
import type { Beach, SessionWithDetails } from "@/types/database";

interface UseHomeDataReturn {
  beaches: Beach[];
  sessions: SessionWithDetails[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHomeData(): UseHomeDataReturn {
  // Memoize fetch functions to prevent infinite loops
  const fetchBeaches = useCallback(async () => {
    const result = await getBeaches();
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beaches");
  }, []);

  const fetchSessions = useCallback(async () => {
    const sessions = await getAllSessions(10);
    if (sessions) {
      return sessions;
    }
    throw new Error("Failed to fetch sessions");
  }, []);

  const {
    data: beachesData,
    loading: beachesLoading,
    error: beachesError,
    refetch: refetchBeaches,
  } = useDataFetcher(fetchBeaches, { initialData: [] as Beach[] });

  const {
    data: sessionsData,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useDataFetcher(fetchSessions, { initialData: [] as SessionWithDetails[] });

  const refetch = useCallback(() => {
    refetchBeaches();
    refetchSessions();
  }, [refetchBeaches, refetchSessions]);

  return {
    beaches: beachesData || [],
    sessions: sessionsData || [],
    loading: beachesLoading || sessionsLoading,
    error: beachesError || sessionsError,
    refetch,
  };
}
