export const MY_COAST_FOLLOW_LIMIT = 8;

export type MyCoastUnavailableSource = "beaches" | "forecast" | "water_quality";

export interface MyCoastBeachSourceRow {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  windOffshoreDeg: number | null;
  windOffshoreToleranceDeg: number | null;
}

export interface MyCoastForecastSourceRow {
  beachId: string;
  forecastAt: string;
  updatedAt: string;
  waterTemp: string | null;
  tideStatus: string | null;
  nextTideAt: string | null;
  nextTideHeight: string | null;
  nextTideType: string | null;
  windSpeed: string | null;
  windDirection: string | null;
  windDirectionDeg: number | null;
  waveHeight: string | null;
  dataSource: string | null;
}

export interface MyCoastWaterQualitySourceRow {
  beachId: string;
  status: "good" | "advisory" | "closure" | "unknown";
  latestEnterococcus: number | null;
  latestFecalColiform: number | null;
  latestSampleDate: string | null;
  exceedanceCount30d: number;
  totalSamples30d: number;
  statusReason: string | null;
  statusChangedAt: string | null;
}

export interface MyCoastBeachData extends MyCoastBeachSourceRow {
  forecast: MyCoastForecastSourceRow | null;
  waterQuality: MyCoastWaterQualitySourceRow | null;
  unavailableSources: MyCoastUnavailableSource[];
}

export interface MyCoastBatch {
  beaches: MyCoastBeachData[];
  truncatedCount: number;
}

export interface MyCoastBatchSources {
  loadBeaches(beachIds: string[]): Promise<MyCoastBeachSourceRow[]>;
  loadForecasts(beachIds: string[]): Promise<MyCoastForecastSourceRow[]>;
  loadWaterQuality(beachIds: string[]): Promise<MyCoastWaterQualitySourceRow[]>;
}

export async function loadMyCoastBatch(
  beachIds: readonly string[],
  sources: MyCoastBatchSources,
): Promise<MyCoastBatch> {
  const boundedIds = [...new Set(beachIds)].slice(0, MY_COAST_FOLLOW_LIMIT);
  if (boundedIds.length === 0) return { beaches: [], truncatedCount: 0 };

  const [beachesResult, forecastsResult, waterQualityResult] =
    await Promise.allSettled([
      sources.loadBeaches(boundedIds),
      sources.loadForecasts(boundedIds),
      sources.loadWaterQuality(boundedIds),
    ]);
  const beaches = beachesResult.status === "fulfilled" ? beachesResult.value : [];
  const forecasts = forecastsResult.status === "fulfilled"
    ? forecastsResult.value
    : [];
  const waterQuality = waterQualityResult.status === "fulfilled"
    ? waterQualityResult.value
    : [];
  const forecastByBeach = new Map(forecasts.map((row) => [row.beachId, row]));
  const waterQualityByBeach = new Map(
    waterQuality.map((row) => [row.beachId, row]),
  );
  const unavailableSources: MyCoastUnavailableSource[] = [
    ...(beachesResult.status === "rejected" ? ["beaches" as const] : []),
    ...(forecastsResult.status === "rejected" ? ["forecast" as const] : []),
    ...(waterQualityResult.status === "rejected"
      ? ["water_quality" as const]
      : []),
  ];
  const beachById = new Map(beaches.map((beach) => [beach.id, beach]));

  return {
    beaches: boundedIds.flatMap((id) => {
      const beach = beachById.get(id);
      return beach ? [{
        ...beach,
        forecast: forecastByBeach.get(id) ?? null,
        waterQuality: waterQualityByBeach.get(id) ?? null,
        unavailableSources,
      }] : [];
    }),
    truncatedCount: Math.max(0, new Set(beachIds).size - boundedIds.length),
  };
}
