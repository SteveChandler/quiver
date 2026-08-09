"use client";

import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ZineBeachPhoto } from "@/components/beach-detail/zine/types";
import { ZineOverviewBody } from "@/components/beach-detail/zine/zine-overview-body";

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
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  beachPhoto?: ZineBeachPhoto | null;
  surfCallReport?: SurfCallResult | null;
  beachTimezone?: string | null;
  surfCallIsTomorrow?: boolean;
  onWriteReview?: () => void;
}

/**
 * Overview tab body. The hero and zine footer live in the
 * page-level `ZinePageShell` so they stay visible across all tabs.
 */
export function OverviewTab({
  beach,
  amenities,
  waterQuality,
  beachPhoto,
  surfCallReport,
  beachTimezone,
  surfCallIsTomorrow = false,
  onWriteReview,
}: OverviewTabProps) {
  return (
    <ZineOverviewBody
      beach={beach as Beach}
      amenities={amenities}
      waterQuality={waterQuality}
      beachPhoto={beachPhoto}
      surfCallReport={surfCallReport}
      beachTimezone={beachTimezone}
      surfCallIsTomorrow={surfCallIsTomorrow}
      onWriteReview={onWriteReview}
    />
  );
}
