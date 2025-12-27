"use client";

import { EnhancedBeachOverview } from "../enhanced-beach-overview";
import { SpotOverview } from "../spot-overview";
import { NearbySpots } from "../nearby-spots";
import type { Beach } from "@/types/database";

interface OverviewTabProps {
  beach: Beach & {
    features?: string[];
    parking_tips?: string | null;
    access_tips?: string | null;
    wave_tips?: string | null;
    crowd_tips?: string | null;
    best_conditions_prose?: string | null;
    warnings?: string[];
    description?: string | null;
    local_etiquette?: string | null;
    average_rating?: number;
    review_count?: number;
  };
}

export function OverviewTab({ beach }: OverviewTabProps) {
  return (
    <div className="space-y-6 py-6">
      {/* Enhanced Beach Overview - Description, Tips, etc. */}
      <EnhancedBeachOverview beach={beach} />

      {/* Spot Overview - Amenities, Hazards, Gallery */}
      <SpotOverview beach={beach as Beach} />

      {/* Nearby Surf Spots - SEO internal linking */}
      <NearbySpots beach={beach as Beach} />
    </div>
  );
}
