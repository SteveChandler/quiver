"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfDropDetail } from "@/types/surf-drops";

interface UseSurfDropResult {
  drop: SurfDropDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setDrop: (updater: (prev: SurfDropDetail | null) => SurfDropDetail | null) => void;
}

/**
 * Client-side surf drop detail fetch. Prefer server-side fetch + hydrate;
 * this hook exposes optimistic-update helpers via `setDrop`.
 */
export function useSurfDrop(
  dropId: string | null,
  initial?: SurfDropDetail | null,
): UseSurfDropResult {
  const [drop, setDropState] = useState<SurfDropDetail | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(!initial && Boolean(dropId));
  const [error, setError] = useState<string | null>(null);

  const fetchDrop = useCallback(async (): Promise<void> => {
    if (!dropId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/surf-drops/${encodeURIComponent(dropId)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: SurfDropDetail;
        error?: string;
      };
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setDropState(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Surf Drop");
    } finally {
      setLoading(false);
    }
  }, [dropId]);

  useEffect(() => {
    if (initial || !dropId) return;
    void fetchDrop();
  }, [fetchDrop, initial, dropId]);

  const setDrop = useCallback(
    (updater: (prev: SurfDropDetail | null) => SurfDropDetail | null) => {
      setDropState((prev) => updater(prev));
    },
    [],
  );

  return { drop, loading, error, refetch: fetchDrop, setDrop };
}
