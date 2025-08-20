"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarButton } from "@/components/social/user-avatar-button";
import { StarRating } from "@/components/ui/star-rating";
import { Loader2, MessageSquare, Trash2, Edit3, Calendar } from "lucide-react";
import {
  getBeachReviews,
  deleteBeachReview,
} from "@/actions/beach-review-actions";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { BeachReviewWithUser } from "@/types/database";
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

interface BeachReviewsListProps {
  beachId: string;
  onEditReview?: (review: BeachReviewWithUser) => void;
  refreshTrigger?: number; // To trigger refresh from parent
}

export function BeachReviewsList({
  beachId,
  onEditReview,
  refreshTrigger,
}: BeachReviewsListProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<BeachReviewWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      const result = await getBeachReviews(beachId);
      if (result.success) {
        setReviews(result.data || []);
      } else {
        console.error("Error fetching reviews:", result.error);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [beachId, refreshTrigger]);

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
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-lg font-medium mb-2">No reviews yet</p>
        <p className="text-sm">
          Be the first to share your experience at this beach!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <UserAvatarButton
                userId={review.user_id}
                src={undefined} // No avatar_url in profiles table yet
                name={review.user.full_name}
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
                        {review.user.full_name}
                      </span>
                      <StarRating rating={review.overall_rating} size="sm" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(review.created_at), "MMM d, yyyy")}
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
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === review.id}
                          >
                            {deletingId === review.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
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
                <p className="text-muted-foreground leading-relaxed">
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
    </div>
  );
}
