import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { formatBeachDateTime } from "@/lib/utils/date-time";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { EmbedTideWidget } from "./embed-tide-widget";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const revalidate = 300; // 5-minute ISR caching

interface EmbedTidePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hours?: string; theme?: string }>;
}

export default async function EmbedTidePage({
  params,
  searchParams,
}: EmbedTidePageProps) {
  const { slug } = await params;
  const { hours, theme } = await searchParams;

  const beach = await getBeachBySlugOrId(slug);
  if (!beach) return notFound();

  // Fetch forecast data for tide chart
  let forecasts: EnhancedForecastEntity[] = [];
  let forecastStatus: "fresh" | "stale" | "unavailable" = "unavailable";
  let staleAsOf: string | undefined;
  try {
    const result = await getFreshForecastFromCache(beach.id, 24, {
      allowStale: true,
      maxStaleHours: 24,
    });
    if (
      result.metadata.cached &&
      !result.metadata.missing &&
      result.forecasts.length > 0
    ) {
      forecasts = result.forecasts;
      forecastStatus = result.metadata.stale ? "stale" : "fresh";

      if (result.metadata.stale && result.metadata.lastUpdated) {
        const timezone = resolveBeachTimezone(beach.timezone);
        const updatedDate = formatBeachDateTime(
          result.metadata.lastUpdated,
          timezone,
          "EEE, MMM d"
        );
        const updatedTime = formatBeachDateTime(
          result.metadata.lastUpdated,
          timezone,
          "h:mm a"
        );
        staleAsOf = `${updatedDate} at ${updatedTime}`;
      }
    }
  } catch (error) {
    console.warn(
      `[EmbedTidePage] Failed to load forecast for beach ${slug}:`,
      error
    );
  }

  const windowHours = hours ? parseInt(hours, 10) : 18;
  const validHours = [12, 18, 24].includes(windowHours) ? windowHours : 18;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Build canonical beach URL using utility
  const beachPath = buildBeachUrl(beach);
  const beachUrl = `${siteUrl}${beachPath}?utm_source=embed&utm_medium=widget&utm_campaign=tide_chart`;

  return (
    <EmbedTideWidget
      beachName={beach.name}
      beachUrl={beachUrl}
      slug={slug}
      forecasts={forecasts}
      windowHours={validHours}
      status={forecastStatus}
      staleAsOf={staleAsOf}
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
