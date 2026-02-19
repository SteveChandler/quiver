import { notFound } from "next/navigation";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getFreshForecastFromCache } from "@/lib/utils/forecast-server-utils";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { SurfTerminal } from "./surf-terminal";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const revalidate = 300; // 5-minute ISR caching

interface SurfTerminalPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string; range?: string }>;
}

export default async function SurfTerminalPage({
  params,
  searchParams,
}: SurfTerminalPageProps) {
  const { slug } = await params;
  const { theme, range } = await searchParams;

  // 1. Resolve beach
  const beach = await getBeachBySlugOrId(slug);
  if (!beach) return notFound();

  // 2. Fetch 12 days of forecast data (288 hours)
  let forecasts: EnhancedForecastEntity[] = [];
  try {
    const result = await getFreshForecastFromCache(beach.id, 288);
    if (result?.forecasts) {
      forecasts = result.forecasts;
    }
  } catch {
    // Render with empty data — chart will show "No data"
  }

  // 3. Extract beach config
  const windOffshoreDeg = beach.wind_offshore_deg ?? 90;
  const windOffshoreTolDeg = beach.wind_offshore_tol_deg ?? 45;
  const timezone = beach.timezone ?? "America/Los_Angeles";

  // 4. Parse query params
  const validTheme = theme === "light" ? "light" : "dark";
  const rangeMap: Record<string, number> = {
    "24h": 24,
    "3d": 72,
    "7d": 168,
    "12d": 288,
  };
  const initialRange = range
    ? (rangeMap[range.toLowerCase()] ?? 72)
    : 72;

  // 5. Build URLs
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const beachPath = buildBeachUrl(beach);
  const beachUrl = `${siteUrl}${beachPath}?utm_source=embed&utm_medium=widget&utm_campaign=surf_terminal`;

  return (
    <SurfTerminal
      beachName={beach.name}
      beachUrl={beachUrl}
      slug={slug}
      forecasts={forecasts}
      windOffshoreDeg={windOffshoreDeg}
      windOffshoreTolDeg={windOffshoreTolDeg}
      timezone={timezone}
      theme={validTheme}
      initialRange={initialRange}
    />
  );
}
