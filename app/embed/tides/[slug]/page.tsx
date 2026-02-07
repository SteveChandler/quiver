import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
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
  try {
    const result = await getFreshForecastFromCache(beach.id, 2);
    if (result?.forecasts) {
      forecasts = result.forecasts;
    }
  } catch {
    // Render with empty data — chart will show "No tide data"
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
      forecasts={forecasts}
      windowHours={validHours}
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
