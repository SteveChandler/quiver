"use client";

import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { ZineBeachPhoto } from "./types";
import { RoughEdgeFilter } from "./atoms";
import { ZineHero } from "./zine-hero";
import { TodaySurfCall } from "./today-surf-call";
import { ZineFooter } from "./zine-footer";
import { ZineOverviewBody } from "./zine-overview-body";

interface ZineTabProps {
  beach: Beach;
  surfCallReport?: SurfCallResult | null;
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  beachPhoto?: ZineBeachPhoto | null;
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
  surfCallReport,
  amenities,
  waterQuality,
  beachPhoto,
  onWriteReview,
}: ZineTabProps) {
  return (
    <div className="zine-tab">
      <RoughEdgeFilter />
      <div className="zine-stage">
        <div className="zine-masthead">
          <div className="left">
            <span className="logo">QUIVER</span>
            <span className="rule" aria-hidden />
            <span>Field Guide · Vol. 03</span>
          </div>
          <div>
            {new Date()
              .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              .toUpperCase()}
          </div>
        </div>

        <div className="zine-paper">
          <ZineHero beach={beach} beachPhoto={beachPhoto} />
          <TodaySurfCall beach={beach} surfCallReport={surfCallReport} />
          <ZineOverviewBody
            beach={beach}
            amenities={amenities}
            waterQuality={waterQuality}
            beachPhoto={beachPhoto}
            onWriteReview={onWriteReview}
          />
          <ZineFooter city={beach.city} state={beach.state} />
        </div>
      </div>
    </div>
  );
}
