"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { ConditionsTicker } from "@/components/conditions/conditions-ticker";
import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";

export function LandingConditionsTicker() {
  const fetchConditions = useCallback(async () => {
    const topBeaches = await getTopBeachesNow(1);
    if (!topBeaches?.length) return null;

    const topBeach = topBeaches[0];

    const result = await getEnhancedBeachForecasts(topBeach.beachId, 2);
    if (!result.success || !result.data?.length) return null;

    const current = getCurrentForecast(result.data);
    if (!current) return null;

    return {
      data: forecastToConditionsData(current),
      beachName: topBeach.beachName,
    };
  }, []);

  const { data: result, loading } = useDataFetcher(fetchConditions);

  if (!loading && !result) return null;

  return (
    <section className="py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {result?.beachName && (
          <p className="text-sm text-gray-500 mb-2 text-center">
            Current conditions at {result.beachName}
          </p>
        )}
        <ConditionsTicker
          data={result?.data ?? {}}
          theme="light"
          loading={loading}
          beachName={result?.beachName}
        />
      </div>
    </section>
  );
}
