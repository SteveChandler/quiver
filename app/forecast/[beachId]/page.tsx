import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { BottomNavigation } from "@/components/bottom-navigation";
import { getBeachById } from "@/actions/beach-actions";
import { notFound } from "next/navigation";

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
