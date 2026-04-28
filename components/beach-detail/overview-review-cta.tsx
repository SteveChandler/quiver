"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Star } from "lucide-react";

interface OverviewReviewCTAProps {
  onWriteReview: () => void;
  reviewCount?: number;
}

/**
 * Inline CTA encouraging logged-in users to write a review for the current
 * beach. Hides for anonymous users (Phase 1A/1B CTA reduction). Click is
 * tracked by the parent's `onWriteReview` handler — see
 * REVIEW_TRACKING_SOURCES.OVERVIEW_CTA in beach-detail.tsx.
 */
export function OverviewReviewCTA({
  onWriteReview,
  reviewCount,
}: OverviewReviewCTAProps) {
  const { user } = useAuth();
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
