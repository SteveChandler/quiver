import { useCallback, useEffect, useState } from "react";
import { getSessionPhotosAction } from "@/actions/session-media-actions";
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
      const result = await getSessionPhotosAction(sessionId);

      if (result.success && result.data) {
        setPhotos(result.data);
      } else {
        setPhotos([]);
        if (result.error) {
          setError(result.error);
        }
      }
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
