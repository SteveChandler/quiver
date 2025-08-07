import { useCallback } from "react";
import { useDataFetcher } from "./use-data-fetcher";
import {
  getRecentCheckIns,
  getForecastAccuracyStats,
  getUserCheckIns,
  getBeachCheckIns,
} from "@/actions/check-in-actions";
import {
  CheckInWithUser,
  ForecastAccuracyStats,
  CheckIn,
} from "@/types/database";

/**
 * Hook to fetch recent check-ins for a beach
 */
export function useRecentCheckIns(
  beachId: string | null,
  hoursBack: number = 24,
  limitCount: number = 10
) {
  const fetchData = useCallback(async () => {
    if (!beachId) return [];
    return await getRecentCheckIns(beachId, hoursBack, limitCount);
  }, [beachId, hoursBack, limitCount]);

  return useDataFetcher<CheckInWithUser[]>(fetchData);
}

/**
 * Hook to fetch forecast accuracy statistics for a beach
 */
export function useForecastAccuracyStats(
  beachId: string | null,
  daysBack: number = 7
) {
  const fetchData = useCallback(async () => {
    if (!beachId) {
      return {
        total_reports: 0,
        accurate_count: 0,
        somewhat_count: 0,
        inaccurate_count: 0,
        accuracy_percentage: 0,
      };
    }
    return await getForecastAccuracyStats(beachId, daysBack);
  }, [beachId, daysBack]);

  return useDataFetcher<ForecastAccuracyStats>(fetchData);
}

/**
 * Hook to fetch user's check-in history
 */
export function useUserCheckIns(
  userId: string | null,
  limit: number = 20,
  offset: number = 0
) {
  const fetchData = useCallback(async () => {
    if (!userId) return [];
    return await getUserCheckIns(userId, limit, offset);
  }, [userId, limit, offset]);

  return useDataFetcher<CheckIn[]>(fetchData);
}

/**
 * Hook to fetch all check-ins for a beach with pagination
 */
export function useBeachCheckIns(
  beachId: string | null,
  limit: number = 20,
  offset: number = 0
) {
  const fetchData = useCallback(async () => {
    if (!beachId) return [];
    return await getBeachCheckIns(beachId, limit, offset);
  }, [beachId, limit, offset]);

  return useDataFetcher<CheckInWithUser[]>(fetchData);
}

/**
 * Hook to get beach check-ins with real-time updates
 * Useful for displaying live conditions feed in Local Intel
 */
export function useRealtimeBeachCheckIns(
  beachId: string | null,
  hoursBack: number = 12
) {
  const fetchData = useCallback(async () => {
    if (!beachId) return [];
    return await getRecentCheckIns(beachId, hoursBack, 20);
  }, [beachId, hoursBack]);

  return useDataFetcher<CheckInWithUser[]>(fetchData);
}
