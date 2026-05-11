"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Star, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import {
  createBeachReview,
  updateBeachReview,
} from "@/actions/beach-review-actions";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { BeachReviewWithUser } from "@/types/database";
import type { ReviewFormMetadata } from "@/types/implicit-preferences";
import type { ReviewTrackingSource } from "@/lib/constants/review-tracking";
import { REVIEW_TRACKING_SOURCES } from "@/lib/constants/review-tracking";

interface BeachReviewFormProps {
  beachId: string;
  beachName: string;
  existingReview?: BeachReviewWithUser;
  onSuccess?: () => void;
  onCancel?: () => void;
  isInDialog?: boolean;
  /** Source for tracking where the review form was opened from */
  trackingSource?: ReviewTrackingSource;
}

export { REVIEW_TRACKING_SOURCES };

interface ReviewFormData {
  overall_rating: number;
  wave_quality_rating: number;
  crowd_density_rating: number;
  parking_rating: number;
  accessibility_rating: number;
  title: string;
  content: string;
  visit_date?: Date;
}

export function BeachReviewForm({
  beachId,
  beachName,
  existingReview,
  onSuccess,
  onCancel,
  isInDialog = false,
  trackingSource = REVIEW_TRACKING_SOURCES.REVIEWS_TAB,
}: BeachReviewFormProps) {
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const [submitting, setSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Track form open time for abandon duration calculation
  const formOpenTimeRef = useRef<number>(Date.now());
  // Prevent duplicate open tracking
  const hasTrackedOpenRef = useRef(false);
  // Marks a successful submission so the unmount cleanup doesn't fire abandon
  const hasSubmittedRef = useRef(false);
  // Single-fire guard shared by handleCancel and the unmount cleanup
  const hasTrackedAbandonRef = useRef(false);
  // Count how many times the mount effect has run. StrictMode re-runs mount in
  // dev — we use this to distinguish the fake-unmount (cycle 1, nothing after)
  // from a real unmount (cycle > 1, or cycle 1 in production).
  const mountCycleRef = useRef(0);
  // Refs that mirror the latest values used by the unmount cleanup. The cleanup
  // runs with empty deps so it can detect actual unmount (not every prop change),
  // which means it would otherwise read stale closure values.
  const trackRef = useRef(track);
  const beachIdRef = useRef(beachId);
  const beachNameRef = useRef(beachName);
  const trackingSourceRef = useRef(trackingSource);
  const isEditRef = useRef(Boolean(existingReview));
  // Tracks the deepest field the user has engaged with. Promoted monotonically
  // (never regresses) as the user interacts with fields.
  const maxFieldTouchedRef = useRef<'none' | 'rating' | 'title' | 'content' | 'date'>('none');
  // Mirror ref for the abandon snapshot so the unmount cleanup (empty deps) can
  // read fresh formData-derived values without closing over stale state.
  const abandonSnapshotRef = useRef<{
    stars_filled: number;
    title_length: number;
    content_length: number;
    max_field_touched: 'none' | 'rating' | 'title' | 'content' | 'date';
  }>({ stars_filled: 0, title_length: 0, content_length: 0, max_field_touched: 'none' });

  const [formData, setFormData] = useState<ReviewFormData>({
    overall_rating: existingReview?.overall_rating || 0,
    wave_quality_rating: existingReview?.wave_quality_rating || 0,
    crowd_density_rating: existingReview?.crowd_density_rating || 0,
    parking_rating: existingReview?.parking_rating || 0,
    accessibility_rating: existingReview?.accessibility_rating || 0,
    title: existingReview?.title || "",
    content: existingReview?.content || "",
    visit_date: existingReview?.visit_date
      ? new Date(existingReview.visit_date)
      : undefined,
  });

  const FIELD_ORDER: Array<'none' | 'rating' | 'title' | 'content' | 'date'> = ['none', 'rating', 'title', 'content', 'date'];
  function promoteField(
    current: typeof FIELD_ORDER[number],
    next: typeof FIELD_ORDER[number]
  ): typeof FIELD_ORDER[number] {
    return FIELD_ORDER.indexOf(next) > FIELD_ORDER.indexOf(current) ? next : current;
  }

  const buildAbandonFieldSnapshot = () => {
    const ratingsFilled = [
      formData.overall_rating,
      formData.wave_quality_rating,
      formData.crowd_density_rating,
      formData.parking_rating,
      formData.accessibility_rating,
    ].filter((r) => r > 0).length;

    return {
      stars_filled: ratingsFilled,
      title_length: formData.title.length,
      content_length: formData.content.length,
      max_field_touched: maxFieldTouchedRef.current,
    };
  };

  // Track form open on mount (only once)
  useEffect(() => {
    if (hasTrackedOpenRef.current || !user) return;
    hasTrackedOpenRef.current = true;
    formOpenTimeRef.current = Date.now();

    track('review_form_open', {
      beachId,
      metadata: {
        source: trackingSource,
        beach_id: beachId,
        beach_name: beachName,
        is_edit: Boolean(existingReview),
      } as ReviewFormMetadata,
    });
  }, [user, beachId, beachName, existingReview, trackingSource, track]);

  // Sync the latest values into refs every render so the unmount cleanup reads fresh data.
  useEffect(() => {
    trackRef.current = track;
    beachIdRef.current = beachId;
    beachNameRef.current = beachName;
    trackingSourceRef.current = trackingSource;
    isEditRef.current = Boolean(existingReview);
    abandonSnapshotRef.current = buildAbandonFieldSnapshot();
  });

  // Fire review_form_abandon on unmount when the user closes the dialog via X,
  // outside-click, or back navigation (anything that isn't Cancel or Submit).
  // Empty deps ensure the cleanup runs only on actual unmount.
  //
  // React 19 StrictMode fake-unmount only runs in dev. Suppress that first
  // cleanup by cycle instead of elapsed time; full test runs can exceed tiny
  // timing thresholds before React replays the mount.
  useEffect(() => {
    mountCycleRef.current += 1;
    const cycleAtMount = mountCycleRef.current;
    return () => {
      const elapsed = Date.now() - formOpenTimeRef.current;
      const isStrictModeFakeUnmount =
        process.env.NODE_ENV !== 'production' &&
        cycleAtMount === 1 &&
        mountCycleRef.current === 1;
      if (
        !hasTrackedOpenRef.current ||
        hasSubmittedRef.current ||
        hasTrackedAbandonRef.current ||
        isStrictModeFakeUnmount
      ) {
        return;
      }
      hasTrackedAbandonRef.current = true;
      trackRef.current('review_form_abandon', {
        beachId: beachIdRef.current,
        metadata: {
          source: trackingSourceRef.current,
          beach_id: beachIdRef.current,
          beach_name: beachNameRef.current,
          is_edit: isEditRef.current,
          duration_ms: elapsed,
          abandon_via: 'unmount',
          ...abandonSnapshotRef.current,
        } as ReviewFormMetadata,
      });
    };
    // Empty deps intentional: cleanup must run only on real unmount.
  }, []);

  const handleRatingChange = (
    category: keyof ReviewFormData,
    rating: number
  ) => {
    maxFieldTouchedRef.current = promoteField(maxFieldTouchedRef.current, 'rating');
    setFormData((prev) => ({ ...prev, [category]: rating }));
  };

  const handleCancel = () => {
    // Single-fire guard: bail if cleanup already fired abandon.
    if (hasTrackedAbandonRef.current) {
      onCancel?.();
      return;
    }
    hasTrackedAbandonRef.current = true;
    // Read payload values from refs for consistency with the unmount cleanup.
    // Closure reads would work today (props are stable for the dialog's lifetime)
    // but diverge from the cleanup path if the form is ever mounted in a prop-
    // swapping container.
    trackRef.current('review_form_abandon', {
      beachId: beachIdRef.current,
      metadata: {
        source: trackingSourceRef.current,
        beach_id: beachIdRef.current,
        beach_name: beachNameRef.current,
        is_edit: isEditRef.current,
        duration_ms: Date.now() - formOpenTimeRef.current,
        abandon_via: 'cancel_button',
        ...abandonSnapshotRef.current,
      } as ReviewFormMetadata,
    });

    onCancel?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (
      formData.overall_rating === 0 ||
      formData.wave_quality_rating === 0 ||
      formData.crowd_density_rating === 0 ||
      formData.parking_rating === 0 ||
      formData.accessibility_rating === 0
    ) {
      // Track validation error
      track('review_validation_error', {
        beachId,
        metadata: {
          source: trackingSource,
          beach_id: beachId,
          beach_name: beachName,
          error_type: 'missing_ratings',
          is_edit: Boolean(existingReview),
        } as ReviewFormMetadata,
      });

      toast({
        title: "Missing Ratings",
        description: "Please provide ratings for all categories.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      // Track validation error
      track('review_validation_error', {
        beachId,
        metadata: {
          source: trackingSource,
          beach_id: beachId,
          beach_name: beachName,
          error_type: 'missing_content',
          is_edit: Boolean(existingReview),
        } as ReviewFormMetadata,
      });

      toast({
        title: "Missing Information",
        description: "Please provide both a title and review content.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        beach_id: beachId,
        user_id: user.id,
        overall_rating: formData.overall_rating,
        wave_quality_rating: formData.wave_quality_rating,
        crowd_density_rating: formData.crowd_density_rating,
        parking_rating: formData.parking_rating,
        accessibility_rating: formData.accessibility_rating,
        title: formData.title.trim(),
        content: formData.content.trim(),
        visit_date: formData.visit_date?.toISOString().split("T")[0],
      };

      let result;
      if (existingReview) {
        // Update existing review
        result = await updateBeachReview(existingReview.id, reviewData);
      } else {
        // Create new review
        result = await createBeachReview(reviewData);
      }

      if (result.success) {
        // Mark as submitted so the unmount cleanup doesn't fire abandon
        hasSubmittedRef.current = true;
        // Track successful submit
        track('review_submit', {
          beachId,
          metadata: {
            source: trackingSource,
            beach_id: beachId,
            beach_name: beachName,
            is_edit: Boolean(existingReview),
            duration_ms: Date.now() - formOpenTimeRef.current,
          } as ReviewFormMetadata,
        });

        toast({
          title: existingReview ? "Review Updated" : "Review Posted",
          description: `Your review for ${beachName} has been ${
            existingReview ? "updated" : "posted"
          } successfully.`,
        });
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save review",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarRating = (
    category: keyof ReviewFormData,
    label: string,
    icon: React.ReactNode
  ) => {
    const rating = formData[category] as number;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <div className="flex gap-1" role="group" aria-label={`${label} rating`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingChange(category, star)}
              className="p-1 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-ocean-blue focus:ring-offset-1 rounded"
              aria-label={`Rate ${label} ${star} out of 5 stars${star <= rating ? ' (selected)' : ''}`}
              aria-pressed={star <= rating}
            >
              <Star
                className={`h-6 w-6 ${
                  star <= rating
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-gray-300 hover:text-yellow-300"
                }`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!user) {
    const signInMessage = (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to write a review.
        </p>
      </div>
    );

    return isInDialog ? (
      signInMessage
    ) : (
      <Card>
        <CardContent>{signInMessage}</CardContent>
      </Card>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Star Ratings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderStarRating(
          "overall_rating",
          "Overall Experience",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "wave_quality_rating",
          "Wave Quality",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "crowd_density_rating",
          "Crowd Level",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "parking_rating",
          "Parking",
          <Star className="h-4 w-4" />
        )}
        {renderStarRating(
          "accessibility_rating",
          "Accessibility",
          <Star className="h-4 w-4" />
        )}
      </div>

      {/* Visit Date */}
      <div className="space-y-2">
        <Label htmlFor="visit-date">Visit Date (Optional)</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !formData.visit_date && "text-muted-foreground"
              )}
              type="button"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.visit_date ? (
                format(formData.visit_date, "PPP")
              ) : (
                <span>When did you visit?</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.visit_date}
              onSelect={(date) => {
                maxFieldTouchedRef.current = promoteField(maxFieldTouchedRef.current, 'date');
                setFormData((prev) => ({
                  ...prev,
                  visit_date: date || undefined,
                }));
                if (date) {
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
            />
            <div className="p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, visit_date: undefined }));
                  setCalendarOpen(false);
                }}
                type="button"
              >
                Clear Date
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Review Title</Label>
        <Input
          id="title"
          placeholder="Summarize your experience..."
          value={formData.title}
          onChange={(e) => {
            maxFieldTouchedRef.current = promoteField(maxFieldTouchedRef.current, 'title');
            setFormData((prev) => ({ ...prev, title: e.target.value }));
          }}
          maxLength={200}
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Your Review</Label>
        <Textarea
          id="content"
          placeholder="Share your detailed experience at this beach..."
          value={formData.content}
          onChange={(e) => {
            maxFieldTouchedRef.current = promoteField(maxFieldTouchedRef.current, 'content');
            setFormData((prev) => ({ ...prev, content: e.target.value }));
          }}
          className="min-h-[120px]"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {existingReview ? "Updating..." : "Posting..."}
            </>
          ) : existingReview ? (
            "Update Review"
          ) : (
            "Post Review"
          )}
        </Button>
      </div>
    </form>
  );

  return isInDialog ? (
    <div className="space-y-4">{formContent}</div>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingReview ? "Edit Your Review" : "Write a Review"} for{" "}
          {beachName}
        </CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
