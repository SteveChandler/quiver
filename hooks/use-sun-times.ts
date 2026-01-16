"use client";

import useSWR from "swr";

interface SunTimesData {
  sunrise_utc: string | null;
  sunset_utc: string | null;
}

interface UseSunTimesResult {
  sunrise: Date | null;
  sunset: Date | null;
  isLoading: boolean;
  error: Error | null;
}

// Simple fetcher for sun times
const fetcher = async (url: string): Promise<SunTimesData> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Hook to fetch sunrise and sunset times for a beach on a given date
 * @param beachId - The beach UUID
 * @param date - The date in YYYY-MM-DD format
 */
export function useSunTimes(
  beachId: string | null | undefined,
  date: string | null | undefined
): UseSunTimesResult {
  const { data, error, isLoading } = useSWR<SunTimesData>(
    beachId && date ? `/api/beaches/${beachId}/sun-times?date=${date}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min - sun times don't change
      errorRetryCount: 1,
    }
  );

  return {
    sunrise: data?.sunrise_utc ? new Date(data.sunrise_utc) : null,
    sunset: data?.sunset_utc ? new Date(data.sunset_utc) : null,
    isLoading,
    error: error || null,
  };
}
