import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
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
  try {
    const result = await getFreshForecastFromCache(beach.id, 2);
    if (result?.forecasts?.length) {
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
      }
    }
  } catch {
    // Render with empty data
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
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
