"use client";

import { useCallback, useEffect, useState } from "react";
import type { SurfDropTeaser } from "@/types/surf-drops";

interface UseSurfDropTeaserResult {
  teaser: SurfDropTeaser | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Client-side teaser fetch. Pages should prefer server-side fetch and
 * hydrate; this hook exists for client-only revalidation flows.
 */
export function useSurfDropTeaser(
  shareSlug: string | null,
  initial?: SurfDropTeaser | null,
): UseSurfDropTeaserResult {
  const [teaser, setTeaser] = useState<SurfDropTeaser | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(!initial && Boolean(shareSlug));
  const [error, setError] = useState<string | null>(null);

  const fetchTeaser = useCallback(async (): Promise<void> => {
    if (!shareSlug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/go/${encodeURIComponent(shareSlug)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: SurfDropTeaser;
        error?: string;
      };
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setTeaser(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Surf Drop");
    } finally {
      setLoading(false);
    }
  }, [shareSlug]);

  useEffect(() => {
    if (initial || !shareSlug) return;
    void fetchTeaser();
  }, [fetchTeaser, initial, shareSlug]);

  return { teaser, loading, error, refetch: fetchTeaser };
}
