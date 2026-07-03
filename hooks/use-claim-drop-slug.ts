"use client";

import { useCallback, useState } from "react";
import type { SurfDropClaimResult } from "@/types/surf-drops";

interface UseClaimDropSlugResult {
  claim: (shareSlug: string) => Promise<SurfDropClaimResult>;
  loading: boolean;
  error: string | null;
}

/**
 * Client wrapper for POST /api/go/{slug}/claim. Grants the current user
 * link access and returns the drop_id so the caller can navigate to the
 * detail page.
 */
export function useClaimDropSlug(): UseClaimDropSlugResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = useCallback(async (shareSlug: string): Promise<SurfDropClaimResult> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/go/${encodeURIComponent(shareSlug)}/claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const body = (await response.json()) as {
        success: boolean;
        data?: SurfDropClaimResult;
        error?: string;
      };
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      return body.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim link";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { claim, loading, error };
}
