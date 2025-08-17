import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { BottomNavigation } from "@/components/bottom-navigation";
import { getBeachById } from "@/actions/beach/beach-query-actions";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

export default async function ForecastPage({
  params,
}: {
  params: { beachId: string };
}) {
  // Fetch beach data to get the name
  const beach = await getBeachById(params.beachId);

  if (!beach) {
    notFound();
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
  const beach = await getBeachById(params.beachId);
  if (!beach) {
    return buildPageMetadata({
      title: "Surf Forecast | Quiver",
      description: "Beach forecast not found.",
      path: `/forecast/${params.beachId}`,
    });
  }

  const title = `${beach.name} Surf Forecast | Quiver`;
  const description = `10-day surf forecast, buoy data, and confidence for ${beach.name}.`;
  return buildPageMetadata({
    title,
    description,
    path: `/forecast/${params.beachId}`,
  });
}
