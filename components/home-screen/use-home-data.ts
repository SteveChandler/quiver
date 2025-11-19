"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getAllSessions } from "@/actions/session-actions";
import type { SessionWithDetails } from "@/types/database";

interface UseHomeDataReturn {
  sessions: SessionWithDetails[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHomeData(): UseHomeDataReturn {
  // Memoize fetch function to prevent infinite loops
  const fetchSessions = useCallback(async () => {
    const result = await getAllSessions(10);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch sessions");
  }, []);

  const {
    data: sessionsData,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useDataFetcher(fetchSessions, { initialData: [] as SessionWithDetails[] });

  return {
    sessions: sessionsData || [],
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  };
}
