"use client";

import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";

const BeachReviewSummary = dynamic(
  () =>
    import("@/components/beach/beach-review-summary").then(
      (m) => m.BeachReviewSummary
    ),
  { ssr: false }
);

const BeachReviewsList = dynamic(
  () =>
    import("@/components/beach/beach-reviews-list").then(
      (m) => m.BeachReviewsList
    ),
  { ssr: false }
);

interface ReviewsTabProps {
  beach: Beach;
  onWriteReview: () => void;
  reviewRefreshTrigger: number;
  publicMode?: boolean;
  previewCount?: number;
}

export function ReviewsTab({
  beach,
  onWriteReview,
  reviewRefreshTrigger,
  publicMode = false,
  previewCount,
}: ReviewsTabProps) {
  return (
    <div className="space-y-6 py-6">
      {!publicMode && (
        <BeachReviewSummary
          beachId={beach.id}
          onWriteReview={onWriteReview}
          refreshTrigger={reviewRefreshTrigger}
        />
      )}
      <BeachReviewsList
        beachId={beach.id}
        refreshTrigger={reviewRefreshTrigger}
        publicMode={publicMode}
        previewCount={previewCount}
      />
    </div>
  );
}
