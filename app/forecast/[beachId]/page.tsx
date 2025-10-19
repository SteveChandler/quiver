import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { BottomNavigation } from "@/components/bottom-navigation";
import { getBeachById } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { ForecastPageClient } from "./forecast-page-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

export default async function ForecastPage({
  params,
}: {
  params: { beachId: string };
}) {
  // Fetch beach data server-side
  try {
    const beach = await getBeachById(params.beachId);

    if (!beach) {
      return (
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 container mx-auto px-4 py-6">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-2">Beach Not Found</h2>
              <p className="text-muted-foreground">
                We couldn't find forecast data for this beach.
              </p>
            </div>
          </main>
          <BottomNavigation />
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 py-6">
          <ForecastPageClient beach={beach} beachId={params.beachId} />
        </main>
        <BottomNavigation />
      </div>
    );
  } catch (error) {
    console.error("Error fetching beach:", error);
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Error Loading Forecast</h2>
            <p className="text-muted-foreground">
              There was an error loading the forecast. Please try again.
            </p>
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }
}

export async function generateMetadata({
  params,
}: {
  params: { beachId: string };
}): Promise<Metadata> {
  // Fetch beach data for enhanced SEO
  try {
    const beach = await getBeachById(params.beachId);

    if (beach && beach.name) {
      const beachName = beach.name;

      return buildPageMetadata({
        title: `${beachName} Surf Forecast - 10-Day Conditions & Wave Reports`,
        description: `View the 10-day surf forecast for ${beachName}. Get live buoy data, swell heights, wind conditions, tides, and confidence ratings. Plan your next surf session with accurate forecasts.`,
        path: `/forecast/${params.beachId}`,
      });
    }
  } catch (error) {
    // Fall through to generic metadata
  }

  // Fallback to generic metadata
  return buildPageMetadata({
    title: "Surf Forecast - 10-Day Wave Reports | Quiver",
    description:
      "View detailed 10-day surf forecasts with live buoy data, swell heights, wind conditions, and confidence ratings. Plan your next surf session.",
    path: `/forecast/${params.beachId}`,
  });
}
