"use client";

import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ZineBeachPhoto } from "./types";
import { RoughEdgeFilter } from "./atoms";
import { ZineHero } from "./zine-hero";
import { ZineFooter } from "./zine-footer";
import { ZineOverviewBody } from "./zine-overview-body";

interface ZineTabProps {
  beach: Beach;
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  beachPhoto?: ZineBeachPhoto | null;
  surfCallReport?: SurfCallResult | null;
  beachTimezone?: string | null;
  surfCallIsTomorrow?: boolean;
  onWriteReview?: () => void;
}

/**
 * Standalone all-in-one zine surface. Useful as a single component for tests
 * that want to assert "the whole zine renders." Production beach pages use
 * `ZinePageShell` (outer) + `ZineOverviewBody` (Overview tab content) so the
 * shell stays visible across all tabs.
 */
export function ZineTab({
  beach,
  amenities,
  waterQuality,
  beachPhoto,
  surfCallReport,
  beachTimezone,
  surfCallIsTomorrow = false,
  onWriteReview,
}: ZineTabProps) {
  return (
    <div className="zine-tab">
      <RoughEdgeFilter />
      <div className="zine-stage">
        {/* No masthead: the app header already sits above this page with the
            Quiver wordmark in it, so a masthead reads as a second header. The
            edition byline still runs in ZineFooter. */}

        <div className="zine-paper">
          <ZineHero beach={beach} beachPhoto={beachPhoto} />
          <ZineOverviewBody
            beach={beach}
            amenities={amenities}
            waterQuality={waterQuality}
            beachPhoto={beachPhoto}
            surfCallReport={surfCallReport}
            beachTimezone={beachTimezone}
            surfCallIsTomorrow={surfCallIsTomorrow}
            onWriteReview={onWriteReview}
          />
          <ZineFooter city={beach.city} state={beach.state} />
        </div>
      </div>
    </div>
  );
}
