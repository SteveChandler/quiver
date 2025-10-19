"use client";

import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { getBeachById } from "@/actions/beach/beach-query-actions";
import { trackPublicPageView } from "@/lib/analytics";
import { FullPageLoader } from "@/components/ui/loading-states";
import type { Beach } from "@/types/database";

export default function ForecastPage({
  params,
}: {
  params: { beachId: string };
}) {
  const { user } = useAuth();
  const [beach, setBeach] = useState<Beach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Track public page view
    if (!user) {
      trackPublicPageView("forecast", { beachId: params.beachId });
    }

    // Fetch beach data
    async function fetchBeach() {
      try {
        const beachData = await getBeachById(params.beachId);
        setBeach(beachData);
      } catch (error) {
        console.error("Error fetching beach:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBeach();
  }, [params.beachId, user]);

  if (loading) {
    return <FullPageLoader message="Loading forecast..." />;
  }

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
        <BeachesEnhancedForecast
          beachId={params.beachId}
          beachName={beach.name}
          showHeader={true}
          showTransparency={true}
          showQualitySummary={true}
          allowToggleTransparency={true}
          highlightQualityVariations={true}
          publicMode={!user}
        />
      </main>
      <BottomNavigation />
    </div>
  );
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
