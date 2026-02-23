"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface SunTimesData {
  sunrise_utc: string | null;
  sunset_utc: string | null;
}

interface UseSunTimesResult {
  sunrise: Date | null;
  sunset: Date | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch sunrise and sunset times for a beach on a given date
 * @param beachId - The beach UUID
 * @param date - The date in YYYY-MM-DD format
 */
export function useSunTimes(
  beachId: string | null | undefined,
  date: string | null | undefined
): UseSunTimesResult {
  const fetchSunTimes = useCallback(async (): Promise<SunTimesData> => {
    const res = await fetch(`/api/beaches/${beachId}/sun-times?date=${date}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [beachId, date]);

  const { data, loading, error } = useDataFetcher<SunTimesData>(fetchSunTimes, {
    skip: !beachId || !date,
  });

  return {
    sunrise: data?.sunrise_utc ? new Date(data.sunrise_utc) : null,
    sunset: data?.sunset_utc ? new Date(data.sunset_utc) : null,
    isLoading: loading,
    error,
  };
}
