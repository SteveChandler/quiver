"use client";

import { useEffect, useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarButton } from "@/components/social/user-avatar-button";
import { StarRating } from "@/components/ui/star-rating";
import { Loader2, MessageSquare, Trash2, Edit3, Calendar } from "lucide-react";
import { ZeroState } from "@/components/ui/zero-state";
import { GradientEmptyState } from "@/components/ui/gradient-empty-state";
import {
  getBeachReviews,
  deleteBeachReview,
} from "@/actions/beach-review-actions";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { BeachReviewWithUser } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PartialContentGate } from "@/components/ui/partial-content-gate";

interface BeachReviewsListProps {
  beachId: string;
  onEditReview?: (review: BeachReviewWithUser) => void;
  refreshTrigger?: number; // To trigger refresh from parent
  publicMode?: boolean;
  previewCount?: number;
}

export function BeachReviewsList({
  beachId,
  onEditReview,
  refreshTrigger,
  publicMode = false,
  previewCount = 3,
}: BeachReviewsListProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<BeachReviewWithUser[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    const result = await getBeachReviews(beachId);
    if (result.success) {
      return result.data || [];
    }
    throw new Error(result.error || "Failed to fetch reviews");
  }, [beachId]);

  const { data, loading, refetch } = useDataFetcher<BeachReviewWithUser[]>(
    fetchReviews,
    {
      immediate: true,
    }
  );

  useEffect(() => {
    if (data) {
      setReviews(data);
    }
  }, [data]);

  useEffect(() => {
    if (typeof refreshTrigger !== "undefined") {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const handleDeleteReview = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      const result = await deleteBeachReview(reviewId);
      if (result.success) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        toast({
          title: "Review Deleted",
          description: "Your review has been deleted successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete review",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reviews.length === 0) {
    if (publicMode) {
      return (
        <GradientEmptyState
          icon={MessageSquare}
          title="Surfed here? Share your experience"
          description="Be the first to review this spot and help fellow surfers find the best waves."
        />
      );
    }
    return (
      <ZeroState
        icon={MessageSquare}
        title="No reviews yet"
        description="Be the first to share your experience at this beach!"
      />
    );
  }

  const previewReviews = publicMode ? reviews.slice(0, previewCount) : reviews;
  const hasMore = publicMode && reviews.length > previewCount;

  return (
    <div className="space-y-4">
      {previewReviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <UserAvatarButton
                userId={review.user_id}
                src={review.profiles?.avatar_url ?? undefined}
                name={review.profiles?.full_name ?? "Anonymous"}
                email={undefined} // No email in profiles table yet
                size="lg"
                className="shrink-0"
              />

              <div className="flex-1 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {review.profiles?.full_name ?? "Anonymous"}
                      </span>
                      <StarRating rating={review.overall_rating} size="sm" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {review.created_at
                        ? format(new Date(review.created_at), "MMM d, yyyy")
                        : "—"}
                      {review.visit_date && (
                        <span className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Visited{" "}
                          {format(new Date(review.visit_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Action buttons for review owner */}
                  {user?.id === review.user_id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditReview?.(review)}
                        aria-label="Edit review"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === review.id}
                            aria-label="Delete review"
                          >
                            {deletingId === review.id ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2
                                className="h-4 w-4 text-destructive"
                                aria-hidden="true"
                              />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Review</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this review? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteReview(review.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* Review Title */}
                <h4 className="font-medium text-lg">{review.title}</h4>

                {/* Review Content */}
                <p className={cn("text-muted-foreground leading-relaxed", publicMode && "line-clamp-3")}>
                  {review.content}
                </p>

                {/* Detailed Ratings */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Wave Quality
                    </p>
                    <StarRating rating={review.wave_quality_rating} size="sm" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Crowd Level
                    </p>
                    <StarRating
                      rating={review.crowd_density_rating}
                      size="sm"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Parking
                    </p>
                    <StarRating rating={review.parking_rating} size="sm" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">
                      Accessibility
                    </p>
                    <StarRating
                      rating={review.accessibility_rating}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {hasMore && (
        <PartialContentGate
          contentType="reviews"
          totalCount={reviews.length}
          previewCount={previewCount}
        />
      )}
    </div>
  );
}
