"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";

interface HomeConditionsTickerProps {
  beachId: string;
  beachName?: string;
}

export function HomeConditionsTicker({ beachId, beachName }: HomeConditionsTickerProps) {
  const fetchConditions = useCallback(async () => {
    const result = await getEnhancedBeachForecasts(beachId, 2);
    if (!result.success || !result.data?.length) return null;
    const current = getCurrentForecast(result.data);
    return current ? forecastToConditionsData(current) : null;
  }, [beachId]);

  const { data, loading } = useDataFetcher(fetchConditions);

  if (!loading && !data) return null;

  return (
    <ConditionsTicker
      data={data ?? {}}
      theme="dark"
      loading={loading}
      beachName={beachName}
    />
  );
}
