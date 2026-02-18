import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import type { ConditionsData } from "@/types/conditions";
import { EmbedTickerWidget } from "./embed-ticker-widget";

export const revalidate = 300; // 5-minute ISR caching

interface EmbedTickerPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedTickerPage({
  params,
  searchParams,
}: EmbedTickerPageProps) {
  const { slug } = await params;
  const { theme } = await searchParams;

  const beach = await getBeachBySlugOrId(slug);
  if (!beach) return notFound();

  // Fetch current forecast
  let tickerData: ConditionsData = {};
  try {
    const result = await getFreshForecastFromCache(beach.id, 2);
    if (result?.forecasts?.length) {
      // Find the forecast closest to now by time proximity
      const now = Date.now();
      const sorted = [...result.forecasts].sort((a, b) => {
        const tA = new Date(a.forecast_at).getTime();
        const tB = new Date(b.forecast_at).getTime();
        return Math.abs(tA - now) - Math.abs(tB - now);
      });
      const closest = sorted[0];
      if (closest) {
        tickerData = forecastToConditionsData(closest);
      }
    }
  } catch {
    // Render with empty data on fetch failure
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

  // Build canonical beach URL using utility, with ticker-specific UTM campaign
  const beachPath = buildBeachUrl(beach);
  const beachUrl = `${siteUrl}${beachPath}?utm_source=embed&utm_medium=widget&utm_campaign=ticker`;

  return (
    <EmbedTickerWidget
      beachName={beach.name}
      beachUrl={beachUrl}
      slug={slug}
      data={tickerData}
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
