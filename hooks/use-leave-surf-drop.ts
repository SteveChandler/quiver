"use client";

import { useCallback, useState } from "react";

interface UseLeaveSurfDropResult {
  leave: (dropId: string) => Promise<{ ok: true }>;
  loading: boolean;
  error: string | null;
}

/**
 * Client wrapper for DELETE /api/surf-drops/{id}/join.
 */
export function useLeaveSurfDrop(): UseLeaveSurfDropResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(async (dropId: string): Promise<{ ok: true }> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/surf-drops/${encodeURIComponent(dropId)}/join`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as {
        success: boolean;
        data?: { ok: true };
        error?: string;
      };
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      return body.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave Surf Drop";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { leave, loading, error };
}
