import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import { AmenitiesBadges } from "@/components/beach-detail/amenities-badges";
import { WaterQualityBadge, type WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { OverviewReviewCTA } from "@/components/beach-detail/overview-review-cta";
import { CCC_AMENITY_KEYS } from "@/types/amenities";

interface ZineUtilityStripProps {
  beach: Beach;
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  onWriteReview?: () => void;
}

function hasAnyAmenity(amenities: BeachAmenities | Partial<BeachAmenities> | null | undefined): boolean {
  if (!amenities) return false;
  for (const key of CCC_AMENITY_KEYS) {
    if ((amenities as Record<string, unknown>)[key] === true) return true;
  }
  return false;
}

/**
 * Hosts the retained utility content from the legacy SpotOverview:
 *   - WaterQualityBadge (e2e/water-quality.spec.ts pins it visible)
 *   - AmenitiesBadges    (e2e/beach-amenities.spec.ts pins amenity labels)
 *   - OverviewReviewCTA  (e2e/beach-review-tracking.spec.ts pins the click)
 *
 * The retained components render as-is (preserves their internal labels +
 * test surface). Each rail is hidden when its source data is empty so we
 * don't show empty WATER/FIELD SUPPLIES boxes on the cream paper.
 */
export function ZineUtilityStrip({ beach, amenities, waterQuality, onWriteReview }: ZineUtilityStripProps) {
  const showWater = !!waterQuality && waterQuality.status !== "unknown";
  const showAmenities = hasAnyAmenity(amenities ?? null);
  const showAnyRail = showWater || showAmenities;

  return (
    <section className="utility-strip mt-7" aria-label="Spot facts and utility">
      {showAnyRail && (
        <div className="grid gap-5 md:grid-cols-2 md:items-start">
          {showWater && (
            <WaterQualityBadge waterQuality={waterQuality ?? null} beachState={beach.state} />
          )}
          {showAmenities && (
            <AmenitiesBadges amenities={amenities ?? null} />
          )}
        </div>
      )}

      {/* Review CTA — only renders for authed users (self-guarded) */}
      {onWriteReview && (
        <div className="mt-5">
          <OverviewReviewCTA onWriteReview={onWriteReview} reviewCount={beach.review_count ?? undefined} />
        </div>
      )}
    </section>
  );
}
