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
    <section className="py-8 bg-[#1E2558] noise-texture">
      <div className="flex items-center justify-center gap-2 mb-2 px-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <p className="text-xs font-mono uppercase tracking-wider text-white/60">
          Live conditions nearby
        </p>
      </div>
      <ConditionsTicker
        data={result?.data ?? {}}
        theme="dark"
        loading={loading}
        beachName={result?.beachName}
      />
    </section>
  );
}
