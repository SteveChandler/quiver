"use client";

import { useCallback, useState, useEffect } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getAllSessions } from "@/actions/session-actions";
import type { SessionWithDetails } from "@/types/database";

interface UseHomeDataOptions {
  /** Delay initial fetch by this many milliseconds (default: 500ms for performance) */
  deferMs?: number;
}

interface UseHomeDataReturn {
  sessions: SessionWithDetails[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching home screen data (community sessions)
 *
 * Defers initial fetch by default to prioritize main content rendering.
 * This improves perceived load time on the home screen.
 */
export function useHomeData(options: UseHomeDataOptions = {}): UseHomeDataReturn {
  const { deferMs = 500 } = options;

  // Defer initial fetch to prioritize main content
  const [fetchEnabled, setFetchEnabled] = useState(deferMs === 0);

  useEffect(() => {
    if (deferMs === 0) return;

    const timer = setTimeout(() => {
      setFetchEnabled(true);
    }, deferMs);

    return () => clearTimeout(timer);
  }, [deferMs]);

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
  } = useDataFetcher(fetchSessions, {
    initialData: [] as SessionWithDetails[],
    skip: !fetchEnabled,
  });

  return {
    sessions: sessionsData || [],
    // Show loading state during defer period and actual loading
    loading: !fetchEnabled || sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  };
}
