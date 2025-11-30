"use client";

/**
 * Reviews Admin Page
 *
 * Moderate and manage beach reviews with full admin controls.
 * Features: list, filter, search, view details, soft delete, restore.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { StarIcon, TrendingUp, ThumbsUp, Trash2, Award } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ReviewTable } from "@/components/admin/review-table";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

import {
  listReviews,
  getReviewStats,
  softDeleteReview,
  restoreReview,
  getReview,
  type AdminReviewListItem,
  type AdminReviewDetails,
} from "@/actions/admin/reviews";
import type { ReviewStats } from "@/lib/validation/admin/review-schema";
import { format } from "date-fns";

export default function ReviewsAdminPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [showDeleted, setShowDeleted] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<AdminReviewListItem | null>(null);
  const [reviewToRestore, setReviewToRestore] = useState<AdminReviewListItem | null>(null);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Data fetching - unwrap server action responses
  const fetchReviews = useCallback(async (): Promise<AdminReviewListItem[]> => {
    const response = await listReviews({ includeDeleted: showDeleted });
    if (!response.success) throw new Error(response.error || 'Failed to fetch reviews');
    return (response.data as AdminReviewListItem[]) ?? [];
  }, [showDeleted]);

  const fetchStats = useCallback(async (): Promise<ReviewStats | null> => {
    const response = await getReviewStats({});
    if (!response.success) throw new Error(response.error || 'Failed to fetch stats');
    return (response.data as ReviewStats) ?? null;
  }, []);

  const fetchReviewDetails = useCallback(async (): Promise<AdminReviewDetails | null> => {
    if (!selectedReview) return null;
    const response = await getReview(selectedReview);
    if (!response.success) throw new Error(response.error || 'Failed to fetch review details');
    return (response.data as AdminReviewDetails) ?? null;
  }, [selectedReview]);

  const { data: reviews, loading: loadingReviews, refetch: refetchReviews } = useDataFetcher<AdminReviewListItem[]>(fetchReviews);
  const { data: stats, loading: loadingStats, refetch: refetchStats } = useDataFetcher<ReviewStats | null>(fetchStats);
  const { data: reviewDetails, loading: loadingDetails } = useDataFetcher<AdminReviewDetails | null>(fetchReviewDetails);

  // Handlers
  const handleViewDetails = (review: AdminReviewListItem) => {
    setSelectedReview(review.id);
    setDetailsOpen(true);
  };

  const handleDelete = async () => {
    if (!reviewToDelete) return;

    try {
      await softDeleteReview(reviewToDelete.id);
      toast({
        title: "Review deleted",
        description: `Review for ${reviewToDelete.beach_name} has been soft deleted.`,
      });
      refetchReviews();
      refetchStats();
      setReviewToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete review",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async () => {
    if (!reviewToRestore) return;

    try {
      await restoreReview(reviewToRestore.id);
      toast({
        title: "Review restored",
        description: `Review for ${reviewToRestore.beach_name} has been restored.`,
      });
      refetchReviews();
      refetchStats();
      setReviewToRestore(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to restore review",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Review Moderation"
        description="Moderate beach reviews and ratings"
      />

      {/* Stats Dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <StarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "..." : stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalHelpfulVotes || 0} helpful votes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Overall Rating</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "..." : stats?.avgOverallRating ? `${stats.avgOverallRating.toFixed(1)}/5` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all beaches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wave Quality</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "..." : stats?.avgWaveQuality ? `${stats.avgWaveQuality.toFixed(1)}/5` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg crowd: {stats?.avgCrowdDensity ? stats.avgCrowdDensity.toFixed(1) : "—"}/5
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "..." : stats?.deleted || 0}</div>
            <p className="text-xs text-muted-foreground">Soft deleted reviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Reviews</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={(checked) => setShowDeleted(checked === true)}
              />
              <Label
                htmlFor="show-deleted"
                className="text-sm font-normal cursor-pointer"
              >
                Show deleted
              </Label>
            </div>
          </div>
          <CardDescription>
            Moderate beach reviews and community feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewTable
            reviews={reviews || []}
            onViewDetails={handleViewDetails}
            onDelete={setReviewToDelete}
            onRestore={setReviewToRestore}
            loading={loadingReviews}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmActionDialog
        open={!!reviewToDelete}
        onOpenChange={(open) => !open && setReviewToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Review"
        description={
          reviewToDelete
            ? `Are you sure you want to soft delete this review for ${reviewToDelete.beach_name}? The review will be hidden but can be restored later.`
            : ""
        }
        actionLabel="Delete Review"
        actionVariant="destructive"
      />

      {/* Restore Confirmation Dialog */}
      <ConfirmActionDialog
        open={!!reviewToRestore}
        onOpenChange={(open) => !open && setReviewToRestore(null)}
        onConfirm={handleRestore}
        title="Restore Review"
        description={
          reviewToRestore
            ? `Are you sure you want to restore this review for ${reviewToRestore.beach_name}?`
            : ""
        }
        actionLabel="Restore Review"
      />

      {/* Review Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review Details</SheetTitle>
            <SheetDescription>
              Complete review information for moderation
            </SheetDescription>
          </SheetHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading review details...</div>
            </div>
          ) : reviewDetails ? (
            <div className="mt-6 space-y-6">
              {/* Beach Info */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Beach Information</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Beach:</span> {reviewDetails.beaches?.name || "Unknown"}</div>
                  <div><span className="font-medium">Region:</span> {reviewDetails.beaches?.region}</div>
                  <div><span className="font-medium">Beach ID:</span> <code className="text-xs">{reviewDetails.beach_id}</code></div>
                </div>
              </div>

              {/* User Info */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Reviewer Information</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {reviewDetails.profiles?.name || "Unknown"}</div>
                  <div><span className="font-medium">Email:</span> {reviewDetails.profiles?.email}</div>
                  <div><span className="font-medium">User ID:</span> <code className="text-xs">{reviewDetails.user_id}</code></div>
                </div>
              </div>

              {/* Review Content */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Review Content</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Title:</span>
                    <p className="text-sm font-medium mt-1">{reviewDetails.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Content:</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{reviewDetails.content}</p>
                  </div>
                </div>
              </div>

              {/* Ratings */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Ratings</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Overall</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{reviewDetails.overall_rating}/5</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Wave Quality</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reviewDetails.wave_quality_rating}/5</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Crowd Density</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reviewDetails.crowd_density_rating}/5</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Parking</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reviewDetails.parking_rating}/5</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Accessibility</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reviewDetails.accessibility_rating}/5</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Metadata</h3>
                <div className="space-y-1 text-sm">
                  {reviewDetails.visit_date && (
                    <div><span className="font-medium">Visit Date:</span> {format(new Date(reviewDetails.visit_date), "MMMM d, yyyy")}</div>
                  )}
                  <div><span className="font-medium">Helpful Votes:</span> {reviewDetails.helpful_count}</div>
                  {reviewDetails.created_at && (
                    <div><span className="font-medium">Created:</span> {format(new Date(reviewDetails.created_at), "MMMM d, yyyy h:mm a")}</div>
                  )}
                  {reviewDetails.updated_at && (
                    <div><span className="font-medium">Updated:</span> {format(new Date(reviewDetails.updated_at), "MMMM d, yyyy h:mm a")}</div>
                  )}
                </div>
              </div>

              {/* Raw JSON (for advanced debugging) */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Raw Review Data</h3>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(reviewDetails, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No review details available
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
