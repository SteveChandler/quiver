"use client";

import { useCallback, useState } from "react";
import type { SurfDropJoinResult } from "@/types/surf-drops";

interface UseJoinSurfDropResult {
  join: (dropId: string, options?: { shareSlug?: string }) => Promise<SurfDropJoinResult>;
  loading: boolean;
  error: string | null;
}

/**
 * Client wrapper for POST /api/surf-drops/{id}/join. Passing shareSlug
 * lets the endpoint auto-claim link access in the same call.
 */
export function useJoinSurfDrop(): UseJoinSurfDropResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(
    async (
      dropId: string,
      options: { shareSlug?: string } = {},
    ): Promise<SurfDropJoinResult> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/surf-drops/${encodeURIComponent(dropId)}/join`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              options.shareSlug ? { share_slug: options.shareSlug } : {},
            ),
          },
        );
        const body = (await response.json()) as {
          success: boolean;
          data?: SurfDropJoinResult;
          error?: string;
        };
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }
        return body.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to join Surf Drop";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { join, loading, error };
}
