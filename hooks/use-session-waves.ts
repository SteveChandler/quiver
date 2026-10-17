"use client";

import { useCallback, useRef } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";

interface UseSessionWavesResult {
  data: SessionWavesResponse | null;
  isLoading: boolean;
  refresh: () => void;
}

export function useSessionWaves(sessionId: string): UseSessionWavesResult {
  const warnedRef = useRef(false);
  const fetchWaves = useCallback(async (): Promise<{ sessionId: string; response: SessionWavesResponse | null }> => {
    const response = await fetch(`/api/v1/sessions/${encodeURIComponent(sessionId)}/waves`, {
      cache: "no-store",
    });
    if (response.status === 404) return { sessionId, response: null };

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const envelope = await response.json();
    if (envelope?.success !== true || !envelope.data) {
      throw new Error(envelope?.error || "Invalid waves response");
    }
    return { sessionId, response: envelope.data as SessionWavesResponse };
  }, [sessionId]);

  const onError = useCallback((error: string): void => {
    if (warnedRef.current) return;
    warnedRef.current = true;
    console.warn("Unable to load session waves:", error);
  }, []);

  const { data, loading, refetch } = useDataFetcher(fetchWaves, { onError });
  const refresh = useCallback((): void => {
    void refetch();
  }, [refetch]);

  return { data: data?.sessionId === sessionId ? data.response : null, isLoading: loading, refresh };
}
