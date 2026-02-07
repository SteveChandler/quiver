import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { EmbedConditionsWidget, type ConditionData } from "./embed-conditions-widget";

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
  let currentConditions: ConditionData = {};
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
        currentConditions = {
          waveHeight: closest.wave_height ?? null,
          wavePeriod: closest.wave_period ?? null,
          waveDirection: closest.wave_direction ?? null,
          windSpeed: closest.wind_speed ?? null,
          windDirection: closest.wind_direction ?? null,
          waterTemp: closest.water_temp ?? null,
          tideStatus: closest.tide_status ?? null,
          tideHeight: closest.tide_height ?? null,
        };
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
      conditions={currentConditions}
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
