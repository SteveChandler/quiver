"use client";

import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSessionTideSnapshot,
  type SessionTideSnapshot,
} from "@/lib/services/session-tide-snapshot";
import { combineDateAndTime } from "@/lib/utils/session-data-builder";
import { useDataFetcher } from "./use-data-fetcher";

interface UseSessionTideSnapshotResult {
  tideSnapshot: SessionTideSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function useSessionTideSnapshot(
  beachId: string | null,
  sessionDate: string | null,
  sessionTime: string | null
): UseSessionTideSnapshotResult {
  const arrivalTime = useMemo(() => {
    if (!sessionDate || !sessionTime) return null;
    return combineDateAndTime(sessionDate, sessionTime) ?? null;
  }, [sessionDate, sessionTime]);

  const fetchSnapshot = useCallback(async () => {
    if (!beachId || !arrivalTime) return null;
    return fetchSessionTideSnapshot(createClient(), beachId, arrivalTime);
  }, [arrivalTime, beachId]);

  const { data, loading, error } = useDataFetcher(fetchSnapshot, {
    immediate: Boolean(beachId && arrivalTime),
  });

  return {
    tideSnapshot: data ?? null,
    loading: Boolean(beachId && arrivalTime) && loading,
    error,
  };
}
