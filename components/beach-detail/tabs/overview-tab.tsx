"use client";

import { EnhancedBeachOverview } from "../enhanced-beach-overview";
import { SpotOverview } from "../spot-overview";
import { NearbySpots } from "../nearby-spots";
import { RelatedGuidesSection } from "../related-guides-section";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Star } from "lucide-react";
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
  /** Callback to open the review form dialog */
  onWriteReview?: () => void;
}

/**
 * Inline CTA component to encourage users to write a review
 * Only shown to authenticated users
 */
function OverviewReviewCTA({
  onWriteReview,
  reviewCount,
}: {
  onWriteReview: () => void;
  reviewCount?: number;
}) {
  const { user } = useAuth();

  // Don't show CTA if user isn't logged in
  if (!user) return null;

  const hasReviews = (reviewCount ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-blue-100/60 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-yellow-100 p-2">
            <Star className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-semibold text-dark-grey">
              {hasReviews ? "Share your experience" : "Be the first to review"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hasReviews
                ? "Help other surfers by sharing how this spot breaks."
                : "Let others know what to expect at this spot."}
            </p>
          </div>
        </div>
        <Button
          onClick={onWriteReview}
          className="bg-ocean-blue text-white hover:bg-ocean-blue/90 whitespace-nowrap focus:ring-2 focus:ring-ocean-blue focus:ring-offset-2"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Write a review
        </Button>
      </div>
    </div>
  );
}

export function OverviewTab({ beach, onWriteReview }: OverviewTabProps) {
  return (
    <div className="space-y-6 py-6">
      {/* Enhanced Beach Overview - Description, Tips, etc. */}
      <EnhancedBeachOverview beach={beach} />

      {/* Review CTA - Encourage users to write a review */}
      {onWriteReview && (
        <OverviewReviewCTA
          onWriteReview={onWriteReview}
          reviewCount={beach.review_count}
        />
      )}

      {/* Spot Overview - Amenities, Hazards, Gallery */}
      <SpotOverview beach={beach as Beach} />

      {/* Nearby Surf Spots - SEO internal linking */}
      <NearbySpots beach={beach as Beach} />

      {/* Related Surf Guides - SEO internal linking to intent pages */}
      <RelatedGuidesSection beach={beach as Beach} />
    </div>
  );
}
