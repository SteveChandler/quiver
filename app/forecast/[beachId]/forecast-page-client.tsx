"use client";

import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
import { trackPublicPageView } from "@/lib/analytics";
import type { Beach } from "@/types/database";

interface ForecastPageClientProps {
  beach: Beach;
  beachId: string;
}

export function ForecastPageClient({
  beach,
  beachId,
}: ForecastPageClientProps) {
  const { user } = useAuth();

  useEffect(() => {
    // Track public page view
    if (!user) {
      trackPublicPageView("forecast", { beachId });
    }
  }, [beachId, user]);

  return (
    <BeachesEnhancedForecast
      beachId={beachId}
      beachName={beach.name}
      showHeader={true}
      showTransparency={true}
      showQualitySummary={true}
      allowToggleTransparency={true}
      highlightQualityVariations={true}
      publicMode={!user}
    />
  );
}
