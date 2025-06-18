"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getUserActivityFeed,
  getGlobalActivityFeed,
} from "@/actions/activity-actions";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { ActivityFeedItem } from "@/types/database";

interface UseActivityFeedOptions {
  userId?: string; // If provided, show user's personalized feed; otherwise show global feed
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseActivityFeedReturn {
  activities: ActivityFeedItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  isLoadingMore: boolean;
}

export function useActivityFeed({
  userId,
  limit = 20,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseActivityFeedOptions = {}): UseActivityFeedReturn {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Determine which feed to show
  const targetUserId = userId || user?.id;
  const useGlobalFeed = !targetUserId;

  // Create the fetch function based on feed type
  const fetchActivityFeed = useCallback(async () => {
    if (useGlobalFeed) {
      return await getGlobalActivityFeed(limit, 0);
    } else {
      return await getUserActivityFeed(targetUserId!, limit, 0);
    }
  }, [useGlobalFeed, targetUserId, limit]);

  // Use the data fetcher hook for initial load and refresh
  const { data, loading, error, refetch } = useDataFetcher(fetchActivityFeed);

  // Update activities when data changes
  useEffect(() => {
    if (data?.success && data.data) {
      setActivities(data.data);
      setOffset(data.data.length);
      setHasMore(data.data.length === limit);
    }
  }, [data, limit]);

  // Load more activities (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !targetUserId) return;

    setIsLoadingMore(true);
    try {
      const result = useGlobalFeed
        ? await getGlobalActivityFeed(limit, offset)
        : await getUserActivityFeed(targetUserId, limit, offset);

      if (result.success && result.data) {
        const newActivities = result.data;
        setActivities((prev) => [...prev, ...newActivities]);
        setOffset((prev) => prev + newActivities.length);
        setHasMore(newActivities.length === limit);
      }
    } catch (error) {
      console.error("Error loading more activities:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, targetUserId, useGlobalFeed, limit, offset]);

  // Refresh function
  const refresh = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await refetch();
  }, [refetch]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    activities,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    isLoadingMore,
  };
}
