import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { formatBeachDateTime } from "@/lib/utils/date-time";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { ConditionsData } from "@/types/conditions";
import { EmbedConditionsWidget } from "./embed-conditions-widget";

export const revalidate = 300; // 5-minute ISR caching

interface EmbedConditionsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedConditionsPage({
  params,
  searchParams,
}: EmbedConditionsPageProps) {
  const { slug } = await params;
  const { theme } = await searchParams;

  const beach = await getBeachBySlugOrId(slug);
  if (!beach) return notFound();

  // Fetch current forecast
  let currentConditions: ConditionsData = {};
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
      // Use the most recent forecast as "current conditions"
      const now = Date.now();
      const sorted = [...result.forecasts].sort((a, b) => {
        const tA = new Date(`${a.forecast_date}T${a.forecast_time || "00:00"}`).getTime();
        const tB = new Date(`${b.forecast_date}T${b.forecast_time || "00:00"}`).getTime();
        return Math.abs(tA - now) - Math.abs(tB - now);
      });
      const closest = sorted[0];
      if (closest) {
        currentConditions = forecastToConditionsData(closest);
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
    }
  } catch (error) {
    console.warn(
      `[EmbedConditionsPage] Failed to load forecast for beach ${slug}:`,
      error
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Build canonical beach URL using utility
  const beachPath = buildBeachUrl(beach);
  const beachUrl = `${siteUrl}${beachPath}?utm_source=embed&utm_medium=widget&utm_campaign=conditions`;

  return (
    <EmbedConditionsWidget
      beachName={beach.name}
      beachUrl={beachUrl}
      slug={slug}
      conditions={currentConditions}
      status={forecastStatus}
      staleAsOf={staleAsOf}
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
