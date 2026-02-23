"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { BeachReviewForm } from "@/components/beach/beach-review-form";
import type { ReviewPromptData } from "@/hooks/use-review-prompt";
import { REVIEW_TRACKING_SOURCES } from "@/lib/constants/review-tracking";

interface ReviewPromptDialogProps {
  open: boolean;
  reviewData: ReviewPromptData | null;
  onSuccess: () => void;
  onSkip: () => void;
}

/**
 * Reusable Review Prompt Dialog
 *
 * Displays a post-session review prompt encouraging users to share their experience.
 * Used after logging a surf session to capture valuable beach feedback.
 *
 * Features:
 * - Consistent UI across the app
 * - Integrated tracking via BeachReviewForm
 * - Skip button for users who don't want to review
 * - Prevents accidental dismissal (onInteractOutside/onEscapeKeyDown)
 */
export function ReviewPromptDialog({
  open,
  reviewData,
  onSuccess,
  onSkip,
}: ReviewPromptDialogProps) {
  if (!reviewData) return null;

  return (
    <Dialog open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2">
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <DialogTitle>
                Share your experience at {reviewData.beachName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Help other surfers know what to expect!
              </p>
            </div>
          </div>
        </DialogHeader>

        <BeachReviewForm
          beachId={reviewData.beachId}
          beachName={reviewData.beachName}
          onSuccess={onSuccess}
          onCancel={onSkip}
          isInDialog={true}
          trackingSource={REVIEW_TRACKING_SOURCES.POST_SESSION}
        />

        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
