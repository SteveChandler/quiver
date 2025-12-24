import { useCallback, useEffect, useState } from "react";
import type { SessionPhoto } from "@/lib/supabase/storage";

/**
 * Hook to fetch session photos
 * Returns photos array and loading state
 */
export function useSessionPhotos(sessionId: string | undefined) {
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!sessionId) {
      setPhotos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/photos`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      // If user isn't allowed to view photos (e.g. private session), treat as no photos.
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setPhotos([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load photos (${response.status})`);
      }

      const json = await response.json();
      setPhotos((json?.data?.photos as SessionPhoto[]) || []);
    } catch (err) {
      console.error("Error fetching session photos:", err);
      setPhotos([]);
      setError(err instanceof Error ? err.message : "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return {
    photos,
    loading,
    error,
    refetch: fetchPhotos,
  };
}
