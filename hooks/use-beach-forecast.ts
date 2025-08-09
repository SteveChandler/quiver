"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  getForecastWindow,
  type ForecastWindow,
} from "@/actions/forecast/forecast-actions";

export function useBeachForecast(
  beachId: string | undefined,
  startIso: string,
  endIso: string
) {
  const fetchData = useCallback(async () => {
    if (!beachId) return null;
    const res = await getForecastWindow(beachId, startIso, endIso);
    if (!res.success) throw new Error(res.error || "Failed to load forecast");
    return res.data as ForecastWindow;
  }, [beachId, startIso, endIso]);

  return useDataFetcher(fetchData, { skip: !beachId });
}
