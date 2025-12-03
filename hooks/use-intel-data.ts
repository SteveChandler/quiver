"use client";

import { useCallback, useEffect, useState } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import {
  getNearbyIntelPosts,
  getPublicIntelPosts,
} from "@/actions/intel-actions";
import {
  getCoordinateValidationError,
} from "@/lib/coordinate-validation";
import type { GetNearbyIntelPostsParams } from "@/types/intel";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";

interface IntelData {
  posts: IntelPostWithUser[];
  total: number;
  filters: {
    latitude: number;
    longitude: number;
    radius: number;
    tag: IntelPostTag | "all";
    limit: number;
  };
}

interface UseIntelDataParams {
  latitude?: number;
  longitude?: number;
  radius?: number;
  tag?: IntelPostTag | "all";
  limit?: number;
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseIntelDataReturn {
  data: IntelData | null;
  posts: IntelPostWithUser[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateFilters: (filters: Partial<GetNearbyIntelPostsParams>) => void;
  hasData: boolean;
}

/**
 * Custom hook for fetching intel posts data
 * Supports both authenticated and unauthenticated access
 */
export function useIntelData({
  latitude,
  longitude,
  radius = 5,
  tag = "all",
  limit = 50,
  enabled = true,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseIntelDataParams = {}): UseIntelDataReturn {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    radius,
    tag,
    limit,
  });

  // Create the fetch function
  const fetchIntelData = useCallback(async (): Promise<IntelData | null> => {
    if (!enabled || !latitude || !longitude) {
      return null;
    }

    // Validate coordinates before making API call
    const validationError = getCoordinateValidationError(
      latitude,
      longitude,
      'useIntelData'
    );

    if (validationError) {
      // In development, log detailed warning
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Invalid coordinates detected in useIntelData:', validationError);
        console.error('  Latitude:', latitude);
        console.error('  Longitude:', longitude);
      }

      // Throw error to propagate to error boundary
      throw new Error(`Invalid coordinates: ${validationError}`);
    }

    const params: GetNearbyIntelPostsParams = {
      lat: latitude,
      lon: longitude,
      radius: filters.radius,
      tag: filters.tag,
      limit: filters.limit,
    };

    try {
      // Use authenticated or public endpoint based on user status
      const result = user
        ? await getNearbyIntelPosts(params)
        : await getPublicIntelPosts(params);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch intel posts");
      }

      return result.data as IntelData;
    } catch (error) {
      console.error("Error fetching intel data:", error);
      throw error;
    }
  }, [enabled, latitude, longitude, filters, user]);

  // Use the data fetcher hook
  const { data, loading, error, refetch } = useDataFetcher(fetchIntelData);

  // Auto-refetch when coordinates change
  useEffect(() => {
    if (enabled && latitude && longitude) {
      refetch();
    }
  }, [latitude, longitude, enabled, refetch]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !enabled || loading) return;

    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, enabled, loading, refreshInterval, refetch]);

  // Update filters function
  const updateFilters = useCallback(
    (newFilters: Partial<GetNearbyIntelPostsParams>) => {
      setFilters((prev) => ({
        radius: newFilters.radius ?? prev.radius,
        tag: newFilters.tag ?? prev.tag,
        limit: newFilters.limit ?? prev.limit,
      }));
    },
    []
  );

  return {
    data,
    posts: data?.posts || [],
    loading,
    error,
    refetch,
    updateFilters,
    hasData: !!data && data.posts?.length > 0,
  };
}


