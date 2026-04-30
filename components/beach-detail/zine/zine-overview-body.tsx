"use client";

import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ZineBeachPhoto } from "./types";
import { TodaySurfCall } from "./today-surf-call";
import { ZineMainGrid } from "./zine-main-grid";
import { ZineSpotSummary } from "./zine-spot-summary";
import { ZineUtilityStrip } from "./zine-utility-strip";
import { ZineRecentSessions } from "./zine-recent-sessions";

interface ZineOverviewBodyProps {
  beach: Beach;
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  beachPhoto?: ZineBeachPhoto | null;
  surfCallReport?: SurfCallResult | null;
  onWriteReview?: () => void;
}

/**
 * Body content for the Overview tab. Sits inside the cream paper, below the
 * tabs row. Renders the editorial spot content + retained utility modules
 * (water quality, amenities, review CTA) + recent sessions polaroids.
 *
 * The hero and footer live in `ZinePageShell` so they remain
 * visible across all tabs (Forecast / Reviews / Local Intel / Sessions).
 */
export function ZineOverviewBody({
  beach,
  amenities,
  waterQuality,
  beachPhoto,
  surfCallReport,
  onWriteReview,
}: ZineOverviewBodyProps) {
  return (
    <div className="zine-overview-body">
      <TodaySurfCall beach={beach} surfCallReport={surfCallReport} />
      <ZineMainGrid beach={beach} beachPhoto={beachPhoto} />
      <ZineSpotSummary beach={beach} />
      <ZineUtilityStrip
        beach={beach}
        amenities={amenities}
        waterQuality={waterQuality}
        onWriteReview={onWriteReview}
      />
      <ZineRecentSessions beachId={beach.id} />
    </div>
  );
}
