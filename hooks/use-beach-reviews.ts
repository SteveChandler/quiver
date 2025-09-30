"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMultipleBeachReviewStats } from "@/actions/beach-review-actions";
import type { ReviewStats } from "@/lib/review-stats-utils";

export function useMultipleBeachReviews(beachIds: string[]) {
  const [reviewStats, setReviewStats] = useState<Record<string, ReviewStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastBeachIdsRef = useRef<string>("");

  const beachIdsKey = useMemo(() => {
    return JSON.stringify([...beachIds].sort());
  }, [beachIds]);

  const fetchMultipleStats = useCallback(async () => {
    if (beachIds.length === 0) {
      setReviewStats({});
      setLoading(false);
      return;
    }

    if (lastBeachIdsRef.current === beachIdsKey) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getMultipleBeachReviewStats(beachIds);

      if (result.success) {
        setReviewStats(result.data);
        lastBeachIdsRef.current = beachIdsKey;
      } else {
        setError(result.error || "Failed to fetch review stats");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error in useMultipleBeachReviews:", err);
    } finally {
      setLoading(false);
    }
  }, [beachIds, beachIdsKey]);

  const refresh = useCallback(() => {
    lastBeachIdsRef.current = "";
    fetchMultipleStats();
  }, [fetchMultipleStats]);

  useEffect(() => {
    if (lastBeachIdsRef.current !== beachIdsKey) {
      fetchMultipleStats();
    }
  }, [beachIdsKey, fetchMultipleStats]);

  return {
    reviewStats,
    loading,
    error,
    refresh,
  };
}
