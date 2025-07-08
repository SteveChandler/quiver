"use client";

import { useCallback, useEffect, useState } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import {
  getNearbyIntelPosts,
  getPublicIntelPosts,
  type GetNearbyIntelPostsParams,
} from "@/actions/intel-actions";
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

    const params: GetNearbyIntelPostsParams = {
      latitude,
      longitude,
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
    hasData: !!data && data.posts.length > 0,
  };
}

/**
 * Hook for location-based intel data fetching
 * Automatically gets user location and fetches intel posts
 */
export function useLocationIntelData({
  radius = 5,
  tag = "all",
  limit = 50,
  autoRefresh = true,
  refreshInterval = 30000,
}: Omit<UseIntelDataParams, "latitude" | "longitude" | "enabled"> = {}) {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    setGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGettingLocation(false);
      },
      (error) => {
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        setLocationError(errorMessage);
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, []);

  // Auto-get location on mount
  useEffect(() => {
    if (!location && !locationError && !gettingLocation) {
      getCurrentLocation();
    }
  }, [location, locationError, gettingLocation, getCurrentLocation]);

  // Use intel data hook with current location
  const intelData = useIntelData({
    latitude: location?.latitude,
    longitude: location?.longitude,
    radius,
    tag,
    limit,
    enabled: !!location,
    autoRefresh,
    refreshInterval,
  });

  return {
    ...intelData,
    location,
    locationError,
    gettingLocation,
    getCurrentLocation,
    hasLocation: !!location,
  };
}

/**
 * Hook for managing intel post filters
 * Provides state management for tag and radius filters
 */
export function useIntelFilters(
  initialFilters: {
    tag?: IntelPostTag | "all";
    radius?: number;
  } = {}
) {
  const [selectedTag, setSelectedTag] = useState<IntelPostTag | "all">(
    initialFilters.tag || "all"
  );
  const [selectedRadius, setSelectedRadius] = useState<number>(
    initialFilters.radius || 5
  );

  const updateTag = useCallback((tag: IntelPostTag | "all") => {
    setSelectedTag(tag);
  }, []);

  const updateRadius = useCallback((radius: number) => {
    setSelectedRadius(radius);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedTag("all");
    setSelectedRadius(5);
  }, []);

  return {
    selectedTag,
    selectedRadius,
    updateTag,
    updateRadius,
    resetFilters,
    filters: {
      tag: selectedTag,
      radius: selectedRadius,
    },
  };
}
